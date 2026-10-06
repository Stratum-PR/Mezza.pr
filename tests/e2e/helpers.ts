import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

/** Seeded local-only password for every test login (README). */
export const PASSWORD = "mezza-local-2026";

/**
 * Each parallel worker has its own copy of Café Lucía (`pnpm seed:e2e`), so tests never share
 * settings, tables, sales totals or rate limits. Worker 0 uses Café Lucía itself; worker k uses
 * `cafe-lucia-w{k}`, whose ids carry the `c0ffee0{k}-` prefix and whose logins are `dueno.w{k}@…`.
 */
export function worker() {
  const k = Number(process.env.TEST_PARALLEL_INDEX ?? 0);
  return {
    index: k,
    slug: k === 0 ? "cafe-lucia" : `cafe-lucia-w${k}`,
    prefix: `c0ffee0${k}`,
  };
}

/** This worker's restaurant name as staff and Stratum admin see it. */
export const restaurantName = () => (worker().index === 0 ? "Café Lucía" : `Café Lucía (w${worker().index})`);

/** "/app/cafe-lucia" for this worker's restaurant. */
export const app = () => `/app/${worker().slug}`;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches a URL that ends at this worker's app page, e.g. atApp("/menu") for /app/cafe-lucia/menu. */
export const atApp = (path = "") => new RegExp(`${escape(app() + path)}$`);

/** This worker's login for a Café Lucía role: "dueno", "gerente", "mesero" or "cocina". */
export function email(handle: "dueno" | "gerente" | "mesero" | "cocina"): string {
  const { index } = worker();
  return index === 0 ? `${handle}@cafelucia.example` : `${handle}.w${index}@cafelucia.example`;
}

/** This worker's Mesa N id (c0ffee0{k}-0005-…-0000000000NN). */
export function tableId(table: number): string {
  return `${worker().prefix}-0005-4000-8000-0000000000${String(table).padStart(2, "0")}`;
}

/**
 * Signs in through the login page. Waits for hydration before submitting and gives the sign-in
 * time to finish: under parallel test load the server can take several seconds.
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

/** The guest URL printed in this worker's Mesa N QR code. */
export function guestUrl(table: number, version = 1): string {
  if (!process.env.QR_TOKEN_SECRET && existsSync(".env.local")) process.loadEnvFile(".env.local");
  const token = createHmac("sha256", process.env.QR_TOKEN_SECRET!)
    .update(`${tableId(table)}:${version}`)
    .digest("base64url");
  return `/r/${worker().slug}/t/${token}`;
}

/** Service-role REST access to the LOCAL Supabase for test setup. Refuses non-local URLs. */
export function localRest() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local")) process.loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url))
    throw new Error("test setup only runs against local Supabase");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return {
    url,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  };
}

/**
 * Test-only reset against the LOCAL Supabase: closes this worker's Mesa N live tab and cancels its
 * pending payments, so a guest test starts from an empty table.
 */
export async function resetTable(table: number): Promise<void> {
  const { url, headers } = localRest();
  const tabs = (await (
    await fetch(`${url}/rest/v1/tabs?table_id=eq.${tableId(table)}&status=neq.closed&select=id`, { headers })
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
