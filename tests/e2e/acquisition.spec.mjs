import { test, expect } from "@playwright/test";

const origin = "http://127.0.0.1:4103";
const entryPaths = ["/analyser-3p", "/calculer-retraite", "/comparer"];

async function tabTo(page, locator) {
  for (let attempt = 0; attempt < 35; attempt++) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(locator).toBeFocused();
}

test("sans JavaScript : exemple fictif, trois parcours suivis et disponibilité avant toute identification", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    expect((await page.goto(origin)).status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/retraite/i);
    const main = page.getByRole("main");
    await expect(main).toContainText(/exemple fictif/i);
    await expect(main).toContainText(/aucune estimation personnelle/i);
    for (const metric of ["65 ans", "71 ans", "+6 ans"])
      await expect(main.getByText(metric, { exact: true })).toBeVisible();
    for (const href of entryPaths.slice(0, 2))
      await expect(main.locator(`a[href="${href}"]`).first()).toBeVisible();
    await expect(main.locator("form, input, textarea")).toHaveCount(0);
    await main.locator('a[href="/overview"]').click();
    await expect(page).toHaveURL(`${origin}/overview`);
    await expect(main).toContainText(/même profil/i);
    await expect(main).toContainText(/mêmes moteurs/i);

    for (const href of entryPaths) {
      await page.goto(`${origin}/overview`);
      const entry = main.locator(`a[href="${href}"]`);
      await expect(entry).toBeVisible();
      const response = await Promise.all([page.waitForNavigation(), entry.click()]);
      expect(response[0].status()).toBe(200);
      await expect(page).toHaveURL(`${origin}${href}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(main).toContainText(/(?:n[’']est|ne sont) pas encore disponibles?/i);
      await expect(main).toContainText(/aucun résultat personnel n[’']est enregistré/i);
      await expect(main.locator("form, input, textarea")).toHaveCount(0);
      await expect(
        main.getByRole("link", { name: /se connecter|rendez-vous|s[’']inscrire/i }),
      ).toHaveCount(0);
      await expect(main.locator(`a[href="${href}"]`)).toBeVisible();
      await main.locator('a[href="/overview"]').click();
      await expect(page).toHaveURL(`${origin}/overview`);
    }
  } finally {
    await context.close();
  }
});

test("l’explorateur couvre les destinations produit avec des pages, metadata uniques et une vraie 404", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/explorer`);
    const navigation = page.getByRole("navigation", { name: "Toutes les destinations CoverView" });
    // Oracle éditorial : catégories de la bible §66, sans importer l’inventaire implémenté.
    for (const name of [
      /^Accueil/,
      /Comment ça marche/,
      /Analyser mon 3P/,
      /Calculer ma retraite/,
      /^Comparer/,
      /Retrouver mes avoirs LPP/,
      /Récupérer mes contrats/,
      /^Services/,
      /méthode/i,
      /^Benchmark/,
      /Études de cas/,
      /^Rapports/,
      /Sébastien Martin/,
      /Articles.*FAQ/,
      /^Contact/,
      /Wallet/,
      /Sauvegarde.*favoris.*partage/,
      /Procurations.*signature/,
      /Miles.*avantages/,
      /Carte digitale/,
      /CoverView Partners/,
      /CoverView Intelligence/,
      /CoverView Exchange/,
    ])
      await expect(navigation.getByRole("link", { name })).toBeVisible();

    const destinations = await navigation.getByRole("link").evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href"),
        planned: /en préparation/i.test(link.textContent),
      })),
    );
    expect(new Set(destinations.map(({ href }) => href)).size).toBe(destinations.length);
    // Seules ces lectures et la continuité du compte appartiennent au périmètre livré.
    // Une étiquette de disponibilité manquante ne doit pas retirer son propre oracle.
    const readableEntries = new Set([
      "/",
      "/overview",
      "/methode",
      "/sebastien-martin",
      "/account",
    ]);
    for (const { href, planned } of destinations)
      expect(planned, `Disponibilité annoncée : ${href}`).toBe(!readableEntries.has(href));
    const routes = [
      ...destinations,
      { href: "/explorer", planned: false },
      { href: "/demonstration", planned: false },
    ];
    const titles = new Set();
    const descriptions = new Set();
    for (const { href, planned } of routes) {
      expect(href).toMatch(/^\/(?:[a-z0-9-]+)?$/);
      const response = await page.goto(`${origin}${href}?utm_source=e2e&returnTo=private`);
      expect(response.status(), href).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      const title = await page.title();
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(title.length, href).toBeGreaterThan(10);
      expect(description.length, href).toBeGreaterThan(30);
      expect(titles.has(title), `Titre dupliqué : ${href}`).toBe(false);
      expect(descriptions.has(description), `Description dupliquée : ${href}`).toBe(false);
      titles.add(title);
      descriptions.add(description);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `https://coverview.ch${href}`,
      );
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        `https://coverview.ch${href}`,
      );
      await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
        "content",
        description,
      );
      if (planned) {
        await expect(page.getByRole("main")).toContainText(/en préparation/i);
        await expect(page.getByRole("main").locator("form, input, textarea")).toHaveCount(0);
      }
    }
    const missing = await page.goto(`${origin}/page-inexistante-s010`);
    expect(missing.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/introuvable/i);
    await page.getByRole("main").locator('a[href="/"]').click();
    await expect(page).toHaveURL(`${origin}/`);
  } finally {
    await context.close();
  }
});

