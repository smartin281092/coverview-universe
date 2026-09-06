import { test, expect } from "@playwright/test";

const origin = "http://127.0.0.1:4103";

async function tabTo(page, locator) {
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(locator).toBeFocused();
}

test("articles : pagination, retour et focus sans JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(`${origin}/articles`);
    const firstLinks = await page
      .getByRole("main")
      .locator("article h2 a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(firstLinks).toHaveLength(2);
    const pagination = page.getByRole("navigation", { name: /pagination/i });
    await pagination.locator('a[href="/articles/page/2"]').click();
    await expect(page).toHaveURL(`${origin}/articles/page/2`);
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
  } finally {
    await context.close();
  }
});
