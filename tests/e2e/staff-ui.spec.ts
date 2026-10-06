import { expect, test } from "@playwright/test";
import { app, email, guestUrl, login } from "./helpers";

test.describe("staff interface pass", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "tablet/desktop layout"));

  test("grouped side menu; theme and language in Ajustes", async ({ page }) => {
    await login(page, email("dueno"), `${app()}`);
    const nav = page.getByRole("navigation", { name: "Navegación del restaurante" });
    await expect(nav.locator("span[aria-hidden]").filter({ hasText: /./ })).toHaveText([
      "Operación",
      "Menú",
      "Negocio",
      "Administración",
    ]);
    // Theme and language live in Ajustes → Preferencias.
    await page.goto(`${app()}/ajustes`);
    const prefs = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Preferencias" }) });
    await prefs.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: "Oscuro" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({ path: "docs/screenshots/app-ajustes.desktop.dark.png", fullPage: true });
    await prefs.getByRole("radiogroup", { name: "Idioma" }).getByRole("radio", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    const prefsEn = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Preferences" }) });
    await prefsEn
      .getByRole("radiogroup", { name: "Language" })
      .getByRole("radio", { name: "Español" })
      .click();
    await expect(page.getByRole("heading", { name: "Ajustes", level: 1 })).toBeVisible();
    await prefs.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: "Auto" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /./);
  });

  test("Servicio shows today's orders by status", async ({ page }) => {
    await login(page, email("mesero"), `${app()}/servicio`);
    const strip = page.getByRole("region", { name: "Órdenes de hoy" });
    await expect(strip).toBeVisible();
    await strip.getByRole("tab", { name: /Servidas/ }).click();
    await expect(strip.getByRole("tab", { name: /Servidas/ })).toHaveAttribute("aria-selected", "true");
    await page.screenshot({ path: "docs/screenshots/app-service.desktop.light.png", fullPage: true });
  });

  test("Mesas is a floor plan the owner can rearrange", async ({ page }) => {
    await login(page, email("dueno"), `${app()}/ajustes`);
    const editor = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Plano de mesas" }) });
    const table1 = editor.getByRole("button", { name: /^Mesa 1:/ });
    await table1.click();
    await table1.press("ArrowRight");
    await table1.press("Shift+ArrowDown");
    await editor.getByLabel("Forma").selectOption("round");
    await editor.getByRole("button", { name: "Guardar plano" }).click();
    await expect(editor.getByText("Guardado.")).toBeVisible({ timeout: 15_000 });

    await page.goto(`${app()}/mesas`);
    await expect(page.getByRole("list", { name: /^Plano/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Leyenda" })).toContainText("Atención");
    await page.screenshot({ path: "docs/screenshots/app-tables.desktop.light.png", fullPage: true });
  });

  test("dish tags show on the guest menu", async ({ browser }) => {
    const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await guest.goto(guestUrl(11));
    await guest.waitForLoadState("networkidle");
    await guest.getByRole("button", { name: "es", exact: true }).click();
    await guest.getByRole("button", { name: "Simple", exact: true }).click();
    await expect(guest.getByRole("button", { name: /^Avena/ }).getByText("Vegetariano")).toBeVisible();
    await expect(guest.getByRole("button", { name: /Tema:/ })).toBeVisible();
  });
});

test.describe("navigation at every size", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "sizes are set per test"));

  test("phone: drawer menu and a bottom bar of main screens", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, email("mesero"), `${app()}/servicio`);
    const quick = page.getByRole("navigation", { name: "Accesos rápidos" });
    await expect(quick.getByRole("link")).toHaveText(["Servicio", "Tomar orden", "Mesas"]);
    await page.screenshot({ path: "docs/screenshots/nav.phone.light.png" });
    await page.getByRole("button", { name: "Abrir menú" }).click();
    const nav = page.getByRole("navigation", { name: "Navegación del restaurante" });
    await expect(nav.getByRole("link", { name: "Mesas" })).toBeVisible();
    await page.waitForTimeout(300); // let the drawer finish sliding in
    await page.screenshot({ path: "docs/screenshots/nav-drawer.phone.light.png" });
    await page.keyboard.press("Escape");
    await expect(nav.getByRole("link", { name: "Mesas" })).toBeHidden();
    await quick.getByRole("link", { name: "Mesas" }).click();
    await expect(page).toHaveURL(/\/mesas$/);
  });

  test("tablet: icon rail, no top tab bar", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await login(page, email("dueno"), `${app()}`);
    const nav = page.getByRole("navigation", { name: "Navegación del restaurante" });
    await expect(nav.getByRole("link", { name: "Reportes" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Accesos rápidos" })).toBeHidden();
    const box = await nav.boundingBox();
    expect(box!.width).toBeLessThan(110);
    await page.screenshot({ path: "docs/screenshots/nav.tablet.light.png" });
  });
});

test("the sidebar never scrolls sideways", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "sizes are set here");
  await login(page, email("dueno"), `${app()}`);
  for (const width of [1280, 1024, 820]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.locator("#app-drawer").evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, `sidebar at ${width}px`).toBeLessThanOrEqual(0);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: "docs/screenshots/nav.desktop.light.png" });
});
