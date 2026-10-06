"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { menuImporter } from "@/connectors/menu-import";
import { payments } from "@/connectors/payments";
import { isNotImplemented, mocksAllowed } from "@/connectors/shared";
import { requireStaff, type StaffContext } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { deriveQrToken, hashQrToken } from "@/lib/qr/token";
import { serverEnv } from "@/lib/server-env";
import { QR_PRESETS } from "@/config/qr-presets";
import { menuImageSize } from "@/lib/menu/image";

export type WizardState = { status: "idle" | "error" | "ok"; error?: string; message?: string };

/** The wizard is the owner's; managers help later from the regular screens. */
async function owner(slug: string): Promise<StaffContext> {
  const ctx = await requireStaff(slug);
  if (ctx.role !== "owner") redirect(`/app/${slug}`);
  return ctx;
}

async function advance(ctx: StaffContext, step: number) {
  // Never move backwards: returning to an earlier step to change something keeps progress.
  const next = Math.max(ctx.restaurant.onboarding_step, step);
  await createAdminClient().from("restaurants").update({ onboarding_step: next }).eq("id", ctx.restaurant.id);
}

function go(slug: string, step: number): never {
  redirect(`/app/${slug}/empezar?paso=${step}`);
}

// Step 2: menu --------------------------------------------------------------------

const MENU_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export async function wizardUploadMenu(slug: string, _: WizardState, form: FormData): Promise<WizardState> {
  const ctx = await owner(slug);
  const file = form.get("menu");
  if (!(file instanceof File) || !MENU_TYPES[file.type]) return { status: "error", error: "file_type" };
  if (file.size > 15 * 1024 * 1024) return { status: "error", error: "file_size" };
  let imageSize: { width: number; height: number } | undefined;
  if (!mocksAllowed()) {
    if (file.type === "application/pdf") return { status: "error", error: "pdf_unsupported" };
    try {
      imageSize = await menuImageSize(Buffer.from(await file.arrayBuffer()), file.type);
    } catch {
      return { status: "error", error: "file_type" };
    }
  }
  const path = `${ctx.restaurant.id}/uploads/${crypto.randomUUID()}.${MENU_TYPES[file.type]}`;
  const stored = await (
    await createClient()
  ).storage
    .from("menus")
    .upload(path, file, { contentType: file.type });
  if (stored.error) return { status: "error", error: "failed" };
  if (imageSize) {
    const db = createAdminClient();
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
    if (error) return { status: "error", error: "failed" };
    const published = await db.rpc("publish_original_menu_image", {
      p_upload_id: data.id,
      p_width: imageSize.width,
      p_height: imageSize.height,
      p_reviewed_by: ctx.userId,
    });
    if (published.error) return { status: "error", error: "failed" };
    await advance(ctx, 3);
    go(slug, 3);
  }
  try {
    // The importer keeps working while the owner continues; review waits on the menu import screen.
    await menuImporter().start(
      { restaurantId: ctx.restaurant.id, actorUserId: ctx.userId, locale: "es" },
      { storagePath: path, mimeType: file.type },
    );
  } catch (error) {
    if (!isNotImplemented(error)) return { status: "error", error: "failed" };
  }
  await advance(ctx, 3);
  go(slug, 3);
}

export async function wizardSkip(slug: string, step: number) {
  const ctx = await owner(slug);
  const next = z
    .number()
    .int()
    .min(2)
    .max(7)
    .parse(step + 1);
  await advance(ctx, next);
  if (next === 7) redirect(`/app/${slug}`);
  go(slug, next);
}

// Step 3: tables and QR style ---------------------------------------------------------------

const tablesSchema = z.object({
  count: z.coerce.number().int().min(1).max(80),
  labels: z.string().max(2000).optional().default(""),
  preset: z.enum(["house", "bold", "clean"]),
});

