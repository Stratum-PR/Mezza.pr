"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { payments } from "@/connectors/payments";
import { isNotImplemented } from "@/connectors/shared";
import { requireSection, requireStaff, type StaffContext } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { dollarsToCents } from "@/lib/money";

export type StaffResult = { ok: true; id?: string; number?: number } | { ok: false; error: string };

const uuid = z.uuid();
const fail = (error: string): StaffResult => ({ ok: false, error });

function refresh(slug: string) {
  for (const p of ["servicio", "mesas", "cocina"]) revalidatePath(`/app/${slug}/${p}`);
}

function ctxOf(c: StaffContext) {
  return { restaurantId: c.restaurant.id, actorUserId: c.userId, locale: "es" as const };
}

/** Kitchen/servers move an order along: new → in_kitchen → ready → served. */
export async function advanceOrder(
  slug: string,
  orderId: string,
  status: "in_kitchen" | "ready" | "served",
): Promise<StaffResult> {
  if (!uuid.safeParse(orderId).success || !["in_kitchen", "ready", "served"].includes(status))
    return fail("invalid");
  await requireStaff(slug);
  const { error } = await (
    await createClient()
  ).rpc("set_order_status", { p_order_id: orderId, p_status: status });
  if (error) return fail(error.code === "42501" ? "forbidden" : "failed");
  refresh(slug);
  return { ok: true };
}

/** Sold-out toggle from the kitchen (writes item_availability_events). */
export async function toggleSoldOut(slug: string, itemId: string, available: boolean): Promise<StaffResult> {
  if (!uuid.safeParse(itemId).success) return fail("invalid");
  await requireSection(slug, "kitchen");
  const { error } = await (
    await createClient()
  ).rpc("set_item_availability", { p_item_id: itemId, p_available: available });
  if (error) return fail(error.code === "42501" ? "forbidden" : "failed");
  refresh(slug);
  return { ok: true };
}

