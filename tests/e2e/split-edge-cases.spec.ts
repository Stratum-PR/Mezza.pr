import { expect, test, type Browser, type Page } from "@playwright/test";
import { email, guestUrl, localRest, login, resetTable, tableId, app } from "./helpers";

/**
 * Split-bill edge cases with several phones (pass 2 phase 6). Time-based rules (15-minute pending
 * expiry, 10-minute auto-close) move timestamps back in the local database instead of waiting.
 */

async function phone(browser: Browser, table: number): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(guestUrl(table));
  await page.waitForLoadState("networkidle");
  return page;
}

async function order(page: Page, dish: RegExp, name?: string) {
  await page.getByRole("button", { name: "Simple", exact: true }).click();
  await page.getByRole("button", { name: dish }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Añadir al pedido/ })
    .click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  if (name) await page.getByLabel("Tu nombre (opcional)").fill(name);
  await page.getByRole("button", { name: "Enviar a cocina" }).click();
  await expect(page.getByText(/Pedido #\d+ enviado a la cocina/).last()).toBeVisible({ timeout: 20_000 });
}

async function myOrder(page: Page) {
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Mi pedido/ }).click();
}

/** Opens "Pagar", picks an option, no tip, cash; doesn't press pay. */
async function preparePay(page: Page, option: RegExp) {
  await page.getByRole("button", { name: "Pagar la cuenta" }).click();
  await page.getByRole("radio", { name: option }).check();
  await page.getByRole("button", { name: "Sin propina" }).click();
  await page.getByRole("radio", { name: "Efectivo" }).check();
}

