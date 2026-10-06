import { expect, test, type Page } from "@playwright/test";
import { guestUrl, resetTable } from "./helpers";

async function addMalta(page: Page) {
  await page.getByRole("button", { name: "Simple", exact: true }).click();
  await page.getByRole("button", { name: /^Malta/ }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Añadir al pedido/ })
    .click();
  await page.getByRole("button", { name: /Ver pedido \(1\)/ }).click();
}

test.describe("guest at the table", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "phone", "guests use phones"));
  test.beforeAll(async () => {
    await resetTable(7);
    await resetTable(8);
  });

  test("orders from Mesa 7 and sees the status", async ({ page }) => {
    await page.goto(guestUrl(7));
    await page.waitForLoadState("networkidle");
    await addMalta(page);
    await page.getByRole("button", { name: "Enviar a cocina" }).click();
    await expect(page.getByText(/Pedido #\d+ enviado a la cocina/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Mi pedido/ }).click();
    await expect(page.getByRole("heading", { name: "Tu pedido en la mesa" })).toBeVisible();
    await expect(page.getByText("Recibido").first()).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/guest-status.phone.light.png", fullPage: true });
  });

  test("tapping Enviar a cocina twice creates one order", async ({ page }) => {
    await page.goto(guestUrl(8));
    await page.waitForLoadState("networkidle");
    await addMalta(page);
    const send = page.getByRole("button", { name: "Enviar a cocina" });
    await send.dblclick();
    await expect(page.getByText(/Pedido #\d+ enviado a la cocina/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Mi pedido/ }).click();
    await expect(page.getByText(/^Pedido #\d+$/)).toHaveCount(1);
  });

  test("calls the server, then asks for the check and pays cash", async ({ page }) => {
    await page.goto(guestUrl(7));
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Llamar al mesero" }).click();
    await expect(page.getByText("Avisamos a tu mesero.")).toBeVisible();
    await page.getByRole("button", { name: /Mi pedido/ }).click();
    await page.getByRole("button", { name: "Pagar la cuenta" }).click();
    await expect(page.getByText("IVU estatal")).toBeVisible();
    await expect(page.getByText("IVU municipal")).toBeVisible();
    await page.getByRole("radio", { name: "Efectivo" }).check();
    await page.screenshot({ path: "docs/screenshots/guest-pay.phone.light.png", fullPage: true });
    await page.getByRole("button", { name: /^Pagar \$/ }).click();
    await expect(page.getByText(/Tu mesero viene a cobrar \$[\d.]+ en efectivo/)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("a rotated or made-up code shows a clear page", async ({ page }) => {
    await page.goto("/r/cafe-lucia/t/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    await expect(page.getByRole("heading", { name: "Este código ya no es válido" })).toBeVisible();
  });
});
