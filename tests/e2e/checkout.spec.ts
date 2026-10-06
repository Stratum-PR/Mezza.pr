import { expect, test, type Browser, type Page } from "@playwright/test";
import { guestUrl, login, resetTable } from "./helpers";

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
  await expect(page.getByText(/Pedido #\d+ enviado a la cocina/)).toBeVisible({ timeout: 20_000 });
}

async function myOrder(page: Page) {
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Mi pedido/ }).click();
}

/** Pays cash with no tip for the chosen option; returns the total the phone was told to pay. */
async function payCash(page: Page, choose: (page: Page) => Promise<void>) {
  await page.getByRole("button", { name: "Pagar la cuenta" }).click();
  await choose(page);
  await page.getByRole("button", { name: "Sin propina" }).click();
  await page.getByRole("radio", { name: "Efectivo" }).check();
  await page.getByRole("button", { name: /^Pagar \$/ }).click();
  await expect(page.getByText(/Tu mesero viene a cobrar \$[\d.]+ en efectivo/)).toBeVisible({
    timeout: 20_000,
  });
}

async function confirmCash(server: Page, table: number) {
  await server.reload();
  const cash = server
    .getByRole("listitem")
    .filter({ hasText: `Mesa ${table}: cobrar` })
    .first();
  await expect(cash).toBeVisible({ timeout: 20_000 });
  await cash.getByRole("button", { name: "Efectivo recibido" }).click();
  const dialog = server.getByRole("dialog", { name: "Cobrar en efectivo" });
  await dialog.getByRole("button", { name: "Exacto" }).click();
  await dialog.getByRole("button", { name: "Confirmar cobro" }).click();
  await server
    .getByRole("dialog", { name: "Pago recibido" })
    .getByRole("button", { name: "Volver a Servicio" })
    .click();
}

test.describe("guest checkout (split bill)", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "phone", "multi-device flow runs once"));
  test.beforeAll(async () => {
    await resetTable(1);
    await resetTable(2);
  });

  test("mine, someone else's, staff confirm each payment, and the table closes only when all is paid", async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const server = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await login(server, "mesero@cafelucia.example", "/app/cafe-lucia/servicio");

    const ana = await phone(browser, 1);
    await order(ana, /^Malta/, "Ana"); // $2.00
    const ben = await phone(browser, 1);
    await order(ben, /^Jugo de china/); // $3.50

    // Ana pays her own dishes in cash: $2.00 + IVU, no tip.
    await myOrder(ana);
    await payCash(ana, async (p) => {
      await expect(p.getByRole("radio", { name: /Mis platos/ })).toBeChecked();
    });
    await expect(ana.getByText("Tu mesero viene a cobrar $2.23 en efectivo.")).toBeVisible();

    // Ben sees Ana's payment in progress and what's left at the table.
    await myOrder(ben);
    const check = ben.getByRole("region", { name: "La cuenta de la mesa" });
    await expect(check.getByRole("listitem").filter({ hasText: "Ana · #1" })).toContainText(
      "Pago en proceso",
    );
    await expect(ben.getByText("Falta por pagar en la mesa: $3.50")).toBeVisible();

    // The server confirms Ana's cash: her phone shows a receipt with only her dish.
    await confirmCash(server, 1);
    await expect(ana.getByRole("heading", { name: "Recibo de pago" })).toBeVisible({ timeout: 20_000 });
    await expect(ana.getByText("1× Malta")).toBeVisible();
    await expect(ana.getByText("Jugo de china")).toHaveCount(0);
    await ana.screenshot({ path: "docs/screenshots/guest-receipt-split.phone.light.png", fullPage: true });

    // Not fully paid yet: no "Cerrado en el POS" for Mesa 1.
    await server.reload();
    await expect(server.getByText(/Mesa 1: marca/)).toHaveCount(0);

    // A third phone that never ordered pays for Ben.
    const cam = await phone(browser, 1);
    await cam.getByRole("button", { name: /Mi pedido/ }).click();
    await payCash(cam, async (p) => {
      await p.getByRole("radio", { name: /Pagar por otra persona/ }).check();
      await p.getByRole("radio", { name: /Invitado #2/ }).check();
      await expect(p.getByText("$3.50").first()).toBeVisible();
    });
    await confirmCash(server, 1);

    // Everything is paid: the table is done and the POS-close item appears.
    await myOrder(ben);
    await expect(ben.getByText("La mesa está pagada.")).toBeVisible({ timeout: 20_000 });
    await server.reload();
    await expect(
      server.getByRole("listitem").filter({ hasText: /Mesa 1: marca \$[\d.]+ en el POS/ }),
    ).toBeVisible({
      timeout: 20_000,
    });
  });

  test("an even split: one phone splits in two, each pays a share", async ({ browser }) => {
    test.setTimeout(300_000);
    const server = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await login(server, "mesero@cafelucia.example", "/app/cafe-lucia/servicio");

    const ana = await phone(browser, 2);
    await order(ana, /^Jugo de china/, "Ana"); // $3.50
    const ben = await phone(browser, 2);
    await order(ben, /^Malta/); // $2.00

    // Ana splits $5.50 in two and pays one share ($2.75 + IVU).
    await myOrder(ana);
    await ana.getByRole("button", { name: "Pagar la cuenta" }).click();
    await ana.getByRole("radio", { name: /Dividir en partes iguales/ }).check();
    await ana.getByRole("button", { name: "Dividir en 2" }).click();
    await expect(
      ana.getByText("La cuenta se dividió en 2. Partes que quedan: 2, de $2.75 cada una."),
    ).toBeVisible({
      timeout: 20_000,
    });
    await ana.screenshot({ path: "docs/screenshots/guest-split-even.phone.light.png", fullPage: true });
    await ana.getByRole("button", { name: "Sin propina" }).click();
    await ana.getByRole("radio", { name: "Efectivo" }).check();
    await ana.getByRole("button", { name: /^Pagar \$/ }).click();
    await expect(ana.getByText(/Tu mesero viene a cobrar \$3\.07 en efectivo/)).toBeVisible({
      timeout: 20_000,
    });

    // Ben's "Pagar" opens on the split: one share left.
    await myOrder(ben);
    await payCash(ben, async (p) => {
      await expect(p.getByRole("radio", { name: /Dividir en partes iguales/ })).toBeChecked();
      await expect(
        p.getByText("La cuenta se dividió en 2. Partes que quedan: 1, de $2.75 cada una."),
      ).toBeVisible();
    });

    await confirmCash(server, 2);
    await confirmCash(server, 2);
    // Ben's phone opens his receipt once; after that it stays on the menu (he may keep ordering).
    await expect(ben.getByRole("heading", { name: "Recibo de pago" })).toBeVisible({ timeout: 20_000 });
    await expect(ben.getByText("1 de 2 partes iguales")).toBeVisible();
    await myOrder(ben);
    await expect(ben.getByText("La mesa está pagada.")).toBeVisible({ timeout: 20_000 });
  });
});
