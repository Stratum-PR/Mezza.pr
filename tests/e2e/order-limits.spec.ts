import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { guestUrl, login, resetTable } from "./helpers";

const DEFAULTS = {
  qr_max_order_cents: 30000,
  qr_max_line_qty: 20,
  qr_max_tab_cents: 150000,
  max_people_per_table: 20,
};

/** Puts Café Lucía's QR limits back to the defaults (local Supabase only), whatever the test did. */
async function restoreLimits() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error("local Supabase only");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  await fetch(`${url}/rest/v1/restaurants?slug=eq.cafe-lucia`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(DEFAULTS),
  });
}

async function addMaltas(page: Page, qty: number) {
  await page.getByRole("button", { name: /^Malta/ }).click();
  const sheet = page.getByRole("dialog");
  for (let i = 1; i < qty; i++) await sheet.getByRole("button", { name: "Añadir uno" }).click();
  await sheet.getByRole("button", { name: /Añadir al pedido/ }).click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
}

test.describe("QR ordering limits", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "phone", "one run is enough"));
  test.beforeAll(async () => {
    await resetTable(3);
    await restoreLimits();
  });
  test.afterAll(restoreLimits);

  test("owner sets limits; a guest is held to them; staff see the new table and raise its limit", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    // The owner lowers the limits in Ajustes: $5 per order, $5 per open table.
    const owner = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await login(owner, "dueno@cafelucia.example", "/app/cafe-lucia/ajustes");
    const limits = owner
      .locator("section")
      .filter({ has: owner.getByRole("heading", { name: "Límites de pedidos por QR" }) });
    await limits.getByLabel("Máximo por pedido ($)").fill("5");
    await limits.getByLabel("Máximo por mesa abierta ($)").fill("5");
    await limits.getByRole("button", { name: "Guardar límites" }).click();
    await expect(limits.getByText("Guardado.")).toBeVisible({ timeout: 20_000 });

    // A guest at Mesa 3: $6 is over the order cap; $4 goes to the kitchen.
    const guest = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await guest.goto(guestUrl(3));
    await guest.waitForLoadState("networkidle");
    await guest.getByRole("button", { name: "Simple", exact: true }).click();
    await addMaltas(guest, 3);
    await guest.getByRole("button", { name: "Enviar a cocina" }).click();
    await expect(guest.getByText("Un pedido por QR puede ser de hasta $5.00.", { exact: false })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await guest.getByRole("button", { name: "Uno menos de Malta" }).click();
    await guest.getByRole("button", { name: "Enviar a cocina" }).click();
    await expect(guest.getByText(/Pedido #\d+ enviado a la cocina/)).toBeVisible({ timeout: 20_000 });

    // Servicio: the order is flagged as a new table, and the table is near its $5 cap.
    const server = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await login(server, "mesero@cafelucia.example", "/app/cafe-lucia/servicio");
    await expect(server.getByText("Mesa nueva por QR").first()).toBeVisible();
    const alert = server.getByRole("listitem").filter({ hasText: "Mesa 3 cerca de su límite por QR" });
    await expect(alert).toContainText("$4.00 de $5.00");
    await alert.getByRole("button", { name: "Ampliar límite" }).click();
    await expect(server.getByText("Límite de la mesa ampliado a $10.00.")).toBeVisible({ timeout: 20_000 });
    await server.screenshot({ path: "docs/screenshots/service-limits.desktop.light.png", fullPage: true });

    // With the raised cap the table orders again (another $4 fits under $10).
    await addMaltas(guest, 2);
    await guest.getByRole("button", { name: "Enviar a cocina" }).click();
    await expect(guest.getByText(/Pedido #\d+ enviado a la cocina/).last()).toBeVisible({ timeout: 20_000 });
  });
});
