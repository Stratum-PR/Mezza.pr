import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** Seeded local-only password for every test login (README). */
export const PASSWORD = "mezza-local-2026";

/**
 * Signs in through the login page. Waits for hydration before submitting and gives the sign-in
 * time to finish: under parallel test load `next dev` can take several seconds.
 */
export async function login(page: Page, email: string, next?: string, password = PASSWORD) {
  await page.goto(next ? `/es/entrar?next=${encodeURIComponent(next)}` : "/es/entrar");
  await page.waitForLoadState("networkidle");
  const form = page.locator("form").first();
  await form.getByLabel("Correo electrónico").fill(email);
  await form.getByLabel("Contraseña").fill(password);
  await form.getByRole("button", { name: "Entrar" }).click();
  if (password === PASSWORD) {
    await expect(page).not.toHaveURL(/\/es\/entrar/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle"); // let the destination hydrate before the test clicks
  }
}

/** The guest URL printed in a Café Lucía table's QR code (tables c0ffee00-0005-…-0000000000NN). */
export function guestUrl(table: number, version = 1): string {
  if (!process.env.QR_TOKEN_SECRET && existsSync(".env.local")) process.loadEnvFile(".env.local");
  const id = `c0ffee00-0005-4000-8000-0000000000${String(table).padStart(2, "0")}`;
  const token = createHmac("sha256", process.env.QR_TOKEN_SECRET!)
    .update(`${id}:${version}`)
    .digest("base64url");
  return `/r/cafe-lucia/t/${token}`;
}

/**
 * Test-only reset against the LOCAL Supabase: closes a Café Lucía table's live tab and cancels its
 * pending payments, so a guest test starts from an empty table. Refuses non-local URLs.
 */
export async function resetTable(table: number): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url))
    throw new Error("resetTable only runs against local Supabase");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const tableId = `c0ffee00-0005-4000-8000-0000000000${String(table).padStart(2, "0")}`;
  const tabs = (await (
    await fetch(`${url}/rest/v1/tabs?table_id=eq.${tableId}&status=neq.closed&select=id`, { headers })
  ).json()) as { id: string }[];
  const now = new Date().toISOString();
  for (const { id } of tabs) {
    await fetch(`${url}/rest/v1/payments?tab_id=eq.${id}&status=eq.pending`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "failed" }),
    });
    await fetch(`${url}/rest/v1/service_requests?tab_id=eq.${id}&status=eq.open`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "handled", handled_at: now }),
    });
    await fetch(`${url}/rest/v1/tabs?id=eq.${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "closed", closed_at: now, pos_closed_at: now }),
    });
  }
}
