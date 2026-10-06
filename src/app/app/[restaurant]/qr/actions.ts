"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { deriveQrToken, hashQrToken } from "@/lib/qr/token";
import { serverEnv } from "@/lib/server-env";

export type QrActionResult =
  { ok: true; logoSrc?: string } | { ok: false; error: "invalid" | "logo_type" | "logo_size" | "failed" };

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const designSchema = z.object({
  preset: z.enum(["house", "bold", "clean", "custom"]),
  fg: hex,
  bg: hex,
  frame: hex,
  frameInk: hex,
  dotStyle: z.enum(["square", "rounded", "dots"]),
  eyeStyle: z.enum(["square", "rounded", "circle"]),
  logoMode: z.enum(["none", "mono", "upload"]),
  frameTextEs: z.string().trim().min(1).max(60),
  frameTextEn: z.string().trim().min(1).max(60),
  font: z.enum(["menu", "modern"]),
});

export type DesignInput = z.input<typeof designSchema>;

export async function saveQrDesign(slug: string, input: DesignInput): Promise<QrActionResult> {
  const parsed = designSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const ctx = await requireSection(slug, "qr");
  const d = parsed.data;
  const db = await createClient();
  const { data: current } = await db
    .from("qr_designs")
    .select("logo_path")
    .eq("restaurant_id", ctx.restaurant.id)
    .single();
  const { error } = await db
    .from("qr_designs")
    .update({
      preset: d.preset,
      fg: d.fg,
      bg: d.bg,
      frame: d.frame,
      frame_ink: d.frameInk,
      dot_style: d.dotStyle,
      eye_style: d.eyeStyle,
      // An uploaded logo needs a file; fall back to the monogram until there is one.
      logo_mode: d.logoMode === "upload" && !current?.logo_path ? "mono" : d.logoMode,
      frame_text_es: d.frameTextEs,
      frame_text_en: d.frameTextEn,
      font: d.font,
    })
    .eq("restaurant_id", ctx.restaurant.id);
  if (error) return { ok: false, error: "failed" };
  revalidatePath(`/app/${slug}/qr`);
  return { ok: true };
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg" };

export async function uploadQrLogo(slug: string, form: FormData): Promise<QrActionResult> {
  const ctx = await requireSection(slug, "qr");
  const file = form.get("logo");
  if (!(file instanceof File) || !LOGO_TYPES[file.type]) return { ok: false, error: "logo_type" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "logo_size" };
  const db = await createClient();
  const path = `${ctx.restaurant.id}/qr/logo-${Date.now()}.${LOGO_TYPES[file.type]}`;
  const stored = await db.storage.from("photos").upload(path, file, { contentType: file.type });
  if (stored.error) return { ok: false, error: "failed" };
  const { error } = await db
    .from("qr_designs")
    .update({ logo_path: path, logo_mode: "upload" })
    .eq("restaurant_id", ctx.restaurant.id);
  if (error) return { ok: false, error: "failed" };
  // Hand the new logo back so the studio preview shows it right away.
  const { data: signed } = await db.storage.from("photos").createSignedUrl(path, 3600);
  revalidatePath(`/app/${slug}/qr`);
  return { ok: true, logoSrc: signed?.signedUrl };
}

/** "Cambiar código": bumps token_version so the old printed code stops working. */
export async function rotateTableCode(slug: string, tableId: string): Promise<QrActionResult> {
  if (!z.uuid().safeParse(tableId).success) return { ok: false, error: "invalid" };
  const ctx = await requireSection(slug, "qr");
  const db = await createClient();
  const { data: table } = await db
    .from("dining_tables")
    .select("id, token_version")
    .eq("id", tableId)
    .eq("restaurant_id", ctx.restaurant.id)
    .single();
  if (!table) return { ok: false, error: "invalid" };
  const version = table.token_version + 1;
  const { error } = await db
    .from("dining_tables")
    .update({
      token_version: version,
      qr_token_hash: hashQrToken(deriveQrToken(serverEnv.QR_TOKEN_SECRET, tableId, version)),
    })
    .eq("id", tableId);
  if (error) return { ok: false, error: "failed" };
  revalidatePath(`/app/${slug}/qr`);
  return { ok: true };
}
