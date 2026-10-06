import { expect, test, type Browser, type Page } from "@playwright/test";
import { app, email, guestUrl, login, resetTable } from "./helpers";

/** A separate phone: its own cookies, so its own device and its own person at the table. */
async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(guestUrl(10));
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Simple", exact: true }).click();
  return page;
}

async function addMalta(page: Page, shared = false) {
  await page.getByRole("button", { name: /^Malta/ }).click();
  const sheet = page.getByRole("dialog");
  if (shared) await sheet.getByRole("checkbox", { name: /Para compartir/ }).check();
  await sheet.getByRole("button", { name: /Añadir al pedido/ }).click();
  await page.getByRole("button", { name: /Ver pedido/ }).click();
}

async function groupCheck(page: Page) {
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Mi pedido/ }).click();
  const section = page.getByRole("region", { name: "La cuenta de la mesa" });
  await expect(section).toBeVisible();
  return section;
}

test.describe("people at a table (shared tab)", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "phone", "guests use phones"));
  test.beforeAll(async () => resetTable(10));

  test("two phones, a shared dish, a staff order for one person, and renaming", async ({ browser }) => {
    test.setTimeout(120_000);

    // Ana's phone: a staff-like name is refused before anything is sent; then "Ana".
    const ana = await phone(browser);
    await addMalta(ana);
    const name = ana.getByLabel("Tu nombre (opcional)");
    await name.fill("Gerente");
    await ana.getByRole("button", { name: "Enviar a cocina" }).click();
    await expect(ana.getByText("Ese nombre no está disponible. Prueba otro.")).toBeVisible({
      timeout: 20_000,
    });
    await name.fill("Ana");
    await ana.getByRole("button", { name: "Enviar a cocina" }).click();
    await expect(ana.getByText(/Pedido #\d+ enviado a la cocina/)).toBeVisible({ timeout: 20_000 });

    // A second phone, no name, orders a Malta to share: split between the two people who ordered.
    const ben = await phone(browser);
    await addMalta(ben, true);
    await expect(ben.getByText("Si lo dejas en blanco serás «Invitado #2».", { exact: false })).toBeVisible();
    await ben.getByRole("button", { name: "Enviar a cocina" }).click();
    await expect(ben.getByText(/Pedido #\d+ enviado a la cocina/)).toBeVisible({ timeout: 20_000 });

    const benCheck = await groupCheck(ben);
    const anaGroup = benCheck.getByRole("listitem").filter({ hasText: "Ana · #1" });
    const benGroup = benCheck.getByRole("listitem").filter({ hasText: "Invitado #2" });
    await expect(benGroup).toContainText("(Tú)");
    await expect(anaGroup).toContainText("$3.00"); // her Malta + half the shared one
    await expect(benGroup).toContainText("parte de $2.00");
    await expect(benGroup).toContainText("$1.00");
    await ben.screenshot({ path: "docs/screenshots/guest-group-check.phone.light.png", fullPage: true });

    // Ana sees herself as "Tú", and has no name field any more (she's at the table).
    const anaCheck = await groupCheck(ana);
    await expect(anaCheck.getByRole("listitem").filter({ hasText: "Ana · #1" })).toContainText("(Tú)");

    // A server takes an order at Mesa 10 for Ana.
    const staff = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
    await login(staff, email("mesero"), `${app()}/servicio/orden`);
    await staff.getByRole("button", { name: "10", exact: true }).click();
    await staff.getByRole("group", { name: "Para" }).getByRole("button", { name: "Ana · #1" }).click();
    await staff.getByRole("button", { name: "Añadir Malta" }).click();
    await staff.getByRole("button", { name: /Enviar a cocina/ }).click();
    await expect(staff.getByText(/Pedido #\d+ enviado a la cocina/)).toBeVisible({ timeout: 20_000 });
    const anaAfter = await groupCheck(ana);
    await expect(anaAfter.getByRole("listitem").filter({ hasText: "Ana · #1" })).toContainText("$5.00");

    // Renaming: staff-like names are refused; a real name shows with the number.
    await ben.getByLabel("Cambiar mi nombre").fill("Mesero");
    await ben.getByRole("button", { name: "Guardar" }).click();
    await expect(ben.getByText("Ese nombre no está disponible. Prueba otro.")).toBeVisible();
    await ben.getByLabel("Cambiar mi nombre").fill("ana");
    await ben.getByRole("button", { name: "Guardar" }).click();
    await expect(ben.getByText("Alguien en la mesa ya usa ese nombre. Prueba otro.")).toBeVisible();
    await ben.getByLabel("Cambiar mi nombre").fill("Ben");
    await ben.getByRole("button", { name: "Guardar" }).click();
    await expect(ben.getByText("Listo, tu nombre se actualizó.")).toBeVisible();
    await expect(ben.getByRole("region", { name: "La cuenta de la mesa" })).toContainText("Ben · #2");
  });
});
