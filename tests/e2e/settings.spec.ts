import { expect, test } from "@playwright/test";
import { guestUrl, login } from "./helpers";

test.describe("team, settings, plan and admin", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "one run is enough"));

  test("the owner invites a server, then deactivates them", async ({ page }) => {
    await login(page, "dueno@cafelucia.example", "/app/cafe-lucia/equipo");
    await expect(page.getByRole("heading", { name: "Equipo", level: 1 })).toBeVisible();
    const email = `mesero-${Date.now()}@cafelucia.example`;
    const invite = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "Enviar invitación" }) });
    await invite.getByLabel("Nombre").fill("Pedro Prueba");
    await invite.getByLabel("Correo electrónico").fill(email);
    await invite.getByLabel("Rol").selectOption("server");
    await invite.getByRole("button", { name: "Enviar invitación" }).click();
    await expect(page.getByText("Invitación enviada.")).toBeVisible({ timeout: 20_000 });

    const row = page.getByRole("listitem").filter({ hasText: email });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Desactivar" }).click();
    await expect(row.getByText("Inactivo")).toBeVisible({ timeout: 10_000 });
    await page.screenshot({ path: "docs/screenshots/app-team.desktop.light.png", fullPage: true });
  });

  test("a manager can't add managers or edit the restaurant", async ({ page }) => {
    await login(page, "gerente@cafelucia.example", "/app/cafe-lucia/equipo");
    const roles = page.locator("form").getByLabel("Rol").locator("option");
    await expect(roles).toHaveText(["Mesero", "Cocina"]);
    await page.goto("/app/cafe-lucia/ajustes");
    await expect(page.getByText("Como gerente puedes editar impresoras.")).toBeVisible();
    await expect(page.getByLabel("Nombre").first()).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Acceso de soporte" })).toHaveCount(0);
  });

  test("the brand colour shows on the guest page", async ({ page, browser }) => {
    await login(page, "dueno@cafelucia.example", "/app/cafe-lucia/ajustes");
    const brand = page.locator("section").filter({ has: page.getByRole("heading", { name: "Marca" }) });
    await brand.getByLabel("Usar el color de mi restaurante").check();
    await brand.locator('input[type="color"]').fill("#1f4d3a");
    await brand.getByRole("button", { name: "Guardar marca" }).click();
    await expect(brand.getByText("Guardado.")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/screenshots/app-settings.desktop.light.png", fullPage: true });

    const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await guest.goto(guestUrl(9));
    await expect(guest.locator("header").first()).toHaveCSS("background-color", "rgb(31, 77, 58)");
    await guest.screenshot({ path: "docs/screenshots/guest-branded.phone.light.png" });

    // Put the seed back, and wait until it's really saved.
    await brand.getByLabel("Usar el color de mi restaurante").uncheck();
    await brand.getByRole("button", { name: "Guardar marca" }).click();
    await expect(async () => {
      await guest.reload();
      await expect(guest.locator("header").first()).toHaveCSS("background-color", "rgb(30, 43, 126)");
    }).toPass({ timeout: 20_000 });
  });

  test("Plan shows the trial and the active pricing", async ({ page }) => {
    await login(page, "dueno@cafelucia.example", "/app/cafe-lucia/plan");
    await expect(page.getByRole("heading", { name: "Plan", level: 1 })).toBeVisible();
    await expect(page.getByText("Plan Mezza")).toBeVisible();
    await expect(page.getByText(/% de los pagos con tarjeta/)).toBeVisible();
  });

  test("Stratum requests support access and the owner approves it", async ({ page, browser }) => {
    await login(page, "admin@stratum.example", "/admin");
    await expect(page.getByRole("cell", { name: /Café Lucía/ })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Alertas" }).or(page.getByText("Todo bien")),
    ).toBeVisible();
    await page.getByLabel("Restaurante").selectOption({ label: "Café Lucía" });
    const reason = `Revisar impresora ${Date.now()}`;
    await page.getByLabel("Motivo").fill(reason);
    await page.getByRole("button", { name: "Pedir acceso" }).click();
    await expect(page.getByText("Solicitud enviada al dueño.")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: "docs/screenshots/admin.desktop.light.png", fullPage: true });

    const owner = await (await browser.newContext()).newPage();
    await login(owner, "dueno@cafelucia.example", "/app/cafe-lucia/ajustes");
    const grant = owner.getByRole("listitem").filter({ hasText: reason });
    await expect(grant.getByText("Pendiente")).toBeVisible();
    await grant.getByRole("button", { name: "Aprobar" }).click();
    await expect(grant.getByText("Activo")).toBeVisible({ timeout: 15_000 });
    await grant.getByRole("button", { name: "Terminar ahora" }).click();
    await expect(grant).toBeHidden({ timeout: 15_000 });
  });
});
