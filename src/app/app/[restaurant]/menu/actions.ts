"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { dollarsToCents } from "@/lib/money";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

const uuid = z.uuid();
const name = z.string().trim().min(1).max(80);
const description = z.string().trim().max(240).optional().default("");

async function context(slug: string) {
  const ctx = await requireSection(slug, "menu");
  return { ctx, db: await createClient() };
}

function done(slug: string, id?: string): ActionResult {
  revalidatePath(`/app/${slug}/menu`);
  return { ok: true, id };
}

function failed(message: string | undefined): ActionResult {
  return { ok: false, error: message ?? "save_failed" };
}

// --- Sections ---------------------------------------------------------------

const sectionSchema = z.object({ id: uuid.optional(), nameEs: name, nameEn: name });

export async function saveSection(slug: string, input: z.input<typeof sectionSchema>): Promise<ActionResult> {
  const parsed = sectionSchema.safeParse(input);
  if (!parsed.success) return failed("invalid");
  const { ctx, db } = await context(slug);
  const { id, nameEs, nameEn } = parsed.data;
  if (id) {
    const { error } = await db
      .from("menu_sections")
      .update({ name_es: nameEs, name_en: nameEn })
      .eq("id", id);
    return error ? failed(error.message) : done(slug, id);
  }
  const { count } = await db
    .from("menu_sections")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", ctx.restaurant.id);
  const { data, error } = await db
    .from("menu_sections")
    .insert({ restaurant_id: ctx.restaurant.id, name_es: nameEs, name_en: nameEn, sort_order: count ?? 0 })
    .select("id")
    .single();
  return error ? failed(error.message) : done(slug, data.id);
}

export async function reorderSections(slug: string, ids: string[]): Promise<ActionResult> {
  const parsed = z.array(uuid).max(100).safeParse(ids);
  if (!parsed.success) return failed("invalid");
  const { db } = await context(slug);
  for (const [index, id] of parsed.data.entries()) {
    const { error } = await db.from("menu_sections").update({ sort_order: index }).eq("id", id);
    if (error) return failed(error.message);
  }
  return done(slug);
}

/** Archives a section and its dishes (history and past bills keep them). */
export async function archiveSection(slug: string, id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return failed("invalid");
  const { db } = await context(slug);
  const now = new Date().toISOString();
  const items = await db
    .from("menu_items")
    .update({ archived_at: now })
    .eq("section_id", id)
    .is("archived_at", null);
  if (items.error) return failed(items.error.message);
  const { error } = await db.from("menu_sections").update({ archived_at: now }).eq("id", id);
  return error ? failed(error.message) : done(slug);
}

// --- Dishes -----------------------------------------------------------------

const itemSchema = z.object({
  id: uuid.optional(),
  sectionId: uuid,
  nameEs: name,
  nameEn: name,
  descriptionEs: description,
  descriptionEn: description,
  price: z.string(),
  groupIds: z.array(uuid).max(10).default([]),
  tags: z
    .array(z.enum(["vegetariano", "sin_gluten", "picante"]))
    .max(3)
    .default([]),
});

export async function saveItem(slug: string, input: z.input<typeof itemSchema>): Promise<ActionResult> {
  const parsed = itemSchema.safeParse(input);
  if (!parsed.success) return failed("invalid");
  const priceCents = dollarsToCents(parsed.data.price);
  if (priceCents === null) return failed("price");
  const { ctx, db } = await context(slug);
  const d = parsed.data;
  const row = {
    section_id: d.sectionId,
    name_es: d.nameEs,
    name_en: d.nameEn,
    description_es: d.descriptionEs || null,
    description_en: d.descriptionEn || null,
    price_cents: priceCents,
    tags: [...new Set(d.tags)],
  };

  let id = d.id;
  if (id) {
    const { error } = await db.from("menu_items").update(row).eq("id", id);
    if (error) return failed(error.message);
  } else {
    const { count } = await db
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("section_id", d.sectionId);
    const { data, error } = await db
      .from("menu_items")
      .insert({ ...row, restaurant_id: ctx.restaurant.id, sort_order: count ?? 0 })
      .select("id")
      .single();
    if (error) return failed(error.message);
    id = data.id;
  }

  const removed = await db.from("item_modifier_groups").delete().eq("item_id", id);
  if (removed.error) return failed(removed.error.message);
  if (d.groupIds.length > 0) {
    const { error } = await db.from("item_modifier_groups").insert(
      d.groupIds.map((groupId, i) => ({
        restaurant_id: ctx.restaurant.id,
        item_id: id!,
        group_id: groupId,
        sort_order: i,
      })),
    );
    if (error) return failed(error.message);
  }
  return done(slug, id);
}

