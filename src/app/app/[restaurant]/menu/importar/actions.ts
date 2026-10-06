"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isNotImplemented, mocksAllowed } from "@/connectors/shared";
import { menuImporter } from "@/connectors/menu-import";
import { requireSection } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/db/admin";
import type { Json } from "@/lib/db/types";
import { createClient } from "@/lib/db/server";
import { isMenuFont } from "@/config/menu-fonts";
import { menuImageSize } from "@/lib/menu/image";
import { readOriginalUpload } from "@/lib/menu/original";

export type ImportState = { error?: "file_type" | "file_size" | "coming_soon" | "failed" };

const TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAX_BYTES = 15 * 1024 * 1024;

export async function startImport(slug: string, _: ImportState, form: FormData): Promise<ImportState> {
  const ctx = await requireSection(slug, "menu");
  const file = form.get("menu");
  if (!(file instanceof File) || !TYPES[file.type]) return { error: "file_type" };
  if (file.size > MAX_BYTES) return { error: "file_size" };
  if (!mocksAllowed()) {
    if (file.type === "application/pdf") return { error: "coming_soon" };
    try {
      await menuImageSize(Buffer.from(await file.arrayBuffer()), file.type);
    } catch {
      return { error: "file_type" };
    }
  }

  const path = `${ctx.restaurant.id}/uploads/${crypto.randomUUID()}.${TYPES[file.type]}`;
  const db = await createClient(); // the manager's own session; storage RLS checks the role
  const stored = await db.storage.from("menus").upload(path, file, { contentType: file.type });
  if (stored.error) return { error: "failed" };

  if (!mocksAllowed()) {
    const { data, error } = await db
      .from("menu_uploads")
      .insert({
        restaurant_id: ctx.restaurant.id,
        storage_path: path,
        mime_type: file.type,
        status: "review",
      })
      .select("id")
      .single();
    if (error) return { error: "failed" };
    redirect(`/app/${slug}/menu/importar/${data.id}`);
  }

  let uploadId: string;
  try {
    ({ uploadId } = await menuImporter().start(
      { restaurantId: ctx.restaurant.id, actorUserId: ctx.userId, locale: "es" },
      { storagePath: path, mimeType: file.type },
    ));
  } catch (error) {
    return { error: isNotImplemented(error) ? "coming_soon" : "failed" };
  }
  redirect(`/app/${slug}/menu/importar/${uploadId}`);
}

const fraction = z.number().min(0).max(1);
const payloadSchema = z.object({
  sections: z
    .array(z.object({ key: z.string(), nameEs: z.string().min(1), nameEn: z.string().min(1) }))
    .min(1),
  items: z
    .array(
      z.object({
        sectionKey: z.string(),
        nameEs: z.string().trim().min(1).max(80),
        nameEn: z.string().trim().min(1).max(80),
        descriptionEs: z.string().max(240).optional(),
        descriptionEn: z.string().max(240).optional(),
        priceCents: z.number().int().min(0), // confirmed: never null at publish
        confidence: z.number().min(0).max(1),
        modifierGroupKeys: z.array(z.string()),
        hotspot: z
          .object({
            page: z.number().int().min(1),
            x: fraction,
            y: fraction,
            width: fraction,
            height: fraction,
          })
          .optional(),
      }),
    )
    .min(1),
  modifierGroups: z.array(
    z.object({
      key: z.string(),
      nameEs: z.string(),
      nameEn: z.string(),
      min: z.number().int().min(0),
      max: z.number().int().min(1),
      options: z.array(
        z.object({ nameEs: z.string(), nameEn: z.string(), priceCents: z.number().int().min(0) }),
      ),
    }),
  ),
  theme: z.object({
    palette: z.object({ ink: z.string(), paper: z.string(), accent: z.string(), muted: z.string() }),
    displayFont: z.string().refine(isMenuFont),
    bodyFont: z.string().refine(isMenuFont),
    ornament: z.string().optional(),
    paperTexture: z.enum(["none", "linen", "kraft", "parchment"]),
  }),
  pages: z.array(z.object({ storagePath: z.string(), width: z.number().int(), height: z.number().int() })),
  warnings: z.array(z.string()),
});

export type PublishPayload = z.input<typeof payloadSchema>;

export async function publishImport(
  slug: string,
  uploadId: string,
  payload: PublishPayload,
): Promise<{ ok: false; error: "invalid" | "failed" } | never> {
  const ctx = await requireSection(slug, "menu");
  if (!mocksAllowed()) return { ok: false, error: "failed" };
  const parsed = payloadSchema.safeParse(payload);
  if (!z.uuid().safeParse(uploadId).success || !parsed.success) return { ok: false, error: "invalid" };

  // The upload must belong to this restaurant (the admin client below bypasses RLS).
  const db = createAdminClient();
  const { data: upload } = await db
    .from("menu_uploads")
    .select("id")
    .eq("id", uploadId)
    .eq("restaurant_id", ctx.restaurant.id)
    .maybeSingle();
  if (!upload) return { ok: false, error: "invalid" };

  const { error } = await db.rpc("publish_menu_import", {
    p_upload_id: uploadId,
    p_payload: parsed.data as unknown as Json,
    p_reviewed_by: ctx.userId,
  });
  if (error) return { ok: false, error: "failed" };
  revalidatePath(`/app/${slug}/menu`);
  redirect(`/app/${slug}/menu?importado=1`);
}

/** Image-only publication never calls the dish-replacing import RPC. */
export async function publishOriginalImage(slug: string, uploadId: string): Promise<ImportState> {
  const ctx = await requireSection(slug, "menu");
  if (!z.uuid().safeParse(uploadId).success) return { error: "failed" };
  try {
    const db = createAdminClient();
    const upload = await readOriginalUpload(db, ctx.restaurant.id, uploadId);
    if (!upload) return { error: "failed" };
    const { error } = await db.rpc("publish_original_menu_image", {
      p_upload_id: upload.id,
      p_width: upload.width,
      p_height: upload.height,
      p_reviewed_by: ctx.userId,
    });
    if (error) return { error: "failed" };
  } catch {
    return { error: "failed" };
  }
  revalidatePath(`/app/${slug}/menu`);
  revalidatePath(`/r/${slug}/t/[token]`, "page");
  redirect(`/app/${slug}/menu?importado=1`);
}
