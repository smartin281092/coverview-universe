#!/usr/bin/env node
/* global document, window, requestAnimationFrame */
// Oracle du build livré : HTML/JS et mesures synthétiques locales, jamais du RUM.
import assert from "node:assert/strict";
import { readdir, readFile, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const dist = fileURLToPath(new URL("../apps/www/dist/", import.meta.url));
const representatives = ["/", "/overview", "/analyser-3p", "/explorer", "/methode"];
const limits = { javascriptGzipBytes: 100 * 1024, lcpMs: 2500, cls: 0.1 };
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

async function buildFiles() {
  const root = await realpath(dist);
  const files = new Map();
  let totalBytes = 0;
  async function visit(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      // Les métadonnées privées de prerender ne font pas partie du site servi.
      if (entry.name.startsWith(".")) continue;
      assert(!entry.isSymbolicLink(), `Lien symbolique interdit dans dist : ${entry.name}`);
      const path = join(directory, entry.name);
      const url = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) await visit(path, url);
      else if (entry.isFile()) {
        const body = await readFile(path);
        totalBytes += body.length;
        assert(
          files.size < 10000 && totalBytes < 100 * 1024 * 1024,
          "Build trop volumineux pour cet oracle borné",
        );
        files.set(url, body);
      }
    }
  }
  await visit(root);
  assert(
    files.has("/index.html") && files.has("/404.html"),
    "Build www absent ou incomplet : lancer pnpm build",
  );
  return files;
}

async function serve(files) {
  // Table de fichiers en mémoire : aucune URL ne devient un accès au système de fichiers.
  const server = createServer((request, response) => {
    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    const target = files.has(pathname) ? pathname : `${pathname.replace(/\/$/, "")}/index.html`;
    const found = files.has(target);
    const file = found ? target : "/404.html";
    const body = files.get(file);
    response.writeHead(found ? 200 : 404, {
      "Content-Type": mime[extname(file)] ?? "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(request.method === "HEAD" ? undefined : body);
  });
  server.requestTimeout = 5000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function checkHtml(browser, files, origin) {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const routes = [...files.keys()]
    .filter((path) => path.endsWith("/index.html"))
    .map((path) => path.slice(0, -"index.html".length).replace(/\/$/, "") || "/")
    .sort();
  const titles = new Set();
  const descriptions = new Set();
  let inlineGzipBytes = 0;
  try {
    for (const route of routes) {
      const response = await page.goto(`${origin}${route}?utm_source=build-check`);
      assert.equal(response.status(), 200, route);
      const html = await page.evaluate(() => {
        const meta = (selector, attribute = "content") =>
          document.querySelector(selector)?.getAttribute(attribute);
        const scripts = [...document.scripts].filter(
          (script) => !["application/ld+json", "application/json"].includes(script.type),
        );
        return {
          title: document.title,
          description: meta('meta[name="description"]'),
          canonical: meta('link[rel="canonical"]', "href"),
          robots: meta('meta[name="robots"]'),
          ogTitle: meta('meta[property="og:title"]'),
          ogUrl: meta('meta[property="og:url"]'),
          ogImage: meta('meta[property="og:image"]'),
          twitter: meta('meta[name="twitter:card"]'),
          h1: document.querySelectorAll("h1").length,
          scripts: scripts.map((script) => ({ src: script.src, body: script.textContent })),
          activeAttributes: [...document.querySelectorAll("*")].some((element) =>
            [...element.attributes].some(
              (attribute) =>
                /^on/i.test(attribute.name) || /^javascript:/i.test(attribute.value.trim()),
            ),
          ),
        };
      });
      assert.equal(html.h1, 1, `${route} : h1 unique`);
      assert(
        html.title &&
          html.description &&
          !titles.has(html.title) &&
          !descriptions.has(html.description),
        `${route} : metadata absentes ou dupliquées`,
      );
      titles.add(html.title);
      descriptions.add(html.description);
      assert.equal(html.canonical, `https://coverview.ch${route}`, route);
      assert.match(html.robots ?? "", /noindex/, route);
      assert.equal(html.ogTitle, html.title, route);
      assert.equal(html.ogUrl, html.canonical, route);
      assert(html.ogImage && html.twitter, `${route} : partage incomplet`);
      if (route !== "/account") {
        assert.equal(
          html.scripts.length,
          0,
          `${route} : script exécutable dans le contenu statique`,
        );
        assert.equal(html.activeAttributes, false, `${route} : JavaScript dans les attributs HTML`);
      }
      for (const script of html.scripts) {
        if (script.src) {
          const url = new URL(script.src);
          assert(
            url.origin === origin && files.has(url.pathname),
            `${route} : script absent du build local`,
          );
        } else inlineGzipBytes += gzipSync(script.body).length;
      }
    }
    assert.equal((await page.goto(`${origin}/page-absente-build-check`)).status(), 404);
    return { pages: routes.length, nonAccountExecutableScripts: 0, inlineGzipBytes, real404: true };
  } finally {
    await context.close();
  }
}

async function measurePage(browser, origin, route) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const unexpected = [];
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  try {
    await context.route("**/*", (requestRoute) => {
      if (new URL(requestRoute.request().url()).origin === origin) return requestRoute.continue();
      unexpected.push(requestRoute.request().url());
      return requestRoute.abort();
    });
    await page.addInitScript(() => {
      const metrics = {
        lcpMs: null,
        cls: 0,
        eventDurations: [],
        supported: PerformanceObserver.supportedEntryTypes,
      };
      window.__coverviewMetrics = metrics;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) metrics.lcpMs = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      let session = 0,
        first = 0,
        last = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          if (entry.startTime - last > 1000 || entry.startTime - first > 5000) {
            session = 0;
            first = entry.startTime;
          }
          session += entry.value;
          last = entry.startTime;
          metrics.cls = Math.max(metrics.cls, session);
        }
      }).observe({ type: "layout-shift", buffered: true });
      if (metrics.supported.includes("event"))
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (entry.interactionId) metrics.eventDurations.push(entry.duration);
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    });
    assert.equal(
      (await page.goto(`${origin}${route}`, { waitUntil: "load" })).status(),
      200,
      route,
    );
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    // Fenêtre d’observation déclarée, après chargement des polices et images ; aucun throttling.
    await page.waitForTimeout(750);
    await page.keyboard.press("Tab");
    assert(
      await page
        .getByRole("link", { name: "Aller au contenu" })
        .evaluate((element) => element === document.activeElement),
      `${route} : skip-link non focalisé`,
    );
    await page.keyboard.press("Enter");
    assert(
      await page.getByRole("main").evaluate((element) => element === document.activeElement),
      `${route} : contenu non focalisé`,
    );
    await page.waitForTimeout(100);
    const metrics = await page.evaluate(() => window.__coverviewMetrics);
    assert(
      metrics.supported.includes("largest-contentful-paint") &&
        metrics.supported.includes("layout-shift"),
      "Observateurs LCP/CLS indisponibles",
    );
    assert(
      metrics.lcpMs !== null && metrics.lcpMs < limits.lcpMs,
      `${route} : LCP local ${metrics.lcpMs} ms`,
    );
    assert(metrics.cls < limits.cls, `${route} : CLS local ${metrics.cls}`);
    assert.deepEqual(unexpected, [], `${route} : tentative de requête externe`);
    return {
      route,
      lcpMs: Math.round(metrics.lcpMs),
      cls: Number(metrics.cls.toFixed(4)),
      skipLink: "passed",
      observedInteractionEvents: metrics.eventDurations.length,
      maxObservedEventDurationMs: metrics.eventDurations.length
        ? Math.max(...metrics.eventDurations)
        : null,
    };
  } finally {
    await context.close();
  }
}