export async function archiveItem(slug: string, id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return failed("invalid");
  const { db } = await context(slug);
  const { error } = await db
    .from("menu_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  return error ? failed(error.message) : done(slug);
}

/** Sold-out toggle; set_item_availability also writes item_availability_events. */
export async function setAvailability(slug: string, id: string, available: boolean): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return failed("invalid");
  const { db } = await context(slug);
  const { error } = await db.rpc("set_item_availability", { p_item_id: id, p_available: available });
  return error ? failed(error.message) : done(slug);
}

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function uploadPhoto(slug: string, itemId: string, form: FormData): Promise<ActionResult> {
  const file = form.get("photo");
  if (!uuid.safeParse(itemId).success || !(file instanceof File)) return failed("invalid");
  const ext = PHOTO_TYPES[file.type];
  if (!ext) return failed("photo_type");
  if (file.size > MAX_PHOTO_BYTES) return failed("photo_size");
  const { ctx, db } = await context(slug);
  const path = `${ctx.restaurant.id}/items/${itemId}-${Date.now()}.${ext}`;
  const upload = await db.storage.from("photos").upload(path, file, { contentType: file.type });
  if (upload.error) return failed(upload.error.message);
  const { error } = await db.from("menu_items").update({ photo_path: path }).eq("id", itemId);
  return error ? failed(error.message) : done(slug, itemId);
}

// --- Modifier groups ----------------------------------------------------------

const groupSchema = z
  .object({
    id: uuid.optional(),
    nameEs: name,
    nameEn: name,
    min: z.number().int().min(0).max(20),
    max: z.number().int().min(1).max(20),
    options: z
      .array(z.object({ nameEs: name, nameEn: name, price: z.string() }))
      .min(1)
      .max(20),
  })
  .refine((g) => g.max >= g.min && g.max <= g.options.length, { message: "range" });

export async function saveGroup(slug: string, input: z.input<typeof groupSchema>): Promise<ActionResult> {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success)
    return failed(parsed.error.issues.some((i) => i.message === "range") ? "range" : "invalid");
  const prices = parsed.data.options.map((o) => dollarsToCents(o.price || "0"));
  if (prices.some((p) => p === null)) return failed("price");
  const { ctx, db } = await context(slug);
  const d = parsed.data;
  const row = { name_es: d.nameEs, name_en: d.nameEn, min_select: d.min, max_select: d.max };

  let id = d.id;
  if (id) {
    const { error } = await db.from("modifier_groups").update(row).eq("id", id);
    if (error) return failed(error.message);
    // Past orders keep their own snapshots, so options can be replaced.
    const removed = await db.from("modifier_options").delete().eq("group_id", id);
    if (removed.error) return failed(removed.error.message);
  } else {
    const { data, error } = await db
      .from("modifier_groups")
      .insert({ ...row, restaurant_id: ctx.restaurant.id })
      .select("id")
      .single();
    if (error) return failed(error.message);
    id = data.id;
  }
  const { error } = await db.from("modifier_options").insert(
    d.options.map((o, i) => ({
      restaurant_id: ctx.restaurant.id,
      group_id: id!,
      name_es: o.nameEs,
      name_en: o.nameEn,
      price_cents: prices[i]!,
      sort_order: i,
    })),
  );
  return error ? failed(error.message) : done(slug, id);
}

export async function deleteGroup(slug: string, id: string): Promise<ActionResult> {
  if (!uuid.safeParse(id).success) return failed("invalid");
  const { db } = await context(slug);
  const { error } = await db.from("modifier_groups").delete().eq("id", id);
  return error ? failed(error.message) : done(slug);
}