export async function handleRequest(slug: string, requestId: string): Promise<StaffResult> {
  if (!uuid.safeParse(requestId).success) return fail("invalid");
  const ctx = await requireSection(slug, "service");
  const { error } = await (
    await createClient()
  )
    .from("service_requests")
    .update({ status: "handled", handled_by: ctx.userId, handled_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) return fail("failed");
  refresh(slug);
  return { ok: true };
}

/** "Efectivo recibido": marks the cash payment paid, records the sale and refreshes today's summary. */
export async function confirmCash(slug: string, paymentId: string): Promise<StaffResult> {
  if (!uuid.safeParse(paymentId).success) return fail("invalid");
  const ctx = await requireSection(slug, "service");
  try {
    await payments().cash.confirm!(ctxOf(ctx), paymentId);
  } catch {
    return fail("failed");
  }
  // The check is settled: close any "bring the check" request on that tab.
  const db = createAdminClient();
  const { data: p } = await db
    .from("payments")
    .select("tab_id")
    .eq("id", paymentId)
    .eq("restaurant_id", ctx.restaurant.id)
    .single();
  if (p) {
    await db
      .from("service_requests")
      .update({ status: "handled", handled_by: ctx.userId, handled_at: new Date().toISOString() })
      .eq("tab_id", p.tab_id)
      .eq("status", "open");
  }
  refresh(slug);
  return { ok: true };
}

/** Staff cancel a pending payment a guest abandoned (e.g. asked for cash, then left); its charges are owed again. */
export async function cancelPendingPayment(slug: string, paymentId: string): Promise<StaffResult> {
  if (!uuid.safeParse(paymentId).success) return fail("invalid");
  const ctx = await requireSection(slug, "service");
  const db = createAdminClient();
  const { data: payment } = await db
    .from("payments")
    .select("id")
    .eq("id", paymentId)
    .eq("restaurant_id", ctx.restaurant.id)
    .maybeSingle();
  if (!payment) return fail("invalid");
  const { data, error } = await db.rpc("cancel_pending_payment", { p_payment_id: paymentId });
  if (error || !data) return fail("failed");
  refresh(slug);
  return { ok: true };
}

/** "Ampliar límite": one more restaurant tab cap for this table's QR orders. Returns the new cap (number). */
export async function raiseTabLimit(slug: string, tabId: string): Promise<StaffResult> {
  if (!uuid.safeParse(tabId).success) return fail("invalid");
  await requireSection(slug, "service");
  const { data, error } = await (await createClient()).rpc("raise_tab_limit", { p_tab_id: tabId });
  if (error) return fail(error.code === "42501" ? "forbidden" : "failed");
  refresh(slug);
  return { ok: true, number: data };
}

/** "Cerrado en el POS": the sale was entered on the fiscal terminal; the tab closes. */
export async function closeOnPos(slug: string, tabId: string): Promise<StaffResult> {
  if (!uuid.safeParse(tabId).success) return fail("invalid");
  const ctx = await requireSection(slug, "service");
  const now = new Date().toISOString();
  const { error } = await (
    await createClient()
  )
    .from("tabs")
    .update({ pos_closed_at: now, pos_closed_by: ctx.userId, status: "closed", closed_at: now })
    .eq("id", tabId);
  if (error) return fail("failed");
  refresh(slug);
  return { ok: true };
}

const linesSchema = z
  .array(
    z.object({
      itemId: uuid,
      qty: z.number().int().min(1).max(99),
      modifierOptionIds: z.array(uuid).max(20),
      note: z.string().max(200).optional(),
      shared: z.boolean().optional(),
    }),
  )
  .min(1)
  .max(50);

/**
 * A server takes an order for guests who don't scan (source "staff"); same rules as place_order.
 * The order can go to one person at the table (participantId) or the whole table (null); shared
 * lines are split among everyone who has ordered.
 */
export async function staffPlaceOrder(
  slug: string,
  tableId: string,
  clientOrderId: string,
  lines: z.input<typeof linesSchema>,
  participantId: string | null = null,
): Promise<StaffResult> {
  const parsed = linesSchema.safeParse(lines);
  if (
    !uuid.safeParse(tableId).success ||
    !uuid.safeParse(clientOrderId).success ||
    !parsed.success ||
    (participantId !== null && !uuid.safeParse(participantId).success)
  )
    return fail("validation");
  const ctx = await requireSection(slug, "service");
  const { data, error } = await createAdminClient().rpc("place_order", {
    p_restaurant_id: ctx.restaurant.id,
    p_table_id: tableId,
    p_client_order_id: clientOrderId,
    p_source: "staff",
    p_lines: parsed.data,
    p_guest_language: "es",
    p_created_by: ctx.userId,
  });
  if (error || !data) return fail("failed");
  const r = data as {
    status: string;
    order_id?: string;
    number?: number;
    reason?: string;
    replayed?: boolean;
  };
  if (r.status !== "accepted") return fail(r.reason ?? "validation");
  if (!r.replayed && (participantId || parsed.data.some((l) => l.shared))) {
    const { error: attributeError } = await (
      await createClient()
    ).rpc("attribute_staff_order", { p_order_id: r.order_id!, p_participant_id: participantId ?? undefined });
    if (attributeError) return fail("failed");
  }
  refresh(slug);
  return { ok: true, id: r.order_id, number: r.number };
}

export type VoidResult =
  | { ok: true; refunds: { paymentId: string; participantId: string | null; amountCents: number }[] }
  | { ok: false; error: string };

/**
 * Void an order line (or the whole order). Managers and owners only; reason required; audited. A line
 * someone already paid refunds each payer for their part (plus its IVU); staff hand the cash back.
 * A line a pending payment holds waits until that payment is confirmed or cancelled.
 */
export async function voidLine(
  slug: string,
  orderId: string,
  lineId: string | null,
  reason: string,
): Promise<VoidResult> {
  if (!uuid.safeParse(orderId).success || (lineId && !uuid.safeParse(lineId).success))
    return { ok: false, error: "invalid" };
  if (reason.trim().length < 3 || reason.length > 300) return { ok: false, error: "reason" };
  const ctx = await requireSection(slug, "service");
  if (ctx.role !== "owner" && ctx.role !== "manager") return { ok: false, error: "forbidden" };
  const { data, error } = await (
    await createClient()
  ).rpc("void_line", {
    p_order_id: orderId,
    p_reason: reason.trim(),
    p_order_item_id: lineId ?? undefined,
  });
  if (error)
    return {
      ok: false,
      error:
        error.code === "42501" ? "forbidden" : /pending payment/.test(error.message) ? "pending" : "failed",
    };
  refresh(slug);
  const refunds = (
    (data as { refunds?: { payment_id: string; participant_id: string | null; amount_cents: number }[] })
      ?.refunds ?? []
  ).map((r) => ({ paymentId: r.payment_id, participantId: r.participant_id, amountCents: r.amount_cents }));
  return { ok: true, refunds };
}

/** Refund (cash in pass 1; mocks in demo). Managers and owners only; reason required; audited. */
export async function refundPayment(
  slug: string,
  paymentId: string,
  amount: string,
  reason: string,
): Promise<StaffResult> {
  const cents = dollarsToCents(amount);
  if (!uuid.safeParse(paymentId).success || !cents) return fail("amount");
  if (reason.trim().length < 3 || reason.length > 300) return fail("reason");
  const ctx = await requireSection(slug, "service");
  if (ctx.role !== "owner" && ctx.role !== "manager") return fail("forbidden");
  const { data: p } = await (
    await createClient()
  )
    .from("payments")
    .select("method")
    .eq("id", paymentId)
    .single();
  if (!p) return fail("invalid");
  try {
    await payments()[p.method].refund(ctxOf(ctx), paymentId, cents, reason.trim());
  } catch (error) {
    if (isNotImplemented(error)) return fail("coming_soon");
    return fail(/exceeds/.test(String(error)) ? "too_much" : "failed");
  }
  refresh(slug);
  return { ok: true };
}

/** Every print attempt is logged to print_jobs (browser printing reports success when the dialog opened). */
export async function logPrintJob(
  slug: string,
  orderId: string,
  kind: "kitchen" | "receipt",
  outcome: { ok: true } | { ok: false; error: string },
): Promise<StaffResult> {
  if (!uuid.safeParse(orderId).success) return fail("invalid");
  const ctx = await requireStaff(slug);
  const db = await createClient();
  const { data: printer } = await db
    .from("printers")
    .select("id")
    .eq("restaurant_id", ctx.restaurant.id)
    .eq("role", kind)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const { error } = await db.from("print_jobs").insert({
    restaurant_id: ctx.restaurant.id,
    order_id: orderId,
    printer_id: printer?.id ?? null,
    kind,
    status: outcome.ok ? "printed" : "failed",
    error: outcome.ok ? null : outcome.error.slice(0, 300),
    printed_at: outcome.ok ? new Date().toISOString() : null,
  });
  return error ? fail("failed") : { ok: true };
}

/** First load of a staff browser: register it as a device (its id is kept in localStorage). */
export async function registerDevice(
  slug: string,
  kind: "server" | "kitchen" | "register",
  name: string,
): Promise<StaffResult> {
  const ctx = await requireStaff(slug);
  const { data, error } = await (
    await createClient()
  )
    .from("devices")
    .insert({
      restaurant_id: ctx.restaurant.id,
      kind,
      name: name.slice(0, 80) || kind,
      last_seen_at: new Date().toISOString(),
      app_version: "pass1",
    })
    .select("id")
    .single();
  return error ? fail("failed") : { ok: true, id: data.id };
}
