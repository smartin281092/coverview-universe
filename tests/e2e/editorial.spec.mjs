import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const origin = "http://127.0.0.1:4103";
const editorialPaths = [
  "/vision",
  "/methode",
  "/services",
  "/modeles",
  "/benchmark",
  "/outils",
  "/contact",
  "/retire",
  "/miles",
  "/sources",
  "/glossaire",
  "/sebastien-martin",
  "/etudes-de-cas/maintien",
  "/etudes-de-cas/comparaison",
  "/rapports/exemple",
];

// Oracle tiré de la bible §25 (p0623–p0674), indépendant du catalogue rendu.
const modelRows = [
  ["Accès à plusieurs solutions", "Limité", "Oui", "Oui"],
  [
    "Analyse du contrat actuel",
    "Variable",
    "Variable",
    "Systématique lorsque les données le permettent",
  ],
  ["Benchmark du marché", "Rare", "Variable", "Structuré et documenté"],
  ["Analyse des performances", "Rare", "Variable", "Oui"],
  ["Analyse des frais", "Partielle", "Oui", "Détaillée et historisée"],
  ["Analyse de l’allocation", "Rare", "Variable", "Oui"],
  ["Rapport comparatif", "Rare", "Rare", "Oui"],
  ["Suivi périodique", "Variable", "Variable", "Structuré"],
  ["Réévaluation", "Variable", "Variable", "Oui"],
  ["Outils numériques", "Variable", "Variable", "Wallet + moteurs + automatisations"],
  ["Approche data", "Rare", "Rare", "Centrale"],
  ["Centralisation du portefeuille", "Non", "Rare", "Wallet"],
];
const caseHeadings = ["Situation initiale", "Analyse", "Benchmark", "Décision", "Résultat"];
const reportHeadings = [
  "Situation et objectifs",
  "Inventaire des contrats",
  "Frais et valeurs",
  "Allocation et fonds",
  "Performance, risque et diversification",
  "Garanties et protections",
  "Benchmark",
  "Projection retraite et inflation",
  "Alternatives et recommandations",
  "Hypothèses, sources et prochaines actions",
];

function evidence(name) {
  return fileURLToPath(new URL(`../../roadmap/evidence/S-011-${name}.png`, import.meta.url));
}

async function tabTo(page, locator) {
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(locator).toBeFocused();
}

test("lecture éditoriale sans JavaScript : provenance, dates et miroirs accessibles", async ({
  browser,
}) => {
  test.setTimeout(60000);
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const path of editorialPaths) {
      expect((await page.goto(`${origin}${path}`)).status(), path).toBe(200);
      const main = page.getByRole("main");
      await expect(main.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(main.locator("article")).toHaveCount(1);
      await expect(main).toContainText(/source/i);
      await expect(main).toContainText(/CoverView/);
      const dates = main.locator("time[datetime]");
      await expect(dates).toHaveCount(2);
      for (const date of await dates.all()) {
        await expect(date).toBeVisible();
        expect(await date.getAttribute("datetime"), path).toMatch(/^\d{4}-\d{2}-\d{2}/);
      }
      const mirror = page.locator('link[rel="alternate"][type="text/markdown"]');
      await expect(mirror).toHaveCount(1);
      const mirrorPath = new URL(await mirror.getAttribute("href"), origin).pathname;
      expect(mirrorPath, path).toBe(`${path}.md`);
      const response = await context.request.get(`${origin}${mirrorPath}`);
      expect(response.status(), mirrorPath).toBe(200);
      const markdown = await response.text();
      expect(markdown, path).toContain(`https://coverview.ch${path}`);
      for (const heading of await main.locator("article h2").allTextContents())
        expect(markdown, `${path} : titre absent du miroir`).toContain(heading.trim());
      await expect(main.locator("form, input, textarea")).toHaveCount(0);
    }
    for (const [path, unavailable] of [
      [
        "/contact",
        /demandes de rendez-vous, de rappel et de validation experte ne sont pas encore ouvertes/i,
      ],
      ["/retire", /Retire Check et le plan retraite ne sont pas encore disponibles/i],
      ["/miles", /n[’']est pas encore actif.*aucun Mile ni avantage n[’']est attribué/i],
    ]) {
      await page.goto(`${origin}${path}`);
      await expect(page.getByRole("main")).toContainText(unavailable);
      await expect(page.getByRole("main").locator("form, input, textarea")).toHaveCount(0);
    }
  } finally {
    await context.close();
  }
});

