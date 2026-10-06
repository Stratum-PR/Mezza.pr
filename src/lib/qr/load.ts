import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { serverEnv } from "@/lib/server-env";
import type { CardDesign, CardTable } from "./card";
import { deriveQrToken, tableUrl } from "./token";

export interface QrStudioData {
  design: CardDesign & { preset: string; logoPath: string | null };
  tables: (CardTable & { tokenVersion: number })[];
}

/** The restaurant's QR design and every table's printable URL (tokens are derived, never stored). */
export async function loadQrStudio(
  db: SupabaseClient<Database>,
  restaurant: { id: string; slug: string; name: string },
): Promise<QrStudioData> {
  const [{ data: design }, { data: tables }] = await Promise.all([
    db.from("qr_designs").select("*").eq("restaurant_id", restaurant.id).single(),
    db
      .from("dining_tables")
      .select("id, label, token_version")
      .eq("restaurant_id", restaurant.id)
      .order("sort_order"),
  ]);
  let logoSrc: string | undefined;
  if (design?.logo_path) {
    const { data } = await db.storage.from("photos").createSignedUrl(design.logo_path, 3600);
    logoSrc = data?.signedUrl;
  }
  const base = process.env.NEXT_PUBLIC_GUEST_BASE_URL ?? "http://localhost:3000";
  return {
    design: {
      preset: design?.preset ?? "house",
      fg: design?.fg ?? "#1E2B7E",
      bg: design?.bg ?? "#FFFFFF",
      frame: design?.frame ?? "#1E2B7E",
      frameInk: design?.frame_ink ?? "#FFFFFF",
      dotStyle: design?.dot_style ?? "rounded",
      eyeStyle: design?.eye_style ?? "rounded",
      logoMode: design?.logo_mode ?? "none",
      logoPath: design?.logo_path ?? null,
      logoSrc,
      frameTextEs: design?.frame_text_es ?? "Escanea para ordenar y pagar",
      frameTextEn: design?.frame_text_en ?? "Scan to order and pay",
      font: design?.font ?? "modern",
      restaurantName: restaurant.name,
      displayHost: process.env.NEXT_PUBLIC_GUEST_DISPLAY_HOST ?? "mezza.pr",
    },
    tables: (tables ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      tokenVersion: t.token_version,
      url: tableUrl(base, restaurant.slug, deriveQrToken(serverEnv.QR_TOKEN_SECRET, t.id, t.token_version)),
    })),
  };
}