export async function wizardTables(slug: string, _: WizardState, form: FormData): Promise<WizardState> {
  const ctx = await owner(slug);
  const parsed = tablesSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", error: "tables_invalid" };
  const custom = parsed.data.labels
    .split(/[,\n]/)
    .map((l) => l.trim())
    .filter(Boolean);
  const labels =
    custom.length > 0 ? custom : Array.from({ length: parsed.data.count }, (_, i) => String(i + 1));
  if (new Set(labels).size !== labels.length || labels.some((l) => l.length > 20) || labels.length > 80) {
    return { status: "error", error: "labels_invalid" };
  }

  const db = createAdminClient();
  const { data: existing } = await db
    .from("dining_tables")
    .select("label")
    .eq("restaurant_id", ctx.restaurant.id);
  const have = new Set((existing ?? []).map((t) => t.label));
  const rows = labels
    .filter((label) => !have.has(label))
    .map((label, i) => {
      const id = crypto.randomUUID();
      return {
        id,
        restaurant_id: ctx.restaurant.id,
        label,
        qr_token_hash: hashQrToken(deriveQrToken(serverEnv.QR_TOKEN_SECRET, id, 1)),
        token_version: 1,
        sort_order: have.size + i,
      };
    });
  if (rows.length > 0) {
    const { error } = await db.from("dining_tables").insert(rows);
    if (error) return { status: "error", error: "failed" };
  }
  const { error } = await db
    .from("qr_designs")
    .update({ preset: parsed.data.preset, ...QR_PRESETS[parsed.data.preset] })
    .eq("restaurant_id", ctx.restaurant.id);
  if (error) return { status: "error", error: "failed" };
  await advance(ctx, 4);
  go(slug, 4);
}

// Step 4: payments ---------------------------------------------------------------------------

export async function wizardConnectPayment(slug: string, method: "card" | "ath"): Promise<WizardState> {
  const ctx = await owner(slug);
  try {
    const provider = payments()[method];
    if (!provider.startOnboarding) return { status: "error", error: "coming_soon" };
    const origin = (await headers()).get("origin") ?? "http://localhost:3000";
    const { url } = await provider.startOnboarding(
      { restaurantId: ctx.restaurant.id, actorUserId: ctx.userId, locale: "es" },
      `${origin}/app/${slug}/empezar?paso=4`,
    );
    redirect(url);
  } catch (error) {
    if (isNotImplemented(error)) return { status: "error", error: "coming_soon" };
    throw error;
  }
}

// Step 5: staff invites -------------------------------------------------------------------------

const inviteSchema = z.object({ email: z.email().max(200), role: z.enum(["manager", "server", "kitchen"]) });

export async function wizardInvite(slug: string, _: WizardState, form: FormData): Promise<WizardState> {
  const ctx = await owner(slug);
  const parsed = inviteSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", error: "invite_invalid" };
  const admin = createAdminClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";

  // Invite new people; existing accounts are added directly.
  let userId: string | undefined;
  const invited = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${origin}/api/auth/callback?next=/app/contrasena`,
  });
  userId = invited.data.user?.id;
  if (!userId) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = data?.users.find((u) => u.email?.toLowerCase() === parsed.data.email.toLowerCase())?.id;
  }
  if (!userId) return { status: "error", error: "failed" };

  const { error } = await admin
    .from("memberships")
    .upsert(
      { restaurant_id: ctx.restaurant.id, user_id: userId, role: parsed.data.role, active: true },
      { onConflict: "user_id,restaurant_id" },
    );
  if (error) return { status: "error", error: "failed" };
  return { status: "ok", message: parsed.data.email };
}

export async function wizardFinishStaff(slug: string) {
  const ctx = await owner(slug);
  await advance(ctx, 6);
  go(slug, 6);
}

// Step 6: go live ------------------------------------------------------------------------------

export async function wizardGoLive(slug: string) {
  const ctx = await owner(slug);
  await advance(ctx, 7);
  redirect(`/app/${slug}`);
}
