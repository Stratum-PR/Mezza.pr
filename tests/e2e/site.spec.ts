import { expect, test } from "@playwright/test";

test.describe("marketing site", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "runs once"));

  test("a demo request is saved and acknowledged", async ({ page }) => {
    await page.goto("/es/demo#solicitar");
    await page.waitForLoadState("networkidle");
    const form = page.locator("#solicitar form");
    await form.getByLabel("Tu nombre").fill("Prueba E2E");
    await form.getByLabel("Nombre del restaurante").fill("Fonda de Prueba");
    await form.getByLabel("Correo electrónico").fill("prueba@example.com");
    await form.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Recibimos tu solicitud" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("a demo request without an email explains the fix", async ({ page }) => {
    await page.goto("/es/demo#solicitar");
    await page.waitForLoadState("networkidle");
    const form = page.locator("#solicitar form");
    await form.getByLabel("Tu nombre").fill("Sin correo");
    await form.getByRole("button", { name: "Enviar solicitud" }).click();
    await expect(form.getByText("Escribe un correo válido")).toBeVisible({ timeout: 20_000 });
  });

  test("the demo QR code is on the page", async ({ page }) => {
    await page.goto("/en/demo");
    await expect(page.getByRole("img", { name: "QR code that opens the Mezza demo" })).toBeVisible();
  });

  test("legal drafts are marked for review in both languages", async ({ page }) => {
    await page.goto("/es/legal/terminos");
    await expect(page.getByText("Borrador: requiere revisión legal")).toBeVisible();
    await page.goto("/en/legal/privacidad");
    await expect(page.getByText("Draft: needs legal review")).toBeVisible();
  });

  test("pricing shows the active model and a worked fee example", async ({ page }) => {
    await page.goto("/es/precios");
    await expect(page.getByText("$29.00")).toBeVisible();
    await expect(page.getByText(/pagas \$44\.00/)).toBeVisible();
  });
});