let server;
let browser;
try {
  const files = await buildFiles();
  const hosted = await serve(files);
  server = hosted.server;
  browser = await chromium.launch({ timeout: 15000 });
  const html = await checkHtml(browser, files, hosted.origin);
  const jsFiles = [...files].filter(([path]) => [".js", ".mjs", ".cjs"].includes(extname(path)));
  const javascriptGzipBytes = jsFiles.reduce(
    (sum, [, body]) => sum + gzipSync(body).length,
    html.inlineGzipBytes,
  );
  assert(
    javascriptGzipBytes < limits.javascriptGzipBytes,
    `Budget JavaScript global : ${javascriptGzipBytes} octets gzip`,
  );
  const synthetic = [];
  for (const route of representatives)
    synthetic.push(await measurePage(browser, hosted.origin, route));
  console.log(
    JSON.stringify({
      status: "passed",
      html,
      javascript: { files: jsFiles.length, gzipBytes: javascriptGzipBytes },
      limits,
      method:
        "Chromium headless, HTTP loopback, contexte neuf par page, 1280x900, sans throttling, observation 750 ms après polices/images",
      synthetic,
      unmeasured: ["INP terrain", "RUM", "conditions réelles de réseau et appareils"],
    }),
  );
} catch (error) {
  console.error(JSON.stringify({ status: "failed", error: error.message }));
  process.exitCode = 1;
} finally {
  try {
    await browser?.close();
  } finally {
    if (server)
      await new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      });
  }
}
