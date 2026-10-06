import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
test.skip(
  process.env.MEZZA_BILL_TEST_FIXTURE !== "1",
  "Use playwright.bills.config.ts with the isolated fixture",
);
const url = `/r/bill-browser/t/${createHmac("sha256", "fixture-qr-secret-01234567890123456789").update("20000000-0000-4000-8000-000000000020").digest("base64url")}`;
test("two phones, staff review, exact even split, one payer and next-party isolation", async ({
  browser,
  request,
}) => {
  const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
    phoneA = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    phoneB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  // Fixture auth is deliberately synthetic; real Supabase auth is covered by staging verification.
  const auth = await (await request.get("http://127.0.0.1:54329/fixture/session")).json();
  await staff.addCookies([
    {
      name: "sb-127-auth-token",
      value: "base64-" + Buffer.from(JSON.stringify(auth)).toString("base64url"),
      url: "http://127.0.0.1:3017",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const employee = await staff.newPage(),
    a = await phoneA.newPage(),
    b = await phoneB.newPage();
  const errors: string[] = [];
  for (const page of [employee, a, b]) page.on("pageerror", (e) => errors.push(e.message));
  await a.goto(url);
  await expect(a.getByText("El personal debe abrir la visita", { exact: false })).toBeVisible();
  await a.getByRole("button", { name: "en", exact: true }).click();
  await expect(a.getByText("Staff must open a visit", { exact: false })).toBeVisible();
  await a.getByRole("button", { name: "es", exact: true }).click();
  await employee.goto("/app/bill-browser/servicio");
  await employee.getByLabel("Mesa para dividir cuenta").selectOption("20000000-0000-4000-8000-000000000020");
  await employee.getByRole("button", { name: "Abrir visita", exact: true }).click();
  for (const [page, name] of [
    [a, "Ana"],
    [b, "Ben"],
  ] as const) {
    await page.goto(url);
    await page.getByLabel("Tu nombre", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Unirme", exact: true }).click();
    await expect(page.getByText("Tus pedidos necesitan aceptación", { exact: false })).toBeVisible();
  }
  for (const page of [a, b]) {
    await page.getByRole("button", { name: /Añadir.*Plato de prueba/ }).click();
    await page.getByRole("button", { name: /Ver.*pedido|Ver.*orden/ }).click();
    await page.getByRole("button", { name: "Enviar a cocina", exact: true }).click();
    await expect(page.getByText("Por aceptar", { exact: true }).first()).toBeVisible();
  }
  await expect(employee.getByRole("button", { name: "Aceptar y enviar a cocina" })).toHaveCount(2, {
    timeout: 15000,
  });
  await employee.getByRole("button", { name: "Aceptar y enviar a cocina" }).first().click();
  await employee.getByRole("button", { name: "Aceptar y enviar a cocina" }).first().click();
  await employee.getByRole("checkbox", { name: /Ana/ }).check();
  await employee.getByRole("checkbox", { name: /Ben/ }).check();
  await employee.getByRole("button", { name: "Bloquear cuenta y guardar reparto" }).click();
  await expect(a.getByText("Cuenta bloqueada para pagar", { exact: true })).toBeVisible({ timeout: 15000 });
  const selections = employee.getByRole("checkbox", { name: /unpaid/ });
  await selections.nth(0).check();
  await selections.nth(1).check();
  const payerId = await employee
    .getByLabel("Persona que paga")
    .locator("option")
    .filter({ hasText: "Ana" })
    .getAttribute("value");
  await employee.getByLabel("Persona que paga").selectOption(payerId!);
  await employee.getByLabel("Efectivo entregado ($)").fill("10");
  await expect(employee.getByRole("button", { name: "Confirmar efectivo recibido" })).toBeDisabled();
  await employee.getByLabel("Efectivo entregado ($)").fill("25");
  await employee.getByRole("button", { name: "Confirmar efectivo recibido" }).click();
  await expect(employee.getByRole("button", { name: /Imprimir recibo · Ana/ })).toBeVisible();
  await expect(a.getByRole("heading", { name: /Mi recibo/ })).toBeVisible({ timeout: 15000 });
  await expect(b.getByRole("heading", { name: /Mi recibo/ })).toHaveCount(0);
  await expect(b.getByText("Pagó: Ana", { exact: false }).first()).toBeVisible({ timeout: 15000 });
  employee.once("dialog", (d) => d.accept());
  await employee.getByRole("button", { name: "Cerrar visita en POS" }).click();
  await expect(employee.getByRole("button", { name: "Abrir visita", exact: true })).toBeVisible();
  await employee.getByRole("button", { name: "Abrir visita", exact: true }).click();
  await expect(employee.getByRole("checkbox", { name: /Avisé que los carritos/ })).not.toBeChecked();
  await expect(a.getByRole("button", { name: "Unirme", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(a.getByText("Tus pedidos necesitan aceptación", { exact: false })).toHaveCount(0);
  await expect(a.getByRole("heading", { name: /Mi recibo/ })).toBeVisible();
  expect(errors).toEqual([]);
  await Promise.all([staff.close(), phoneA.close(), phoneB.close()]);
});