test("comparaison complète : douze dimensions, quatre colonnes et tendances qualifiées", async ({
  page,
}) => {
  await page.goto(`${origin}/modeles`);
  const main = page.getByRole("main");
  const table = main.getByRole("table");
  await expect(table).toHaveCount(1);
  await expect(table.locator("thead th")).toHaveText([
    "Service",
    "Agent de compagnie",
    "Courtier traditionnel",
    "CoverView",
  ]);
  expect(
    await table
      .locator("tbody tr")
      .evaluateAll((rows) =>
        rows.map((row) =>
          [...row.querySelectorAll("th, td")].map((cell) => cell.textContent.trim()),
        ),
      ),
  ).toEqual(modelRows);
  await expect(main).toContainText(/tendances|habituelles/i);
  await expect(main).toContainText(
    /pas une affirmation sur chaque|pas.*(?:tous|universel)|ni une garantie.*universel/i,
  );
  await expect(main).toContainText(/prévu|cible|visé/i);
  await page.screenshot({ path: evidence("modeles-desktop"), fullPage: true });

  for (const width of [320, 390, 640]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForFunction(() => document.fonts.status === "loaded");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${width} px`,
    ).toBe(true);
    expect(
      await table
        .locator("tbody tr")
        .evaluateAll((rows) =>
          rows.map((row) =>
            [...row.querySelectorAll("th, td")].map((cell) => cell.textContent.trim()),
          ),
        ),
      `${width} px : toutes les valeurs conservées`,
    ).toEqual(modelRows);
    const scroll = table.locator("..");
    await expect(scroll).toHaveAttribute("tabindex", "0");
    await expect(scroll).toHaveAttribute("role", "region");
    expect(
      (await scroll.getAttribute("aria-label")) || (await scroll.getAttribute("aria-labelledby")),
    ).toBeTruthy();
    expect(
      await table.locator("th, td").evaluateAll((cells) =>
        cells.every((cell) => {
          const box = cell.getBoundingClientRect();
          const style = getComputedStyle(cell);
          return (
            box.width > 0 &&
            box.height > 0 &&
            style.visibility !== "hidden" &&
            style.textOverflow !== "ellipsis"
          );
        }),
      ),
    ).toBe(true);
    expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
      true,
    );
    await page.goto(`${origin}/modeles`);
    await tabTo(page, scroll);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => scroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    if (width === 390) {
      await scroll.evaluate((element) => {
        element.scrollLeft = 0;
      });
      await page.screenshot({ path: evidence("modeles-mobile"), fullPage: true });
    }
  }
});

test("cas et rapport fictifs : décisions traçables et structure intégrale de la source", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const [path, headings] of [
      ["/etudes-de-cas/maintien", caseHeadings],
      ["/etudes-de-cas/comparaison", caseHeadings],
      ["/rapports/exemple", reportHeadings],
    ]) {
      await page.goto(`${origin}${path}`);
      const article = page.getByRole("main").locator("article");
      await expect(article.locator("h2")).toHaveText(headings);
      await expect(page.getByRole("main")).toContainText(/ficti[fv]/i);
      if (path.endsWith("maintien")) await expect(article).toContainText(/maintien|conserver/i);
      await expect(article).not.toContainText(/rendement garanti|témoignage client/i);
      await expect(article.locator('a[href*="instagram.com"]')).toHaveCount(0);
    }
    await page.screenshot({ path: evidence("rapport-desktop"), fullPage: true });
    await page.goto(`${origin}/etudes-de-cas/maintien`);
    await page.screenshot({ path: evidence("cas-maintien-desktop"), fullPage: true });
  } finally {
    await context.close();
  }
});

test("index bornés : vraie pagination sans JavaScript, URL propre et accès aux articles", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const path of ["/articles", "/etudes-de-cas", "/rapports"]) {
      await page.goto(`${origin}${path}`);
      const count = await page.getByRole("main").locator("article").count();
      expect(count, path).toBeGreaterThan(0);
      expect(count, path).toBeLessThanOrEqual(2);
      await expect(page.getByRole("main").locator("details")).toHaveCount(0);
    }
    await page.goto(`${origin}/articles`);
    const firstLinks = await page
      .getByRole("main")
      .locator("article h2 a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(firstLinks).toHaveLength(2);
    const pagination = page.getByRole("navigation", { name: /pagination/i });
    await pagination.locator('a[href="/articles/page/2"]').click();
    await expect(page).toHaveURL(`${origin}/articles/page/2`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://coverview.ch/articles/page/2",
    );
    const secondLinks = await page
      .getByRole("main")
      .locator("article h2 a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(secondLinks.length).toBeGreaterThan(0);
    expect(secondLinks.length).toBeLessThanOrEqual(2);
    expect(secondLinks.filter((link) => firstLinks.includes(link))).toEqual([]);
    const articleLink = page.getByRole("main").locator("article h2 a").first();
    await tabTo(page, articleLink);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`${origin}${secondLinks[0]}`);
    await expect(page.getByRole("main").locator("article")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(`${origin}/articles/page/2`);
    await expect(articleLink).toBeVisible();
    await articleLink.click();
    const returnPath = "/articles/page/2#article-articles-questions-frequentes";
    const returnLink = page.getByRole("main").locator(`a[href="${returnPath}"]`);
    await tabTo(page, returnLink);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(`${origin}${returnPath}`);
    await expect(articleLink).toBeFocused();
    await page
      .getByRole("navigation", { name: /pagination/i })
      .locator('a[href="/articles"]')
      .click();
    await expect(page).toHaveURL(`${origin}/articles`);
    await page.screenshot({ path: evidence("articles-desktop"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.fonts.status === "loaded");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: evidence("articles-mobile"), fullPage: true });
    expect((await page.goto(`${origin}/articles/page/999`)).status()).toBe(404);
  } finally {
    await context.close();
  }
});

test("méthode et personne : six étapes, sept thèmes sourcés et aucune identité sociale inventée", async ({
  page,
}) => {
  await page.goto(`${origin}/methode`);
  const main = page.getByRole("main");
  for (const step of [
    "Analyse",
    "Benchmark",
    "Stratégie",
    "Mise en œuvre",
    "Suivi",
    "Réévaluation",
  ])
    await expect(main).toContainText(step);
  await main.locator('a[href="/sebastien-martin"]').first().click();
  await expect(page).toHaveURL(`${origin}/sebastien-martin`);
  await expect(main.locator("[data-editorial-body] > ul > li")).toHaveText([
    /développement.*ingénierie.*applications/i,
    /produit.*UX.*systèmes/i,
    /finance.*années 2020/i,
    /assurance.*prévoyance/i,
    /opacité.*suivi/i,
    /création.*CoverView/i,
    /Instagram.*(?:fourni|vérifiable)/i,
  ]);
  await expect(main).toContainText(/bible|source/i);
  await expect(main).toContainText(
    /non.*(?:fourni|validé)|aucun.*(?:validé|fourni)|pas.*(?:fourni|validé)/i,
  );
  await expect(main.locator('a[href*="instagram.com"]')).toHaveCount(0);
  await expect(main.locator("form, input, textarea")).toHaveCount(0);
});
