import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("manager tools in Servicio", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "runs once"));

  test("a manager takes an order, voids a line with a reason, and refunds part of a payment", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await login(page, "gerente@cafelucia.example", "/app/cafe-lucia/servicio");
    await page.getByRole("link", { name: "Abrir Tomar orden" }).click();
    await expect(page).toHaveURL(/\/servicio\/orden$/);
    const ticket = page.getByRole("complementary", { name: "Orden de la mesa" });
    await ticket.getByRole("button", { name: "10", exact: true }).click();
    await page.getByRole("button", { name: "Añadir Malta" }).click();
    await page.getByRole("button", { name: "Añadir Quesito" }).click();
    await expect(ticket.getByText("IVU estatal (10.5%)")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/app-take-order.desktop.light.png", fullPage: true });
    await ticket.getByRole("button", { name: /Enviar a cocina/ }).click();
    const sent = page.getByText(/Pedido #(\d+) enviado a la cocina/);
    await expect(sent).toBeVisible({ timeout: 20_000 });
    const number = (await sent.textContent())!.match(/#(\d+)/)![1]!;
    await page.goto("/app/cafe-lucia/servicio");

    // Void the Quesito: the reason is required.
    const order = page.getByRole("listitem").filter({ hasText: `#${number} · Mesa 10` });
    await order.getByRole("button", { name: "Anular Quesito" }).click();
    const voidDialog = page.getByRole("dialog");
    await expect(voidDialog.getByRole("button", { name: "Anular" })).toBeDisabled(); // reason required
    await voidDialog.getByLabel("Motivo").fill("Cliente cambió de idea");
    await voidDialog.getByRole("button", { name: "Anular" }).click();
    await expect(order.getByText(/Quesito · Anulado/)).toBeVisible({ timeout: 20_000 });

    // Refund $0.50 of the first paid payment.
    const paid = page
      .getByRole("listitem")
      .filter({ hasText: /Pagado/ })
      .first();
    await paid.getByRole("button", { name: "Reembolsar" }).click();
    const refund = page.getByRole("dialog");
    await refund.getByLabel(/Cuánto reembolsas/).fill("0.50");
    await refund.getByLabel("Motivo").fill("Café frío");
    await page.screenshot({ path: "docs/screenshots/app-refund.desktop.light.png" });
    await refund.getByRole("button", { name: "Reembolsar" }).click();
    await expect(page.getByText("Reembolso registrado.")).toBeVisible({ timeout: 20_000 });
  });

  test("servers can't void or refund", async ({ page }) => {
    await login(page, "mesero@cafelucia.example", "/app/cafe-lucia/servicio");
    await expect(page.getByText("Anular y reembolsar es para gerentes y dueños.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Anular / })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reembolsar" })).toHaveCount(0);
  });
});
