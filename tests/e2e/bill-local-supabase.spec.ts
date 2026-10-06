import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync(".bill-local-demo.json", "utf8")) as {
  slug: string;
  token: string;
  tableId: string;
  users: { email: string; password: string }[];
};
const guest = `/r/${fixture.slug}/t/${fixture.token}`;
const staff = `/app/${fixture.slug}/servicio`;

test("two real staff sessions and two guest browsers use local Supabase", async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext()));
  const [owner, server, ana, ben] = await Promise.all(contexts.map((c) => c.newPage()));
  const errors: string[] = [];
  for (const page of [owner, server, ana, ben]) page.on("pageerror", (e) => errors.push(e.message));
  for (const [page, user] of [
    [owner, fixture.users[0]],
    [server, fixture.users[1]],
  ] as const) {
    await page.goto(`/es/entrar?next=${encodeURIComponent(staff)}`);
    await page.locator('input[name="email"]').first().fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page
      .locator("form")
      .first()
      .getByRole("button", { name: /entrar|iniciar|acceder/i })
      .click();
    await expect(page.getByRole("heading", { name: "Visitas y cuentas divididas" })).toBeVisible({
      timeout: 20000,
    });
  }
  await owner.getByLabel("Mesa para dividir cuenta").selectOption(fixture.tableId);
  await server.getByLabel("Mesa para dividir cuenta").selectOption(fixture.tableId);
  await owner.getByRole("button", { name: "Abrir visita", exact: true }).click();
  await expect(server.getByText("Mesa Test 1 · open")).toBeVisible({ timeout: 15000 });
  for (const [page, name] of [
    [ana, "Ana"],
    [ben, "Ben"],
  ] as const) {
    await page.goto(guest);
    await page.getByLabel("Tu nombre", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Unirme", exact: true }).click();
    await expect(page.getByText("Tus pedidos necesitan aceptación", { exact: false })).toBeVisible();
  }
  for (const page of [ana, ben]) {
    await page.getByRole("button", { name: /Añadir.*Plato local/ }).click();
    await page.getByRole("button", { name: /Ver.*pedido|Ver.*orden/ }).click();
    await page.getByRole("button", { name: "Enviar a cocina", exact: true }).click();
    await expect(page.getByText("Por aceptar", { exact: true }).first()).toBeVisible();
  }
  await expect(server.getByRole("button", { name: "Aceptar y enviar a cocina" })).toHaveCount(2, {
    timeout: 15000,
  });
  await server.getByRole("button", { name: "Aceptar y enviar a cocina" }).first().click();
  await owner.getByRole("button", { name: "Aceptar y enviar a cocina" }).first().click();
  await expect(owner.getByText("Subtotal $20.02", { exact: false })).toBeVisible({ timeout: 15000 });
  await owner.getByRole("checkbox", { name: /Ana/ }).check();
  await owner.getByRole("checkbox", { name: /Ben/ }).check();
  await owner.getByRole("button", { name: "Bloquear cuenta y guardar reparto" }).click();
  await expect(ana.getByText("Cuenta bloqueada para pagar", { exact: true })).toBeVisible({ timeout: 15000 });
  const selections = owner.getByRole("checkbox", { name: /unpaid/ });
  await selections.nth(0).check();
  await selections.nth(1).check();
  const payer = await owner
    .getByLabel("Persona que paga")
    .locator("option")
    .filter({ hasText: "Ana" })
    .getAttribute("value");
  await owner.getByLabel("Persona que paga").selectOption(payer!);
  await owner.getByLabel("Efectivo entregado ($)").fill("25");
  await owner.getByRole("button", { name: "Confirmar efectivo recibido" }).click();
  await expect(ana.getByRole("heading", { name: /Mi recibo/ })).toBeVisible({ timeout: 15000 });
  await expect(ben.getByRole("heading", { name: /Mi recibo/ })).toHaveCount(0);
  await expect(owner.getByRole("button", { name: /Imprimir recibo · Ana/ })).toBeVisible();
  expect(errors).toEqual([]);
  await Promise.all(contexts.map((c) => c.close()));
});
