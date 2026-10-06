import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import { hashQrToken, isTokenShape } from "@/lib/qr/token";

export interface GuestTable {
  restaurant: {
    id: string;
    slug: string;
    name: string;
    defaultLanguage: "es" | "en";
    ivuStateBps: number;
    ivuMunicipalBps: number;
  };
  table: { id: string; label: string };
}

/**
 * Resolves a printed QR token to its restaurant and table: sha256(token) must match the table's
 * stored hash. The token alone identifies the table, so codes printed before the restaurant changed
 * its link (slug) keep working; the page redirects them to the current link. Rotated or invalid
 * tokens resolve to null. Every guest read and write calls this first.
 */
export async function resolveTable(_slug: string, token: string): Promise<GuestTable | null> {
  if (!isTokenShape(token)) return null;
  const { data } = await createAdminClient()
    .from("dining_tables")
    .select(
      "id, label, restaurants!inner(id, slug, name, default_language, ivu_state_bps, ivu_municipal_bps)",
    )
    .eq("qr_token_hash", hashQrToken(token))
    .maybeSingle();
  if (!data?.restaurants) return null;
  const r = data.restaurants;
  return {
    restaurant: {
      id: r.id,
      slug: r.slug,
      name: r.name,
      defaultLanguage: r.default_language,
      ivuStateBps: r.ivu_state_bps,
      ivuMunicipalBps: r.ivu_municipal_bps,
    },
    table: { id: data.id, label: data.label },
  };
}

/** The table's live tab (open or paying), if any. */
export async function liveTab(tableId: string) {
  const { data } = await createAdminClient()
    .from("tabs")
    .select("id, status, opened_at")
    .eq("table_id", tableId)
    .neq("status", "closed")
    .maybeSingle();
  return data;
}

/** Opens a tab for the table if none is live (service requests can come before the first order). */
export async function ensureTab(restaurantId: string, tableId: string): Promise<string> {
  const existing = await liveTab(tableId);
  if (existing) return existing.id;
  const db = createAdminClient();
  const { data, error } = await db
    .from("tabs")
    .insert({ restaurant_id: restaurantId, table_id: tableId })
    .select("id")
    .single();
  if (data) return data.id;
  // Lost a race with another phone at the same table: the unique index kept one live tab.
  const again = await liveTab(tableId);
  if (again) return again.id;
  throw new Error(`could not open a tab: ${error?.message}`);
}