test("clavier : accès au contenu, détails sur leur page et retour focalisé sans expansion", async ({
  page,
}) => {
  await page.goto(origin);
  await page.waitForFunction(() => document.fonts.status === "loaded");
  const main = page.getByRole("main");
  const height = (await main.boundingBox()).height;
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(main).toBeFocused();
  const details = main.locator('a[href="/demonstration"]');
  await tabTo(page, details);
  await expect(details).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${origin}/demonstration`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(main).toContainText(/ficti[fv]/i);
  await page.goBack();
  await expect(details).toBeVisible();
  await expect(main).toBeVisible();
  await details.click();
  const back = main.locator('a[href="/#demo-details"]');
  await tabTo(page, back);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`${origin}/#demo-details`);
  await expect(details).toBeFocused();
  await page.waitForFunction(() => document.fonts.status === "loaded");
  expect(Math.abs((await main.boundingBox()).height - height)).toBeLessThanOrEqual(2);
});

test("mobile et reflow : contenu et navigation accessibles à 320, 390 et 640 pixels CSS", async ({
  page,
}, testInfo) => {
  // 640 px CSS représente le reflow d’un bureau 1280 px à zoom 200 % ; ce test
  // n’actionne pas le zoom natif du navigateur et ne prouve pas son réglage.
  for (const width of [320, 390, 640]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/", "/overview", "/explorer", "/demonstration", "/analyser-3p"]) {
      await page.goto(`${origin}${path}`);
      await page.waitForFunction(() => document.fonts.status === "loaded");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${path} à ${width} px`,
      ).toBe(true);
      if (path === "/") {
        await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
        const explorer = page
          .getByRole("navigation", { name: "Navigation principale" })
          .locator('a[href="/explorer"]');
        await expect(explorer).toBeVisible();
        await explorer.click();
        await expect(page).toHaveURL(`${origin}/explorer`);
      }
    }
  }
});

test("lecture publique : aucune requête API, collecte, stockage ou tiers hors de la page compte", async ({
  page,
  context,
}) => {
  test.setTimeout(60000);
  const unexpectedRequests = [];
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.origin !== origin ||
      request.method() !== "GET" ||
      ["fetch", "xhr", "ping"].includes(request.resourceType()) ||
      /^(?:\/api|\/identity|\/auth|\/collect|\/events)(?:\/|$)/.test(url.pathname)
    )
      unexpectedRequests.push(`${request.method()} ${request.url()}`);
  });
  await page.goto(`${origin}/explorer`);
  const routes = await page
    .getByRole("navigation", { name: "Toutes les destinations CoverView" })
    .getByRole("link")
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  for (const path of [...new Set([...routes, "/demonstration"])].filter(
    (path) => path !== "/account",
  )) {
    await page.goto(`${origin}${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => ({
        local: Object.entries(localStorage),
        session: Object.entries(sessionStorage),
      })),
      path,
    ).toEqual({ local: [], session: [] });
    expect(await context.cookies(), path).toEqual([]);
  }
  expect(context.serviceWorkers()).toEqual([]);
  expect(unexpectedRequests).toEqual([]);
  expect(errors).toEqual([]);
});
