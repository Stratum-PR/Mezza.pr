import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { guestUrl, resetTable } from "./helpers";

test("quick add, cart quantities and section chips that follow the scroll", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "phone layout");
  await page.goto(guestUrl(6));
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Simple", exact: true }).click();

  // A dish with no required choices goes straight into the cart.
  await page.getByRole("button", { name: "Añadir Malta" }).click();
  await page.getByRole("button", { name: "Añadir Malta" }).click();
  await expect(page.getByRole("button", { name: /Ver pedido \(2\) · \$4\.00/ })).toBeVisible();

  // One with a required choice (the milk) opens the dish sheet, its add button always in view.
  await page.getByRole("button", { name: "Añadir Café con leche" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("heading", { name: "Café con leche" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Añadir al pedido/ })).toBeInViewport();
  await sheet.getByRole("button", { name: "Cerrar" }).click();

  // The cart changes quantities in place.
  await page.getByRole("button", { name: /Ver pedido/ }).click();
  const cart = page.getByRole("dialog", { name: "Tu pedido" });
  await cart.getByRole("button", { name: "Uno más de Malta" }).click();
  await expect(cart.getByText("$6.00").first()).toBeVisible();
  await cart.getByRole("button", { name: "Uno menos de Malta" }).click();
  await expect(cart.getByText("$4.00").first()).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/guest-cart.phone.light.png" });
  await cart.getByRole("button", { name: "Seguir pidiendo" }).click();
  await expect(cart).toBeHidden();

  // The chips stay on screen and mark the section being read.
  await page.getByRole("heading", { name: "Bebidas" }).scrollIntoViewIfNeeded();
  const chips = page.getByRole("navigation", { name: "Secciones" });
  await expect(chips).toBeInViewport();
  await expect(page.locator('[aria-current="location"]')).toHaveText(/Sándwiches|Dulces|Bebidas/);
  await page.screenshot({ path: "docs/screenshots/guest-menu-simple.phone.light.png" });
  await page.evaluate(() => localStorage.clear());
});

test("a receipt from an earlier visit doesn't come back", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "phone layout");
  await resetTable(8);
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const tableId = "c0ffee00-0005-4000-8000-000000000008";
  // A payment from the seeded history (days ago) at Mesa 8, as if this phone had paid it.
  const [old] = (await (
    await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/payments?select=id,tabs!inner(table_id)&tabs.table_id=eq.${tableId}&status=eq.paid&order=paid_at.asc&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
  ).json()) as { id: string }[];

  await page.goto(guestUrl(8));
  await page.evaluate(([k, v]) => localStorage.setItem(k!, v!), [`mezza-payment:${tableId}`, old!.id]);
  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /^Mi pedido/ })).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k), `mezza-payment:${tableId}`)).toBeNull();
});

test("a code printed under an old restaurant link still opens the table", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "phone layout");
  const current = guestUrl(5);
  await page.goto(current.replace("/r/cafe-lucia/", "/r/nombre-viejo/"));
  await expect.poll(() => new URL(page.url()).pathname).toBe(current);
  await expect(page.getByText("Mesa 5")).toBeVisible();
});
