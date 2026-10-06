"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSection } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";

/** Results of the per-table tools (Mesas → a table). Errors are message keys under staff.tableErrors. */
export type TableResult =
  { ok: true; paymentId?: string; totalCents?: number; cents?: number } | { ok: false; error: string };

const uuid = z.uuid();
const fail = (error: string): TableResult => ({ ok: false, error });

function refresh(slug: string) {
  for (const p of ["servicio", "cocina"]) revalidatePath(`/app/${slug}/${p}`);
  revalidatePath(`/app/${slug}/mesas`, "layout");
}

/** Postgres errors from the staff RPCs → a message key. */
function reason(error: { code?: string; message?: string } | null): string {
  if (!error) return "failed";
  if (error.code === "42501") return "forbidden";
  const m = error.message ?? "";
  if (/has payments/.test(m)) return "has_payments";
  if (/pending payment/.test(m)) return "pending";
  if (/not settled/.test(m)) return "not_settled";
  if (/nothing to write off/.test(m)) return "nothing";
  if (/reason/.test(m)) return "reason";
  return "failed";
}

/** The tab must belong to this restaurant (the RPCs check roles; this keeps ids from other tenants out). */
async function ownTab(restaurantId: string, tabId: string): Promise<boolean> {
  if (!uuid.safeParse(tabId).success) return false;
  const { data } = await createAdminClient()
    .from("tabs")
    .select("id")
    .eq("id", tabId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  return !!data;
}

/** "Mover a otra persona" / "a la mesa" (participantId null). Only lines no money has touched. */
export async function moveLine(
  slug: string,
  lineId: string,
  participantId: string | null,
): Promise<TableResult> {
  if (!uuid.safeParse(lineId).success || (participantId && !uuid.safeParse(participantId).success))
    return fail("invalid");
  await requireSection(slug, "service");
  const { error } = await (
    await createClient()
  ).rpc("move_order_item", {
    p_order_item_id: lineId,
    p_participant_id: participantId ?? undefined,
  });
  if (error) return fail(reason(error));
  refresh(slug);
  return { ok: true };
}

/** "Compartir entre…": an even split of a shared line among the chosen people. */
export async function reshareLine(
  slug: string,
  lineId: string,
  participantIds: string[],
): Promise<TableResult> {
  if (!uuid.safeParse(lineId).success || !z.array(uuid).min(1).max(40).safeParse(participantIds).success)
    return fail("invalid");
  await requireSection(slug, "service");
  const { error } = await (
    await createClient()
  ).rpc("set_item_shares", {
    p_order_item_id: lineId,
    p_participants: participantIds,
  });
  if (error) return fail(reason(error));
  refresh(slug);
  return { ok: true };
}

const chargeSchema = z.object({
  option: z.enum(["person", "balance", "plan"]),
  forId: uuid.optional(),
  parts: z.number().int().min(1).max(20).optional(),
  key: uuid,
});

/**
 * "Dividir cuenta" for guests paying the server: creates the pending cash payment (a person's
 * charges, the balance, or shares of the even split) for the cash dialog to collect. The amount is
 * computed by create_tab_payment; staff choose only what to charge.
 */
export async function staffCharge(
  slug: string,
  tabId: string,
  input: z.input<typeof chargeSchema>,
): Promise<TableResult> {
  const ctx = await requireSection(slug, "service");
  const p = chargeSchema.safeParse(input);
  if (!p.success || !(await ownTab(ctx.restaurant.id, tabId))) return fail("invalid");
  const { data, error } = await createAdminClient().rpc("create_tab_payment", {
    p_tab_id: tabId,
    p_option: p.data.option,
    p_method: "cash",
    p_idempotency_key: p.data.key,
    p_for: p.data.option === "person" ? p.data.forId : undefined,
    p_parts: p.data.parts ?? 1,
  });
  if (error || !data) return fail("failed");
  const r = data as { status: string; reason?: string; payment_id?: string; total_cents?: number };
  if (r.status !== "accepted")
    return fail(r.reason === "nothing_to_pay" || r.reason === "no_plan" ? r.reason : "failed");
  refresh(slug);
  return { ok: true, paymentId: r.payment_id, totalCents: r.total_cents };
}

/** Staff start the table's even split (or get the same one back). */
export async function staffStartPlan(slug: string, tabId: string, parts: number): Promise<TableResult> {
  const ctx = await requireSection(slug, "service");
  if (!Number.isInteger(parts) || parts < 2 || parts > 20 || !(await ownTab(ctx.restaurant.id, tabId)))
    return fail("invalid");
  const { data, error } = await createAdminClient().rpc("start_split_plan", {
    p_tab_id: tabId,
    p_parts: parts,
    p_by_user: ctx.userId,
  });
  if (error || !data) return fail("failed");
  const r = data as { status: string; reason?: string };
  if (r.status !== "accepted")
    return fail(r.reason === "plan_exists" || r.reason === "nothing_to_pay" ? r.reason : "failed");
  refresh(slug);
  return { ok: true };
}

/** Staff cancel the even split, only before any share is paid or pending. */
export async function staffCancelPlan(slug: string, tabId: string): Promise<TableResult> {
  const ctx = await requireSection(slug, "service");
  if (!(await ownTab(ctx.restaurant.id, tabId))) return fail("invalid");
  const { data, error } = await createAdminClient().rpc("cancel_split_plan", { p_tab_id: tabId });
  if (error || !data) return fail("failed");
  const r = data as { status: string; reason?: string };
  if (r.status !== "accepted") return fail(r.reason === "plan_started" ? "plan_started" : "failed");
  refresh(slug);
  return { ok: true };
}

/** A manager covers what nobody will pay (a person's charges, the table's lines, or everything). */
export async function writeOff(
  slug: string,
  tabId: string,
  scope: "person" | "table" | "balance",
  reasonText: string,
  participantId?: string,
): Promise<TableResult> {
  const ctx = await requireSection(slug, "service");
  if (ctx.role !== "owner" && ctx.role !== "manager") return fail("forbidden");
  if (
    !["person", "table", "balance"].includes(scope) ||
    (participantId && !uuid.safeParse(participantId).success)
  )
    return fail("invalid");
  if (reasonText.trim().length < 3 || reasonText.length > 300) return fail("reason");
  const { data, error } = await (
    await createClient()
  ).rpc("write_off", {
    p_tab_id: tabId,
    p_scope: scope,
    p_reason: reasonText.trim(),
    p_participant_id: participantId,
  });
  if (error || !data) return fail(reason(error));
  refresh(slug);
  return { ok: true, cents: (data as { cents: number }).cents };
}

/** "Mesa libre": closes a settled table; the next order there starts a new visit. */
export async function closeTab(slug: string, tabId: string): Promise<TableResult> {
  await requireSection(slug, "service");
  if (!uuid.safeParse(tabId).success) return fail("invalid");
  const { error } = await (await createClient()).rpc("close_tab", { p_tab_id: tabId });
  if (error) return fail(reason(error));
  refresh(slug);
  return { ok: true };
}
