import { expect, test, type Page } from "@playwright/test";
import { app, email, guestUrl, login } from "./helpers";

async function setPrice(page: Page, dish: string, price: string) {
  await page.getByRole("button", { name: `Editar ${dish}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Precio en dólares").fill(price);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("status").filter({ hasText: "Cambios guardados" })).toBeVisible();
}

test.describe("menu editor", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "editor flow runs once"));

  test("a manager changes a price and the preview and guest menu show it", async ({ page, browser }) => {
    test.setTimeout(90_000);
    await login(page, email("gerente"), `${app()}/menu`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "docs/screenshots/app-menu-editor.desktop.light.png", fullPage: true });

    const preview = page.getByRole("complementary", { name: "Vista previa" });
    await preview.getByRole("button", { name: "Simple", exact: true }).click();
    // Change the price, see it in the preview, then put the seed price back.
    await setPrice(page, "Café negro", "1.95");
    await expect(preview.getByRole("button", { name: /^Café negro/ })).toContainText("$1.95");

    // The guest at a table sees the new price too.
    const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await guest.goto(guestUrl(5)); // Mesa 12 is the one the QR test rotates
    await guest.waitForLoadState("networkidle");
    await guest.getByRole("button", { name: "Simple", exact: true }).click();
    await expect(guest.getByRole("button", { name: /^Café negro/ })).toContainText("$1.95");

    await setPrice(page, "Café negro", "1.75"); // put the seed back
    await expect(preview.getByRole("button", { name: /^Café negro/ })).toContainText("$1.75");
  });

  test("marking a dish sold out shows it in the preview", async ({ page }) => {
    await login(page, email("gerente"), `${app()}/menu`);
    await page.waitForLoadState("networkidle");
    const preview = page.getByRole("complementary", { name: "Vista previa" });
    await preview.getByRole("button", { name: "Simple", exact: true }).click();

    await page.getByRole("button", { name: "Malta: agotado" }).click();
    await expect(preview.getByRole("button", { name: /^Malta/ })).toHaveAttribute("aria-disabled", "true");
    await page.getByRole("button", { name: "Malta: agotado" }).click();
    await expect(preview.getByRole("button", { name: /^Malta/ })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  test("a bad price says how to fix it", async ({ page }) => {
    await login(page, email("gerente"), `${app()}/menu`);
    await page.getByRole("button", { name: "Editar Malta" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Precio en dólares").fill("dos pesos");
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByRole("alert")).toContainText("por ejemplo 3.50");
  });
});
