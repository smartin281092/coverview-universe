import { test, expect } from "@playwright/test";

test("les services réels sont prêts et le site ouvre Wallet et l'espace équipe", async ({
  page,
  request,
}) => {
  const health = await request.get("http://127.0.0.1:4100/health/ready");
  expect(health.status()).toBe(200);
  await page.goto("http://127.0.0.1:4103");
  await expect(page.locator("h1")).toBeVisible();
  const wallet = page.locator('a[href="http://127.0.0.1:4101"]').first();
  const admin = page.locator('a[href="http://127.0.0.1:4102"]').first();
  await expect(wallet).toBeVisible();
  await expect(admin).toBeVisible();
  await page.screenshot({ path: ".preview/www.png", fullPage: true });
  await wallet.click();
  await expect(page.getByRole("heading", { name: "Votre Wallet commence ici." })).toBeVisible();
});

for (const [app, port] of [
  ["client", 4101],
  ["admin", 4102],
]) {
  test(`${app} : clavier, état vide, santé et deux personas persistées`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Aller au contenu" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await expect(page.getByText("API disponible", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Aucun (contrat|dossier)/ })).toBeVisible();
    await page.screenshot({ path: `.preview/${app}.png`, fullPage: true });
    await page.getByRole("navigation").getByRole("link", { name: "Profils fictifs" }).click();
    await expect(page.getByRole("radio")).toHaveCount(2);
    await page.getByRole("radio").first().focus();
    await page.keyboard.press("Space");
    await expect(page.getByRole("radio").first()).toBeChecked();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio").last()).toBeChecked();
    await expect(page.getByRole("status")).toContainText("Profil affiché");
    await page.goto(`http://127.0.0.1:${port}/introuvable`);
    await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`${app} : échec réseau visible puis reprise par le bouton`, async ({ page }) => {
    // Faute réseau injectée pour l'interface, distincte du contrôle des vrais services ci-dessus.
    await page.route("**/health/ready", (route) => route.abort("connectionrefused"));
    await page.goto(`http://127.0.0.1:${port}`);
    await expect(page.getByRole("heading", { name: "API indisponible" })).toBeVisible();
    await page.screenshot({ path: `.preview/${app}-error.png`, fullPage: true });
    await page.unroute("**/health/ready");
    await page.getByRole("button", { name: "Réessayer", exact: true }).click();
    await expect(page.getByText("API disponible", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `.preview/${app}-mobile.png`, fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
