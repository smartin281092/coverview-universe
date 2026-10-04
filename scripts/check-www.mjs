#!/usr/bin/env node
/* global document, window, requestAnimationFrame, DOMParser */
// Oracle du build livré : HTML/JS et mesures synthétiques locales, jamais du RUM.
import assert from "node:assert/strict";
import { readdir, readFile, realpath } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const dist = fileURLToPath(new URL("../apps/www/dist/", import.meta.url));
const representatives = [
  "/",
  "/overview",
  "/analyser-3p",
  "/explorer",
  "/methode",
  "/modeles",
  "/articles",
  "/articles/page/2",
  "/etudes-de-cas/maintien",
  "/rapports/exemple",
  "/sebastien-martin",
];
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
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const normalize = (text) => text.replace(/\s+/g, " ").trim();

// Le contenu livré s'adresse aux visiteurs, sans notes de fabrication éditoriale.
function checkPublicCopy(files) {
  const internalNotes =
    /rédaction assistée|assistée par IA|assistance d[’']intelligence artificielle|validation éditoriale|avant publication|Bible produit|document produit fourni|Les frais inclus ne sont pas précisés dans les captures|Selon le fondateur/i;
  let checked = 0;
  for (const [path, body] of files) {
    if (![".html", ".md"].includes(extname(path))) continue;
    assert.doesNotMatch(
      body.toString(),
      internalNotes,
      `${path} : note interne dans le contenu public`,
    );
    checked++;
  }
  return { checked, internalNotes: "absent" };
}

// Le corpus autorisé emploie du Markdown standard. Cet oracle n'importe ni le
// catalogue ni la fonction de miroir de l'application : il relit les sources.
async function editorialSources() {
  const sources = new Map();
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith(".mdx")) {
        const source = (await readFile(path, "utf8")).replaceAll("\r\n", "\n");
        const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n/);
        if (!frontmatter || !/^status: ["']?preview["']?$/m.test(frontmatter[1])) continue;
        const slug = frontmatter[1].match(/^slug: ["']?([^\s"']+)["']?$/m)?.[1];
        assert(slug, `${path} : slug de préversion absent`);
        assert(!sources.has(`/${slug}`), `${path} : slug de préversion dupliqué`);
        sources.set(`/${slug}`, source.slice(frontmatter[0].length).trim());
      }
    }
  }
  await visit(fileURLToPath(new URL("../apps/www/src/content/", import.meta.url)));
  assert(sources.size > 0, "Corpus éditorial de préversion absent");
  return sources;
}

