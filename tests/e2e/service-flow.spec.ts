import { expect, test, type Browser, type Page } from "@playwright/test";
import { app, email, guestUrl, login, resetTable } from "./helpers";

/** Today's taxable sales in this month's IVU summary, and the "Ventas de hoy" tile on Inicio. */
async function todaysSales(owner: Page) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico" }).format(new Date());
  const csv = await (
    await owner.request.get(`${app()}/exportar/descargar?kind=ivu_monthly_csv&month=${today.slice(0, 7)}`)
  ).text();
  const row = csv.split(/\r?\n/).find((l) => l.startsWith(`${today},`));
  await owner.goto(`${app()}`);
  const tile = await owner.getByText("Ventas de hoy").locator("..").textContent();
  return {
    ivu: Number(row?.split(",")[1] ?? 0),
    home: Number(tile!.match(/\$([\d,]+\.\d\d)/)![1]!.replace(/,/g, "")),
  };
}

async function staff(browser: Browser, email: string, path: string) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await login(page, email, path);
  return page;
}

test("Mesa 4 orders, the kitchen serves it, the guest pays cash and the table closes on the POS", async ({
  browser,
}, info) => {
  test.skip(info.project.name !== "desktop", "multi-device flow runs once");
  test.setTimeout(240_000);
  await resetTable(4);
  const owner = await staff(browser, email("dueno"), `${app()}`);
  const before = await todaysSales(owner);

  // Guest phone at Mesa 4.
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const guest = await phoneCtx.newPage();
  await guest.goto(guestUrl(4));
  await guest.waitForLoadState("networkidle");
  await guest.getByRole("button", { name: "Simple", exact: true }).click();
  await guest.getByRole("button", { name: /^Café con leche/ }).click();
  await guest
    .getByRole("dialog")
    .getByRole("button", { name: /Añadir al pedido/ })
    .click();
  await guest.getByRole("button", { name: /Ver pedido \(1\)/ }).click();
  await guest.getByRole("button", { name: "Enviar a cocina" }).click();
  const sent = guest.getByText(/Pedido #(\d+) enviado a la cocina/);
  await expect(sent).toBeVisible({ timeout: 20_000 });
  const number = (await sent.textContent())!.match(/#(\d+)/)![1]!;
  await guest.getByRole("button", { name: /Mi pedido/ }).click();
  await expect(guest.getByText("Recibido")).toBeVisible();

  // The kitchen sees it and moves it along.
  const kitchen = await staff(browser, email("cocina"), `${app()}/cocina`);
  const card = kitchen.getByRole("listitem").filter({ hasText: `#${number} · Mesa 4` });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText("QR", { exact: true })).toBeVisible();
  await kitchen.screenshot({ path: "docs/screenshots/app-kitchen.desktop.light.png", fullPage: true });
  await card.getByRole("button", { name: "Empezar" }).click();
  await expect(
    kitchen.getByRole("region", { name: /En cocina/ }).getByText(`#${number} · Mesa 4`),
  ).toBeVisible({ timeout: 20_000 });
  await kitchen
    .getByRole("listitem")
    .filter({ hasText: `#${number} · Mesa 4` })
    .getByRole("button", { name: "Marcar listo" })
    .click();

  // The guest's phone follows along (polling).
  await expect(guest.getByText("Listo", { exact: true })).toBeVisible({ timeout: 20_000 });

  // The server marks it served.
  const server = await staff(browser, email("mesero"), `${app()}/servicio`);
  const readyAlert = server.getByRole("listitem").filter({ hasText: `Pedido #${number} listo · Mesa 4` });
  await expect(readyAlert).toBeVisible({ timeout: 20_000 });
  await readyAlert.getByRole("button", { name: "Servido" }).click();
  await expect(guest.getByText("Servido", { exact: true })).toBeVisible({ timeout: 20_000 });

  // The guest asks for the check and pays cash.
  await guest.getByRole("button", { name: "Pagar la cuenta" }).click();
  await guest.getByRole("radio", { name: "Efectivo" }).check();
  await guest.getByRole("button", { name: /^Pagar \$/ }).click();
  await expect(guest.getByText(/Tu mesero viene a cobrar/)).toBeVisible({ timeout: 20_000 });

  // The server confirms the cash; the POS-close item appears with the amount to enter.
  const cash = server.getByRole("listitem").filter({ hasText: "Mesa 4: cobrar" });
  await expect(cash).toBeVisible({ timeout: 20_000 });
  await server.screenshot({ path: "docs/screenshots/app-service.desktop.light.png", fullPage: true });
  await cash.getByRole("button", { name: "Efectivo recibido" }).click();
  // The cash dialog: the guest hands over a round amount and the change shows.
  const dialog = server.getByRole("dialog", { name: "Cobrar en efectivo" });
  await dialog.getByRole("button", { name: "Exacto" }).click();
  await server.screenshot({ path: "docs/screenshots/app-cash.desktop.light.png" });
  await dialog.getByRole("button", { name: "Confirmar cobro" }).click();
  const received = server.getByRole("dialog", { name: "Pago recibido" });
  await expect(received.getByText("Efectivo", { exact: true })).toBeVisible({ timeout: 20_000 });
  await received.getByRole("button", { name: "Volver a Servicio" }).click();
  const pos = server.getByRole("listitem").filter({ hasText: /Mesa 4: marca \$[\d.]+ en el POS/ });
  await expect(pos).toBeVisible({ timeout: 20_000 });

  // The guest gets the payment receipt.
  await expect(guest.getByRole("heading", { name: "Recibo de pago" })).toBeVisible({ timeout: 20_000 });
  await expect(guest.getByText("Recibo de pago: tu recibo fiscal lo emite el comercio.")).toBeVisible();
  await guest.screenshot({ path: "docs/screenshots/guest-receipt.phone.light.png", fullPage: true });

  // The sale shows up on Inicio and in this month's IVU summary ($2.50 before IVU).
  const after = await todaysSales(owner);
  expect(after.home).toBeCloseTo(before.home + 2.5, 2);
  expect(after.ivu).toBeCloseTo(before.ivu + 2.5, 2);

  // "Cerrado en el POS" asks first; cancelling leaves the table in the POS list.
  const dismissed = server.waitForEvent("dialog").then(async (d) => {
    const message = d.message();
    await d.dismiss();
    return message;
  });
  await pos.getByRole("button", { name: "Cerrado en el POS" }).click();
  expect(await dismissed).toMatch(/Mesa 4/);
  await server.waitForTimeout(1_000);
  await expect(pos).toBeVisible();

  // Accepting closes it on the POS.
  const accepted = server.waitForEvent("dialog").then(async (d) => {
    const message = d.message();
    await d.accept();
    return message;
  });
  await pos.getByRole("button", { name: "Cerrado en el POS" }).click();
  expect(await accepted).toMatch(/Mesa 4.*en el POS/);
  await expect(pos).toBeHidden({ timeout: 20_000 });

  // Mesas shows Mesa 4 free again.
  await server.goto(`${app()}/mesas`);
  await expect(server.getByRole("listitem").filter({ hasText: /^4/ }).getByText("Libre")).toBeVisible();
  await server.screenshot({ path: "docs/screenshots/app-tables.desktop.light.png", fullPage: true });
});
