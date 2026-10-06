import { expect, test, type Browser, type Page } from "@playwright/test";
import { app, email, guestUrl, login, resetTable, tableId } from "./helpers";

const TABLE_ID = () => tableId(11);

async function phone(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(guestUrl(11));
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

test.describe("staff tools for split bills (Mesas → a table)", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "phone", "multi-device flow runs once"));
  test.beforeAll(async () => resetTable(11));

  test("move, charge a person, void with refund, write off, free the table", async ({ browser }) => {
    test.setTimeout(300_000);
    const ana = await phone(browser);
    await order(ana, /^Malta/, "Ana"); // $2.00
    const ben = await phone(browser);
    await order(ben, /^Jugo de china/); // $3.50

    const manager = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await login(manager, email("gerente"), `${app()}/mesas`);
    await manager.getByRole("tab", { name: "Terraza" }).click();
    await manager.getByRole("link", { name: /^Mesa 11 ·/ }).click();
    await expect(manager).toHaveURL(new RegExp(`/mesas/${TABLE_ID()}$`));
    await expect(manager.getByRole("heading", { name: "Mesa 11" })).toBeVisible();
    const people = manager
      .locator("section")
      .filter({ has: manager.getByRole("heading", { name: "Personas y lo que pidieron" }) });
    const anaCard = people.getByRole("listitem").filter({ hasText: "Ana · #1" }).first();
    const benCard = people.getByRole("listitem").filter({ hasText: "Invitado #2" }).first();
    await expect(anaCard).toContainText("Falta $2.00");

    // Move Ana's malta to Invitado #2.
    await anaCard.getByRole("button", { name: "Mover a…" }).click();
    await anaCard.getByLabel("Mover Malta a").selectOption({ label: "Invitado #2" });
    await expect(benCard).toContainText("Falta $5.50", { timeout: 20_000 });
    await expect(anaCard).not.toContainText("Falta"); // nothing left on Ana (no dishes, so no status)

    // "Dividir cuenta": charge Invitado #2's $5.50 in cash.
    await manager.getByRole("button", { name: "Cobrar", exact: true }).click();
    const charge = manager.getByRole("dialog", { name: "Dividir cuenta" });
    await charge.getByRole("radio", { name: "Lo de una persona" }).check();
    await charge.getByRole("radio", { name: /Invitado #2/ }).check();
    await expect(charge.getByText("$5.50 + IVU")).toBeVisible();
    await charge.getByRole("button", { name: "Continuar al cobro" }).click();
    const cash = manager.getByRole("dialog", { name: "Cobrar en efectivo" });
    await cash.getByRole("button", { name: "Exacto" }).click();
    await cash.getByRole("button", { name: "Confirmar cobro" }).click();
    await manager
      .getByRole("dialog", { name: "Pago recibido" })
      .getByRole("button", { name: "Volver a Servicio" })
      .click();
    await expect(benCard).toContainText("Pagado", { timeout: 20_000 });
    await manager.screenshot({ path: "docs/screenshots/app-table-detail.desktop.light.png", fullPage: true });
    // Every size, light and dark, with no sideways scroll.
    for (const [w, h, size] of [
      [390, 844, "phone"],
      [768, 1024, "tablet"],
    ] as const) {
      await manager.setViewportSize({ width: w, height: h });
      for (const scheme of ["light", "dark"] as const) {
        await manager.emulateMedia({ colorScheme: scheme });
        await expect(manager.getByRole("heading", { name: "Mesa 11" })).toBeVisible();
        expect(await manager.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
          true,
        );
        await manager.screenshot({
          path: `docs/screenshots/app-table-detail.${size}.${scheme}.png`,
          fullPage: true,
        });
      }
    }
    await manager.setViewportSize({ width: 1280, height: 900 });
    await manager.emulateMedia({ colorScheme: "light" });

    // Void the paid juice: refund $3.50 plus its IVU to whoever paid it.
    await benCard.getByRole("button", { name: "Anular" }).nth(1).click();
    const voidDialog = manager.getByRole("dialog");
    await voidDialog.getByRole("textbox").first().fill("devuelto");
    await voidDialog.getByRole("button", { name: /Anular/ }).click();
    await expect(manager.getByText("Anulado. Devuelve $3.90 en efectivo a quien lo pagó.")).toBeVisible({
      timeout: 20_000,
    });

    // Ana orders again and leaves without paying: write it off.
    await order(ana, /^Malta/);
    await manager.reload();
    await expect(anaCard).toContainText("Falta $2.00", { timeout: 20_000 });
    await anaCard.getByRole("button", { name: "Perdonar lo de Ana · #1" }).click();
    const wo = manager.getByRole("dialog");
    await wo.getByRole("textbox").first().fill("se fue sin pagar");
    await wo.getByRole("button", { name: "Perdonar" }).click();
    await expect(manager.getByText("Perdonado: $2.00.")).toBeVisible({ timeout: 20_000 });

    // Nothing left and nothing pending: free the table.
    await manager.getByRole("button", { name: "Mesa libre" }).click();
    await expect(manager.getByText("Mesa liberada.")).toBeVisible({ timeout: 20_000 });
    await expect(manager.getByText("Esta mesa está libre.", { exact: false })).toBeVisible({
      timeout: 20_000,
    });

    // Reports keep the write-off apart.
    await manager.goto(`${app()}/reportes`);
    await expect(manager.getByText(/Cuentas perdonadas: \d+ · \$\d/)).toBeVisible();
  });
});