function markdownText(body) {
  return normalize(
    body
      .replace(/^\|(?:[\s:|-]+)\|\s*$/gm, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/\*\*|__|`/g, "")
      .replaceAll("|", " "),
  );
}

function structuredNodes(value) {
  if (!value || typeof value !== "object") return [];
  return [
    value,
    ...Object.values(value).flatMap((child) =>
      Array.isArray(child) ? child.flatMap(structuredNodes) : structuredNodes(child),
    ),
  ];
}

function checkStructured(html, route) {
  const nodes = html.structured.flatMap(structuredNodes);
  for (const node of nodes) {
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
    for (const type of types) {
      assert(
        ![
          "FinancialService",
          "Offer",
          "Product",
          "SoftwareApplication",
          "Review",
          "AggregateRating",
        ].includes(type),
        `${route} : donnée structurée de capacité ou preuve non livrée (${type})`,
      );
      if (type === "Organization")
        assert(normalize(html.mainText).includes(node.name), `${route} : organisation invisible`);
      if (type === "Person") {
        assert.equal(route, "/sebastien-martin", "Person limitée à la page de la personne");
        assert.equal(node.name, "Sébastien Martin");
        assert(normalize(html.mainText).includes(node.name), `${route} : personne invisible`);
        for (const field of ["sameAs", "award", "hasCredential", "jobTitle"])
          assert.equal(node[field], undefined, `${route} : preuve personnelle absente (${field})`);
      }
      if (type === "Article") {
        assert.equal(node.url, html.canonical, route);
        assert.equal(node.headline, html.title, route);
        assert.match(node.dateCreated ?? "", /^\d{4}-\d{2}-\d{2}/, `${route} : date de création`);
        assert.match(
          node.dateModified ?? "",
          /^\d{4}-\d{2}-\d{2}/,
          `${route} : date de modification`,
        );
        assert.equal(
          node.datePublished,
          undefined,
          `${route} : aucune publication externe validée`,
        );
        assert(
          html.dates.includes(node.dateCreated) && html.dates.includes(node.dateModified),
          `${route} : dates structurées invisibles`,
        );
        const author = node.author?.["@id"]
          ? nodes.find((candidate) => candidate["@id"] === node.author["@id"] && candidate.name)
          : node.author;
        assert(
          author?.name && normalize(html.mainText).includes(author.name),
          `${route} : auteur invisible`,
        );
      }
      if (type === "FAQPage") {
        assert(Array.isArray(node.mainEntity) && node.mainEntity.length > 0, `${route} : FAQ vide`);
        for (const question of node.mainEntity) {
          // Une FAQ native garde sa question visible dans <summary> et sa réponse
          // dans le HTML initial de <details>, même lorsqu’elle est repliée.
          const disclosure = html.faqDisclosures.find((item) => item.question === question.name);
          assert(
            html.headings.includes(question.name) || disclosure,
            `${route} : question FAQ invisible`,
          );
          assert(
            normalize(disclosure?.answer ?? html.mainText).includes(
              normalize(question.acceptedAnswer?.text ?? ""),
            ),
            `${route} : réponse FAQ différente`,
          );
          assert(question.acceptedAnswer?.text?.trim(), `${route} : réponse FAQ vide`);
        }
      }
    }
  }
  if (route === "/sebastien-martin")
    assert(
      nodes.some((node) => node["@type"] === "Person"),
      "Person absente",
    );
  if (/^\/(?:etudes-de-cas|rapports)\/.+/.test(route) || /^\/articles\/(?!page\/).+/.test(route))
    assert(
      nodes.some((node) => node["@type"] === "Article" || node["@type"] === "FAQPage"),
      `${route} : type éditorial absent`,
    );
  return nodes.filter((node) => node["@type"]).length;
}

function checkIndexes(files) {
  for (const path of ["/sitemap.xml", "/feed.xml", "/llms.txt"])
    assert(files.has(path), `${path} : sortie générée absente`);
  const sitemap = files.get("/sitemap.xml").toString();
  const feed = files.get("/feed.xml").toString();
  const llms = files.get("/llms.txt").toString();
  assert.match(sitemap, /<urlset[\s>]/, "Sitemap XML incomplet");
  assert.doesNotMatch(sitemap, /<loc[\s>]|<url[\s>]/, "Aucune page noindex dans le sitemap");
  assert.match(feed, /<(?:rss|feed)[\s>]/, "Flux XML incomplet");
  assert.doesNotMatch(feed, /<(?:item|entry)[\s>]/, "Aucun article noindex dans le flux");
  assert.doesNotMatch(
    llms,
    /\]\(https?:\/\/|https?:\/\//,
    "Aucune URL de préversion annoncée aux LLM",
  );
  assert.match(
    files.get("/robots.txt")?.toString() ?? "",
    /User-agent:\s*\*[\s\S]*Disallow:\s*\//i,
    "Robots de préversion refusés",
  );
  return { sitemapPages: 0, feedEntries: 0, llmsLinks: 0 };
}

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
  const sources = await editorialSources();
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const routes = [...files.keys()]
    .filter((path) => path.endsWith("/index.html"))
    .map((path) => path.slice(0, -"index.html".length).replace(/\/$/, "") || "/")
    .sort();
  const titles = new Set();
  const descriptions = new Set();
  const pages = new Map();
  let inlineGzipBytes = 0;
  let structuredEntities = 0;
  let mirrors = 0;
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
          mainText: document.querySelector("main")?.innerText ?? "",
          bodyText: document.querySelector("[data-editorial-body]")?.innerText,
          bodyUi: [...document.querySelectorAll("[data-editorial-body] [data-editorial-ui]")].map(
            (element) => element.innerText,
          ),
          headings: [...document.querySelectorAll("main h2, main h3")].map((heading) =>
            heading.textContent.trim(),
          ),
          faqDisclosures: [...document.querySelectorAll("main details")].map((details) => ({
            question: details.querySelector("summary")?.textContent.trim(),
            answer: [...details.children]
              .filter((child) => child.tagName !== "SUMMARY")
              .map((child) => child.textContent)
              .join(" "),
          })),
          dates: [...document.querySelectorAll("main time[datetime]")].map((date) =>
            date.getAttribute("datetime"),
          ),
          links: [...document.querySelectorAll("a[href]")].map((link) => link.getAttribute("href")),
          ids: [...document.querySelectorAll("[id]")].map((element) => element.id),
          mirror: meta('link[rel="alternate"][type="text/markdown"]', "href"),
          structured: [...document.querySelectorAll('script[type="application/ld+json"]')].map(
            (script) => JSON.parse(script.textContent),
          ),
          scripts: scripts.map((script) => ({ src: script.src, body: script.textContent })),
          islands: [...document.querySelectorAll("astro-island")].map((island) => ({
            component: island.getAttribute("component-url"),
            renderer: island.getAttribute("renderer-url"),
          })),
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
      assert.equal(new Set(html.ids).size, html.ids.length, `${route} : ancre dupliquée`);
      structuredEntities += checkStructured(html, route);
      pages.set(route, html);
      if (sources.has(route)) {
        assert.equal(html.mirror, `${route}.md`, `${route} : lien miroir`);
        const markdown = files.get(`${route}.md`)?.toString();
        assert(markdown, `${route} : miroir absent du build`);
        assert(markdown.includes(html.canonical), `${route} : canonical absent du miroir`);
        assert(markdown.includes(sources.get(route)), `${route} : corps MDX et miroir différents`);
        const bodyText = html.bodyUi.reduce(
          (body, text) => body.replace(text, ""),
          html.bodyText ?? "",
        );
        assert.equal(
          normalize(bodyText),
          markdownText(sources.get(route)),
          `${route} : corps MDX et HTML différents`,
        );
        for (const date of html.dates)
          assert(markdown.includes(date), `${route} : date absente du miroir`);
        const mirrorResponse = await context.request.get(`${origin}${route}.md`);
        assert.equal(mirrorResponse.status(), 200, `${route} : miroir inaccessible`);
        assert.equal(await mirrorResponse.text(), markdown, `${route} : corps du miroir servi`);
        mirrors++;
      }
      if (route === "/") {
        // Accueil interactif : un module local pour les simulateurs et le mouvement.
        // Le contenu et les valeurs initiales sont déjà vérifiés sans JavaScript.
        assert.equal(html.scripts.length, 1, `${route} : module de landing unique`);
        assert(html.scripts[0].src, `${route} : module de landing externe attendu`);
        assert.equal(html.activeAttributes, false, `${route} : JavaScript dans les attributs HTML`);
      } else if (
        ["/comparateur-assurance-maladie-2027", "/suivi-demande-assurance"].includes(route)
      ) {
        // Comparison and private tracking each require one hydrated island; editorial gates stay strict.
        assert.equal(html.islands.length, 1, `${route} : îlot interactif unique`);
        assert.equal(html.scripts.length, 2, `${route} : runtime Astro uniquement`);
        assert(
          html.scripts.every((script) => !script.src && script.body.includes("Astro")),
          `${route} : scripts Astro attendus`,
        );
        for (const asset of [html.islands[0].component, html.islands[0].renderer]) {
          assert(asset && files.has(asset), `${route} : îlot absent du build local`);
        }
        assert.equal(html.activeAttributes, false, `${route} : JavaScript dans les attributs HTML`);
      } else if (route !== "/account") {
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
    assert.equal(mirrors, sources.size, "Chaque contenu de préversion possède HTML et miroir");
    let localLinks = 0;
    let localAnchors = 0;
    const edges = new Map(routes.map((route) => [route, new Set()]));
    for (const [route, html] of pages) {
      for (const href of html.links) {
        assert(!/^(?:javascript|data):/i.test(href.trim()), `${route} : lien actif interdit`);
        const url = new URL(href, `${origin}${route}`);
        if (![origin, "https://coverview.ch"].includes(url.origin)) continue;
        const pathname = decodeURIComponent(url.pathname);
        const target = pathname.replace(/\/$/, "") || "/";
        assert(files.has(pathname) || pages.has(target), `${route} : lien local absent ${href}`);
        localLinks++;
        if (pages.has(target)) {
          edges.get(route).add(target);
          if (url.hash) {
            assert(
              pages.get(target).ids.includes(decodeURIComponent(url.hash.slice(1))),
              `${route} : ancre locale absente ${href}`,
            );
            localAnchors++;
          }
        }
      }
    }
    const reachable = new Set(["/"]);
    const queue = ["/"];
    for (const route of queue) {
      for (const target of edges.get(route)) {
        if (reachable.has(target)) continue;
        reachable.add(target);
        queue.push(target);
      }
    }
    assert.deepEqual(
      routes.filter((route) => !reachable.has(route)),
      [],
      "Pages orphelines depuis l'accueil",
    );
    for (const path of ["/sitemap.xml", "/feed.xml"]) {
      const validXml = await page.evaluate(
        (xml) =>
          !new DOMParser().parseFromString(xml, "application/xml").querySelector("parsererror"),
        files.get(path).toString(),
      );
      assert(validXml, `${path} : XML invalide`);
      assert.equal((await context.request.get(`${origin}${path}`)).status(), 200, path);
    }
    assert.equal((await page.goto(`${origin}/page-absente-build-check`)).status(), 404);
    return {
      pages: routes.length,
      landingExecutableScripts: pages.get("/").scripts.length,
      comparatorIslands: pages.get("/comparateur-assurance-maladie-2027")?.islands.length ?? 0,
      otherEditorialExecutableScripts: 0,
      inlineGzipBytes,
      real404: true,
      mirrors,
      structuredEntities,
      localLinks,
      localAnchors,
      orphanPages: 0,
    };
  } finally {
    await context.close();
  }
}

async function measurePage(browser, origin, route, files) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const unexpected = [];
  const page = await context.newPage();
  const requestedScripts = new Set();
  page.on("request", (request) => {
    if (request.resourceType() === "script") requestedScripts.add(new URL(request.url()).pathname);
  });
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
      // Une image différée hors écran ne participe pas au rendu initial et peut
      // attendre indéfiniment son intersection avant de commencer son chargement.
      await Promise.all(
        [...document.images]
          .filter((image) => image.loading !== "lazy")
          .map((image) => image.decode()),
      );
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
    // MKT-06 borne le JavaScript chargé par gabarit, pas les chunks inutilisés
    // que les intégrations Astro peuvent émettre pour d’autres pages.
    let javascriptGzipBytes = 0;
    for (const path of requestedScripts) {
      assert(files.has(path), `${route} : script chargé absent du build ${path}`);
      javascriptGzipBytes += gzipSync(files.get(path)).length;
    }
    const inlineScripts = await page.evaluate(() =>
      [...document.scripts]
        .filter(
          (script) =>
            !script.src && !["application/ld+json", "application/json"].includes(script.type),
        )
        .map((script) => script.textContent),
    );
    for (const body of inlineScripts) javascriptGzipBytes += gzipSync(body).length;
    assert(
      javascriptGzipBytes < limits.javascriptGzipBytes,
      `${route} : budget JavaScript chargé ${javascriptGzipBytes} octets gzip`,
    );
    if (route === "/") {
      // Régression observée : une animation d’ouverture gelée à opacity:0
      // rendait le dialogue invisible après activation du bouton pause.
      await page
        .getByRole("button", { name: "Mettre les animations en pause", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Analyser mon 3e pilier", exact: true })
        .first()
        .click();
      const dialog = page.getByRole("dialog", { name: "Commençons par vous." });
      assert(await dialog.isVisible(), "Dialogue invisible avec les animations en pause");
      assert.equal(
        await dialog.evaluate((element) => window.getComputedStyle(element).opacity),
        "1",
      );
      await page.keyboard.press("Escape");
      assert.equal(await dialog.count(), 0, "Échap doit fermer le dialogue");
    }
    return {
      route,
      javascriptGzipBytes,
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
  const publicCopy = checkPublicCopy(files);
  const indexes = checkIndexes(files);
  const hosted = await serve(files);
  server = hosted.server;
  browser = await chromium.launch({ timeout: 15000 });
  const html = await checkHtml(browser, files, hosted.origin);
  const jsFiles = [...files].filter(([path]) => [".js", ".mjs", ".cjs"].includes(extname(path)));
  const javascriptGzipBytes = jsFiles.reduce(
    (sum, [, body]) => sum + gzipSync(body).length,
    html.inlineGzipBytes,
  );
  const synthetic = [];
  for (const route of representatives)
    synthetic.push(await measurePage(browser, hosted.origin, route, files));
  console.log(
    JSON.stringify({
      status: "passed",
      html,
      publicCopy,
      indexes,
      javascript: {
        emittedFiles: jsFiles.length,
        emittedGzipBytes: javascriptGzipBytes,
        budgetScope: "JavaScript effectivement chargé par page représentative",
      },
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
