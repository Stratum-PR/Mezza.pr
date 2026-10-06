"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSection, type StaffContext } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { publicEnv } from "@/lib/env";

export type FormResult = { ok: true; code?: string } | { ok: false; error: string } | null;

const fail = (error: string): FormResult => ({ ok: false, error });
const done = (slug: string, page: string, code?: string): FormResult => {
  revalidatePath(`/app/${slug}/${page}`);
  return { ok: true, code };
};
const owner = (ctx: StaffContext) => ctx.role === "owner";

// ---------------------------------------------------------------------------------------------
// Equipo
// ---------------------------------------------------------------------------------------------

const inviteSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(200),
  role: z.enum(["manager", "server", "kitchen"]),
});

/** Supabase admin invite from server code; an existing account just gets the membership. */
export async function inviteMember(slug: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requireSection(slug, "team");
  const parsed = inviteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("validation");
  const { name, email, role } = parsed.data;
  // Managers add servers and kitchen staff; only the owner adds managers.
  if (role === "manager" && !owner(ctx)) return fail("forbidden");

  const admin = createAdminClient();
  let userId: string | undefined;
  const invited = await admin.auth.admin.inviteUserByEmail(email.toLowerCase(), {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=/app/contrasena`,
    data: { full_name: name },
  });
  if (invited.data.user) userId = invited.data.user.id;
  else {
    // Already has an account (e.g. works at another restaurant): find it and add the membership.
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;
    if (!userId) return fail("invite_failed");
  }

  const { data: existing } = await admin
    .from("memberships")
    .select("id, role")
    .eq("restaurant_id", ctx.restaurant.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.role === "owner") return fail("forbidden");
  const { error } = existing
    ? await admin.from("memberships").update({ role, active: true }).eq("id", existing.id)
    : await admin.from("memberships").insert({ restaurant_id: ctx.restaurant.id, user_id: userId, role });
  if (error) return fail("failed");
  await admin.from("profiles").upsert({ user_id: userId, full_name: name }, { onConflict: "user_id" });
  return done(slug, "equipo", invited.data.user ? "invited" : "added");
}

const memberSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(["manager", "server", "kitchen"]).optional(),
  active: z.boolean().optional(),
});

/** Change a member's role or (de)activate them. Nobody changes the owner or themselves. */
export async function updateMember(slug: string, input: z.input<typeof memberSchema>): Promise<FormResult> {
  const ctx = await requireSection(slug, "team");
  const parsed = memberSchema.safeParse(input);
  if (!parsed.success) return fail("validation");
  const admin = createAdminClient();
  const { data: m } = await admin
    .from("memberships")
    .select("id, user_id, role")
    .eq("id", parsed.data.memberId)
    .eq("restaurant_id", ctx.restaurant.id)
    .maybeSingle();
  if (!m || m.role === "owner" || m.user_id === ctx.userId) return fail("forbidden");
  if (!owner(ctx) && (m.role === "manager" || parsed.data.role === "manager")) return fail("forbidden");
  const patch: { role?: "manager" | "server" | "kitchen"; active?: boolean } = {};
  if (parsed.data.role) patch.role = parsed.data.role;
  if (parsed.data.active !== undefined) patch.active = parsed.data.active;
  const { error } = await admin.from("memberships").update(patch).eq("id", m.id);
  return error ? fail("failed") : done(slug, "equipo");
}

// ---------------------------------------------------------------------------------------------
// Ajustes (the restaurant row is owner-only under RLS; printers are for managers too)
// ---------------------------------------------------------------------------------------------

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .min(2)
    .max(60),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }),
  default_language: z.enum(["es", "en"]),
  default_menu_style: z.enum(["house", "original", "simple"]),
});

export async function saveProfile(slug: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requireSection(slug, "settings");
  if (!owner(ctx)) return fail("forbidden");
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("validation");
  const { error } = await (
    await createClient()
  )
    .from("restaurants")
    .update(parsed.data)
    .eq("id", ctx.restaurant.id);
  if (error) return fail(error.code === "23505" ? "slug_taken" : "failed");
  // A new slug moves every staff URL (printed QR codes are per table token and keep working via redirect-free tokens).
  if (parsed.data.slug !== slug) redirect(`/app/${parsed.data.slug}/ajustes?saved=1`);
  return done(slug, "ajustes", "saved");
}

const percent = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,2})?$/)
  .transform((v) => Math.round(Number(v) * 100))
  .refine((bps) => bps <= 10000);

export async function saveIvu(slug: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requireSection(slug, "settings");
  if (!owner(ctx)) return fail("forbidden");
  const parsed = z.object({ state: percent, municipal: percent }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("validation");
  const { error } = await (
    await createClient()
  )
    .from("restaurants")
    .update({ ivu_state_bps: parsed.data.state, ivu_municipal_bps: parsed.data.municipal })
    .eq("id", ctx.restaurant.id);
  return error ? fail("failed") : done(slug, "ajustes", "saved");
}

const printerSchema = z.object({
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1).max(60),
  model: z.string().trim().max(60).optional(),
  ip_address: z
    .string()
    .trim()
    .regex(/^(\d{1,3}\.){3}\d{1,3}$|^$/)
    .optional(),
  protocol: z.enum(["browser", "epson_epos", "star_webprnt"]),
  role: z.enum(["kitchen", "receipt"]),
  width_chars: z.coerce.number().int().min(24).max(64),
  active: z
    .string()
    .optional()
    .transform((v) => v === "on"),
});

export async function savePrinter(slug: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requireSection(slug, "settings");
  const parsed = printerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("validation");
  const { id, ...fields } = parsed.data;
  const row = { ...fields, model: fields.model || null, ip_address: fields.ip_address || null };
  if (row.protocol !== "browser" && !row.ip_address) return fail("ip_required");
  const db = await createClient();
  const { error } = id
    ? await db.from("printers").update(row).eq("id", id).eq("restaurant_id", ctx.restaurant.id)
    : await db.from("printers").insert({ ...row, restaurant_id: ctx.restaurant.id });
  return error ? fail(error.code === "42501" ? "forbidden" : "failed") : done(slug, "ajustes", "saved");
}

const COVER_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Marca: brand colour (optional) and cover photo for the guest page. */
export async function saveBrand(slug: string, _: FormResult, form: FormData): Promise<FormResult> {
  const ctx = await requireSection(slug, "settings");
  if (!owner(ctx)) return fail("forbidden");
  const color = String(form.get("brand_color") ?? "");
  const useColor = form.get("use_color") === "on";
  if (useColor && !/^#[0-9a-fA-F]{6}$/.test(color)) return fail("validation");
  const db = await createClient();
  const patch: { brand_color: string | null; cover_path?: string | null } = {
    brand_color: useColor ? color.toUpperCase() : null,
  };
  const cover = form.get("cover");
  if (cover instanceof File && cover.size > 0) {
    if (!COVER_TYPES[cover.type]) return fail("cover_type");
    if (cover.size > 4 * 1024 * 1024) return fail("cover_size");
    const path = `${ctx.restaurant.id}/brand/cover-${Date.now()}.${COVER_TYPES[cover.type]}`;
    const stored = await db.storage.from("photos").upload(path, cover, { contentType: cover.type });
    if (stored.error) return fail("failed");
    patch.cover_path = path;
  }
  if (form.get("remove_cover") === "on") patch.cover_path = null;
  const { error } = await db.from("restaurants").update(patch).eq("id", ctx.restaurant.id);
  return error ? fail("failed") : done(slug, "ajustes", "saved");
}

/** The owner approves (or turns down / ends) a Stratum support-access request; logged in audit_log. */
export async function decideSupport(slug: string, grantId: string, approve: boolean): Promise<FormResult> {
  const ctx = await requireSection(slug, "settings");
  if (!owner(ctx) || !z.uuid().safeParse(grantId).success) return fail("forbidden");
  const db = await createClient();
  const now = new Date().toISOString();
  const patch = approve ? { approved_by: ctx.userId, approved_at: now } : { expires_at: now };
  const { data, error } = await db
    .from("support_access_grants")
    .update(patch)
    .eq("id", grantId)
    .eq("restaurant_id", ctx.restaurant.id)
    .gt("expires_at", now)
    .select("id")
    .maybeSingle();
  if (error || !data) return fail("failed");
  await db.from("audit_log").insert({
    restaurant_id: ctx.restaurant.id,
    actor_id: ctx.userId,
    action: "support_access",
    target_table: "support_access_grants",
    target_id: grantId,
    after: { decision: approve ? "approved" : "ended" },
  });
  return done(slug, "ajustes", approve ? "approved" : "ended");
}

const floorSchema = z
  .array(
    z.object({
      id: z.uuid(),
      area: z.string().trim().max(30),
      shape: z.enum(["square", "round", "long"]),
      seats: z.number().int().min(1).max(40).nullable(),
      x: z.number().min(0).max(100),
      y: z.number().min(0).max(100),
    }),
  )
  .max(200);

/** Floor plan editor in Ajustes: areas, shapes, seats and positions (managers and owners). */
export async function saveFloor(slug: string, rows: z.input<typeof floorSchema>): Promise<FormResult> {
  const ctx = await requireSection(slug, "settings");
  const parsed = floorSchema.safeParse(rows);
  if (!parsed.success) return fail("validation");
  const db = await createClient();
  for (const r of parsed.data) {
    const { error } = await db
      .from("dining_tables")
      .update({ area: r.area || null, shape: r.shape, seats: r.seats, pos_x: r.x, pos_y: r.y })
      .eq("id", r.id)
      .eq("restaurant_id", ctx.restaurant.id);
    if (error) return fail(error.code === "42501" ? "forbidden" : "failed");
  }
  revalidatePath(`/app/${slug}/mesas`);
  return done(slug, "ajustes", "saved");
}