/** Moves this worker's table timestamps back (local database only). */
async function ageTable(table: number, minutes: number) {
  const { url, headers } = localRest();
  const then = new Date(Date.now() - minutes * 60_000).toISOString();
  const tabs = (await (
    await fetch(`${url}/rest/v1/tabs?table_id=eq.${tableId(table)}&status=neq.closed&select=id`, { headers })
  ).json()) as { id: string }[];
  for (const { id } of tabs) {
    for (const [path, body] of [
      [`orders?tab_id=eq.${id}`, { created_at: then }],
      [`payments?tab_id=eq.${id}`, { created_at: then }],
      [`payments?tab_id=eq.${id}&paid_at=not.is.null`, { paid_at: then }],
    ] as const)
      await fetch(`${url}/rest/v1/${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
  }
}

test.describe("split-bill edge cases", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "phone", "multi-device flows run once"));
  test.beforeEach(async () => {
    await resetTable(5);
    await resetTable(9);
  });

  test("two phones pay the whole balance at the same moment: one payment, no double charge", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const ana = await phone(browser, 5);
    await order(ana, /^Malta/, "Ana");
    const ben = await phone(browser, 5);
    await order(ben, /^Jugo de china/);
    await myOrder(ana);
    await myOrder(ben);
    await preparePay(ana, /Todo lo que falta en la mesa/);
    await preparePay(ben, /Todo lo que falta en la mesa/);
    await Promise.all([
      ana.getByRole("button", { name: /^Pagar \$/ }).click(),
      ben.getByRole("button", { name: /^Pagar \$/ }).click(),
    ]);
    const pending = /Tu mesero viene a cobrar \$[\d.]+ en efectivo/;
    const refused = "Todavía no hay nada que pagar.";
    await expect(ana.getByText(pending).or(ana.getByText(refused))).toBeVisible({ timeout: 20_000 });
    await expect(ben.getByText(pending).or(ben.getByText(refused))).toBeVisible({ timeout: 20_000 });
    const winners = (await ana.getByText(pending).count()) + (await ben.getByText(pending).count());
    expect(winners).toBe(1);
  });

  test("ordering while someone pays: the new dish is owed, the pending payment keeps its amount", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const ana = await phone(browser, 9);
    await order(ana, /^Malta/, "Ana");
    await myOrder(ana);
    await preparePay(ana, /Mis platos/);
    await ana.getByRole("button", { name: /^Pagar \$/ }).click();
    await expect(ana.getByText("Tu mesero viene a cobrar $2.23 en efectivo.")).toBeVisible({
      timeout: 20_000,
    });

    const ben = await phone(browser, 9);
    await order(ben, /^Jugo de china/);
    await myOrder(ben);
    await expect(ben.getByText("Falta por pagar en la mesa: $3.50")).toBeVisible();
    await myOrder(ana);
    await expect(ana.getByText("Tu mesero viene a cobrar $2.23 en efectivo.")).toBeVisible();
  });

  test("leaving early, a late order in an even split, and a pending payment that expires", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const server = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await login(server, email("mesero"), `${app()}/servicio`);
    const ana = await phone(browser, 5);
    await order(ana, /^Jugo de china/, "Ana"); // $3.50
    const ben = await phone(browser, 5);
    await order(ben, /^Malta/); // $2.00

    // Split $5.50 in two; Ana pays her share and leaves.
    await myOrder(ana);
    await ana.getByRole("button", { name: "Pagar la cuenta" }).click();
    await ana.getByRole("radio", { name: /Dividir en partes iguales/ }).check();
    await ana.getByRole("button", { name: "Dividir en 2" }).click();
    await ana.getByRole("button", { name: "Sin propina" }).click();
    await ana.getByRole("radio", { name: "Efectivo" }).check();
    await ana.getByRole("button", { name: /^Pagar \$/ }).click();
    await expect(ana.getByText(/Tu mesero viene a cobrar \$3\.07/)).toBeVisible({ timeout: 20_000 });
    await server.reload();
    const cash = server.getByRole("listitem").filter({ hasText: "Mesa 5: cobrar" }).first();
    await cash.getByRole("button", { name: "Efectivo recibido" }).click();
    const dialog = server.getByRole("dialog", { name: "Cobrar en efectivo" });
    await dialog.getByRole("button", { name: "Exacto" }).click();
    await dialog.getByRole("button", { name: "Confirmar cobro" }).click();
    await server
      .getByRole("dialog", { name: "Pago recibido" })
      .getByRole("button", { name: "Volver a Servicio" })
      .click();

    // Ben orders a late dish: it's his own, outside the split; the split still has one share.
    await order(ben, /^Malta/);
    await myOrder(ben);
    await ben.getByRole("button", { name: "Pagar la cuenta" }).click();
    await expect(ben.getByRole("radio", { name: /Mis platos.*\$2\.00/ })).toBeVisible();
    // One share of the split is left ($2.75), apart from his own late malta.
    await expect(ben.getByRole("radio", { name: /Dividir en partes iguales.*\$2\.75/ })).toBeVisible();

    // Ben starts paying cash, then walks away: after 15 minutes the payment lapses and he can pay again.
    await ben.getByRole("radio", { name: /Mis platos/ }).check();
    await ben.getByRole("button", { name: "Sin propina" }).click();
    await ben.getByRole("radio", { name: "Efectivo" }).check();
    await ben.getByRole("button", { name: /^Pagar \$/ }).click();
    await expect(ben.getByText(/Tu mesero viene a cobrar/)).toBeVisible({ timeout: 20_000 });
    const { url, headers } = localRest();
    await fetch(
      `${url}/rest/v1/payments?status=eq.pending&created_at=gt.${new Date(Date.now() - 60 * 60_000).toISOString()}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({ created_at: new Date(Date.now() - 16 * 60_000).toISOString() }),
      },
    );
    await myOrder(ben);
    await preparePay(ben, /Mis platos/);
    await ben.getByRole("button", { name: /^Pagar \$/ }).click();
    await expect(ben.getByText("Tu mesero viene a cobrar $2.23 en efectivo.")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("a paid table quiet for 10 minutes closes; the next party starts fresh", async ({ browser }) => {
    test.setTimeout(180_000);
    const server = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await login(server, email("mesero"), `${app()}/servicio`);
    const ana = await phone(browser, 9);
    await order(ana, /^Malta/, "Ana");
    await myOrder(ana);
    await preparePay(ana, /Mis platos/);
    await ana.getByRole("button", { name: /^Pagar \$/ }).click();
    await expect(ana.getByText(/Tu mesero viene a cobrar/)).toBeVisible({ timeout: 20_000 });
    await server.reload();
    const cash = server.getByRole("listitem").filter({ hasText: "Mesa 9: cobrar" }).first();
    await cash.getByRole("button", { name: "Efectivo recibido" }).click();
    const dialog = server.getByRole("dialog", { name: "Cobrar en efectivo" });
    await dialog.getByRole("button", { name: "Exacto" }).click();
    await dialog.getByRole("button", { name: "Confirmar cobro" }).click();
    await server
      .getByRole("dialog", { name: "Pago recibido" })
      .getByRole("button", { name: "Volver a Servicio" })
      .click();

    // Ten quiet minutes later, any screen loading closes it.
    await ageTable(9, 11);
    await server.goto(`${app()}/mesas/${tableId(9)}`);
    await expect(server.getByText("Esta mesa está libre.", { exact: false })).toBeVisible({
      timeout: 20_000,
    });

    // The same phone is a new person at the next visit (asked for a name again).
    await ana.reload();
    await ana.waitForLoadState("networkidle");
    await ana.getByRole("button", { name: "Simple", exact: true }).click();
    await ana.getByRole("button", { name: /^Malta/ }).click();
    await ana
      .getByRole("dialog")
      .getByRole("button", { name: /Añadir al pedido/ })
      .click();
    await ana.getByRole("button", { name: /Ver pedido/ }).click();
    await expect(ana.getByLabel("Tu nombre (opcional)")).toBeVisible();
  });
});
