import { expect, test } from "@playwright/test";

/** The guest menu demo: three styles, sold-out handling, dish sheet with modifiers, order. */
test.describe("guest menu demo", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/es/demo");
    await page.evaluate(() => document.fonts.ready);
  });

  test("shows the three styles", async ({ page }, info) => {
    const p = info.project.name;
    await page.screenshot({ path: `docs/screenshots/menu-house.${p}.light.png`, fullPage: true });

    await page.getByRole("button", { name: "Original", exact: true }).click();
    await page.getByRole("button", { name: "Ver zonas tocables" }).click();
    await page.screenshot({ path: `docs/screenshots/menu-original.${p}.light.png`, fullPage: true });

    await page.getByRole("button", { name: "Simple", exact: true }).click();
    await page.screenshot({ path: `docs/screenshots/menu-simple.${p}.light.png`, fullPage: true });
  });

  test("sold-out dishes can't be ordered", async ({ page }) => {
    const flan = page.getByRole("button", { name: /Flan de queso/ });
    await expect(flan).toHaveAttribute("aria-disabled", "true");
    await flan.click({ force: true });
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("a dish with modifiers goes into the order at the right price", async ({ page }, info) => {
    await page
      .getByRole("button", { name: /Café con leche/ })
      .first()
      .click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await sheet.getByLabel(/Avena/).check();
    await sheet.getByRole("button", { name: "Añadir uno" }).click();
    await page.screenshot({ path: `docs/screenshots/menu-sheet.${info.project.name}.light.png` });
    await sheet.getByRole("button", { name: /Añadir al pedido · \$6\.50/ }).click();
    await expect(page.getByRole("button", { name: /Ver pedido \(2\) · \$6\.50/ })).toBeVisible();

    await page
      .getByRole("region", { name: "Café Lucía" })
      .getByRole("button", { name: "en", exact: true })
      .click();
    await expect(page.getByRole("button", { name: /View order \(2\)/ })).toBeVisible();
  });
});
