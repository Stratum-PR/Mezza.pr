"use server";

import { z } from "zod";
import { availableMethods, payments } from "@/connectors/payments";
import type { OrderDraft, SubmitResult } from "@/connectors/orders";
import { rateLimiter } from "@/connectors/rate-limit";
import { isNotImplemented } from "@/connectors/shared";
import { flags } from "@/config/flags";
import { clientIp } from "@/lib/client-ip";
import { createAdminClient } from "@/lib/db/admin";
import { deviceHash, ensureDeviceHash } from "@/lib/guest/device";
import { cleanName } from "@/lib/guest/names";
import { ensureTab, liveTab, resolveTable, type GuestTable } from "@/lib/guest/resolve";
import { guestStatus as loadStatus, type GuestStatus } from "@/lib/guest/status";
import type { Cents } from "@/lib/money";

async function guest(slug: string, token: string): Promise<GuestTable> {
  const g = await resolveTable(slug, token);
  if (!g) throw new Error("invalid_table");
  return g;
}

/** Shared rate limits, per minute: every [key, max] must allow the request. */
async function allowed(...checks: [key: string, max: number][]): Promise<boolean> {
  for (const [key, max] of checks) if (!(await rateLimiter().limit(key, max, 60)).ok) return false;
  return true;
}

const draftSchema = z.object({
  clientOrderId: z.uuid(),
  guestLanguage: z.enum(["es", "en"]),
  lines: z
    .array(
      z.object({
        itemId: z.uuid(),
        qty: z.number().int().min(1).max(99),
        modifierOptionIds: z.array(z.uuid()).max(20),
        note: z.string().max(200).optional(),
        shared: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(50),
});

/**
 * "Enviar a cocina". The clientOrderId is the idempotency key, so a double tap makes one order.
 * The phone's first order at the table makes it a participant, with the optional name it gives.
 */
export async function guestPlaceOrder(
  slug: string,
  token: string,
  draft: OrderDraft,
  name?: string | null,
): Promise<SubmitResult> {
  const g = await resolveTable(slug, token);
  if (!g) return { status: "rejected", reason: "invalid_table" };
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { status: "rejected", reason: "validation" };
  const checked = cleanName(name);
  if (!checked.ok) return { status: "rejected", reason: "validation", detail: `name_${checked.reason}` };
  const device = await ensureDeviceHash();
  if (
    !(await allowed(
      [`order:phone:${device}`, 5],
      [`order:table:${g.table.id}`, 20],
      [`order:ip:${await clientIp()}`, 30],
    ))
  )
    return { status: "rejected", reason: "validation", detail: "rate_limited" };

  const { data, error } = await createAdminClient().rpc("place_guest_order", {
    p_restaurant_id: g.restaurant.id,
    p_table_id: g.table.id,
    p_client_order_id: parsed.data.clientOrderId,
    p_lines: flags.sharedTab ? parsed.data.lines : parsed.data.lines.map((l) => ({ ...l, shared: false })),
    p_guest_language: parsed.data.guestLanguage,
    p_device_hash: device,
    p_name: checked.name ?? undefined,
  });
  if (error || !data) return { status: "rejected", reason: "validation", detail: "server" };
  const r = data as {
    status: string;
    order_id?: string;
    number?: number;
    reason?: string;
    detail?: string;
    max?: number;
  };
  if (r.status === "accepted") return { status: "accepted", orderId: r.order_id!, number: r.number! };
  // The restaurant's QR limits: per line (a quantity), per order or per open tab (cents).
  if (r.reason === "limit")
    return { status: "rejected", reason: "validation", detail: `limit_${r.detail}`, limit: r.max };
  return {
    status: "rejected",
    reason: (["item_unavailable", "tab_closed", "invalid_table"].includes(String(r.reason))
      ? r.reason
      : "validation") as "item_unavailable" | "tab_closed" | "invalid_table" | "validation",
    detail: r.detail,
  };
}

export async function guestStatus(slug: string, token: string, tabId?: string): Promise<GuestStatus | null> {
  const g = await resolveTable(slug, token);
  if (!g) return null;
  return loadStatus(g, tabId && z.uuid().safeParse(tabId).success ? tabId : undefined, await deviceHash());
}

/** A guest renames themselves at the table (blank goes back to "Invitado #n"). */
export async function guestRename(
  slug: string,
  token: string,
  name: string,
): Promise<{ ok: true } | { ok: false; error: "long" | "invalid" | "blocked" | "name_taken" | "failed" }> {
  const g = await guest(slug, token);
  const checked = cleanName(name);
  if (!checked.ok) return { ok: false, error: checked.reason };
  const device = await deviceHash();
  const tab = await liveTab(g.table.id);
  if (!device || !tab) return { ok: false, error: "failed" };
  if (!(await allowed([`rename:phone:${device}`, 10]))) return { ok: false, error: "failed" };
  const { data, error } = await createAdminClient().rpc("rename_participant", {
    p_tab_id: tab.id,
    p_device_hash: device,
    p_name: checked.name ?? "",
  });
  if (error) return { ok: false, error: "failed" };
  return data === "name_taken" ? { ok: false, error: "name_taken" } : { ok: true };
}

/** "Llamar al mesero" / "Pedir la cuenta". One open request of each kind per tab. */
export async function guestRequest(
  slug: string,
  token: string,
  kind: "call_server" | "bring_check",
): Promise<{ ok: boolean }> {
  const g = await guest(slug, token);
  if (!["call_server", "bring_check"].includes(kind)) return { ok: false };
  if (!(await allowed([`request:table:${g.table.id}`, 10], [`request:ip:${await clientIp()}`, 30])))
    return { ok: false };
  const tabId = await ensureTab(g.restaurant.id, g.table.id);
  const db = createAdminClient();
  const { data: open } = await db
    .from("service_requests")
    .select("id")
    .eq("tab_id", tabId)
    .eq("kind", kind)
    .eq("status", "open")
    .maybeSingle();
  if (!open) {
    const { error } = await db
      .from("service_requests")
      .insert({ restaurant_id: g.restaurant.id, tab_id: tabId, kind });
    if (error) return { ok: false };
  }
  return { ok: true };
}

/** Payment methods this guest can use now; cash is always last. */
export async function guestPaymentMethods(slug: string, token: string) {
  const g = await guest(slug, token);
  return availableMethods({ restaurantId: g.restaurant.id, locale: g.restaurant.defaultLanguage });
}

const paySchema = z.object({
  option: z.enum(["mine", "person", "balance", "plan"]),
  forId: z.uuid().optional(),
  parts: z.number().int().min(1).max(20).optional(),
  method: z.enum(["card", "ath", "cash"]),
  tip: z.union([
    z.object({ percent: z.number().int().min(0).max(100) }),
    z.object({ cents: z.number().int().min(0).max(100_000) }),
  ]),
  idempotencyKey: z.uuid(),
  locale: z.enum(["es", "en"]),
});

type PayError =
  | "nothing_to_pay"
  | "unavailable"
  | "coming_soon"
  | "failed"
  | "pending_exists"
  | "table_full"
  | "rate_limited"
  | "no_plan";

export type PayResult =
  | { ok: true; paymentId: string; next: "done" | "staff_confirmation"; totalCents: Cents }
  | { ok: false; error: PayError };

/** The phone's person at the table, created on its first payment if it never ordered. */
async function payer(tabId: string): Promise<string | null> {
  const { data, error } = await createAdminClient().rpc("ensure_participant", {
    p_tab_id: tabId,
    p_device_hash: await ensureDeviceHash(),
  });
  if (error) throw new Error("failed");
  return data;
}

/**
 * Pays part of the table (or all of it): "mine", another person's, the balance, or shares of the even
 * split. The amount is computed by create_tab_payment from what is owed; the phone only sends the
 * option. The table keeps ordering while people pay.
 */
export async function guestPay(
  slug: string,
  token: string,
  input: z.input<typeof paySchema>,
): Promise<PayResult> {
  const g = await guest(slug, token);
  const parsed = paySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "failed" };
  const p = parsed.data;
  const option = flags.splitBill ? p.option : "balance";
  const tab = await liveTab(g.table.id);
  if (!tab) return { ok: false, error: "nothing_to_pay" };
  const ctx = { restaurantId: g.restaurant.id, locale: p.locale };
  if (!(await availableMethods(ctx)).includes(p.method)) return { ok: false, error: "unavailable" };
  if (!(await allowed([`pay:phone:${await ensureDeviceHash()}`, 10], [`pay:table:${g.table.id}`, 30])))
    return { ok: false, error: "rate_limited" };
  const payerId = await payer(tab.id);
  if (!payerId) return { ok: false, error: "table_full" };

  const db = createAdminClient();
  const { data, error } = await db.rpc("create_tab_payment", {
    p_tab_id: tab.id,
    p_option: option,
    p_method: p.method,
    p_idempotency_key: p.idempotencyKey,
    p_payer: payerId,
    p_for: option === "person" ? p.forId : undefined,
    p_parts: p.parts ?? 1,
    p_tip_percent: "percent" in p.tip ? p.tip.percent : undefined,
    p_tip_cents: "cents" in p.tip ? p.tip.cents : undefined,
  });
  if (error || !data) return { ok: false, error: "failed" };
  const r = data as {
    status: string;
    reason?: string;
    payment_id?: string;
    subtotal_cents?: number;
    ivu_state_cents?: number;
    ivu_municipal_cents?: number;
    tip_cents?: number;
    total_cents?: number;
  };
  if (r.status !== "accepted") {
    const known: PayError[] = ["nothing_to_pay", "pending_exists", "no_plan"];
    return { ok: false, error: known.includes(r.reason as PayError) ? (r.reason as PayError) : "failed" };
  }
  try {
    const { paymentId, next } = await payments()[p.method].createPayment(ctx, {
      tabId: tab.id,
      participantId: payerId,
      idempotencyKey: p.idempotencyKey,
      amountCents: r.subtotal_cents!,
      tipCents: r.tip_cents!,
      ivuStateCents: r.ivu_state_cents!,
      ivuMunicipalCents: r.ivu_municipal_cents!,
      returnUrl: `/r/${slug}/t/${token}`,
    });
    return {
      ok: true,
      paymentId,
      next: next.kind === "staff_confirmation" ? "staff_confirmation" : "done",
      totalCents: r.total_cents!,
    };
  } catch (e) {
    // The provider couldn't take it: release what the pending payment held.
    await db.rpc("cancel_pending_payment", { p_payment_id: r.payment_id! });
    return { ok: false, error: isNotImplemented(e) ? "coming_soon" : "failed" };
  }
}

/** The phone cancels its own pending payment (e.g. it changed its mind about paying cash). */
export async function guestCancelPayment(
  slug: string,
  token: string,
  paymentId: string,
): Promise<{ ok: boolean }> {
  await guest(slug, token);
  const device = await deviceHash();
  if (!device || !z.uuid().safeParse(paymentId).success) return { ok: false };
  const { data, error } = await createAdminClient().rpc("cancel_pending_payment", {
    p_payment_id: paymentId,
    p_device_hash: device,
  });
  return { ok: !error && !!data };
}

export type PlanResult =
  | { ok: true }
  | {
      ok: false;
      error: "plan_exists" | "plan_started" | "nothing_to_pay" | "table_full" | "failed";
      parts?: number;
    };

/** "Dividir en partes iguales": starts the table's even split (or joins the same one). */
export async function guestStartPlan(slug: string, token: string, parts: number): Promise<PlanResult> {
  const g = await guest(slug, token);
  if (!flags.splitBill || !Number.isInteger(parts) || parts < 2 || parts > 20)
    return { ok: false, error: "failed" };
  const tab = await liveTab(g.table.id);
  if (!tab) return { ok: false, error: "nothing_to_pay" };
  if (!(await allowed([`plan:table:${g.table.id}`, 10]))) return { ok: false, error: "failed" };
  const by = await payer(tab.id);
  if (!by) return { ok: false, error: "table_full" };
  const { data, error } = await createAdminClient().rpc("start_split_plan", {
    p_tab_id: tab.id,
    p_parts: parts,
    p_by_participant: by,
  });
  if (error || !data) return { ok: false, error: "failed" };
  const r = data as { status: string; reason?: string; parts?: number };
  if (r.status === "accepted") return { ok: true };
  return {
    ok: false,
    error: r.reason === "plan_exists" || r.reason === "nothing_to_pay" ? r.reason : "failed",
    parts: r.parts,
  };
}

/** Cancels the table's even split, only before any share is paid or pending. */
export async function guestCancelPlan(slug: string, token: string): Promise<PlanResult> {
  const g = await guest(slug, token);
  const tab = await liveTab(g.table.id);
  if (!tab || !(await deviceHash())) return { ok: false, error: "failed" };
  if (!(await allowed([`plan:table:${g.table.id}`, 10]))) return { ok: false, error: "failed" };
  const { data, error } = await createAdminClient().rpc("cancel_split_plan", { p_tab_id: tab.id });
  if (error || !data) return { ok: false, error: "failed" };
  const r = data as { status: string; reason?: string };
  return r.status === "accepted"
    ? { ok: true }
    : { ok: false, error: r.reason === "plan_started" ? "plan_started" : "failed" };
}

export interface Receipt {
  /** The tab it paid; a new tab at the table means a new visit, and the receipt is put away. */
  tabId: string;
  restaurantName: string;
  tableLabel: string;
  paidAt: string | null;
  method: "card" | "ath" | "cash";
  status: string;
  /** What the payment covered: whole lines, shares of shared dishes, or parts of the even split. */
  lines: { qty: number; nameEs: string; nameEn: string; lineCents: Cents; partial: boolean }[];
  /** Shares of the table's even split this payment paid, e.g. 1 of 4. */
  plan: { parts: number; of: number } | null;
  subtotalCents: Cents;
  ivuStateCents: Cents;
  ivuMunicipalCents: Cents;
  tipCents: Cents;
  totalCents: Cents;
}

/** The payment receipt (not the fiscal receipt), only for a payment made at this table. */
export async function guestReceipt(slug: string, token: string, paymentId: string): Promise<Receipt | null> {
  const g = await resolveTable(slug, token);
  if (!g || !z.uuid().safeParse(paymentId).success) return null;
  const db = createAdminClient();
  const { data: p } = await db
    .from("payments")
    .select(
      "id, tab_id, method, status, paid_at, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents, plan_parts, tabs!inner(table_id), split_plans(parts), payment_allocations(cents, share_id, order_items(qty, unit_price_cents, name_snapshot_es, name_snapshot_en))",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!p || p.tabs?.table_id !== g.table.id) return null;
  const covered = p.payment_allocations ?? [];
  const status = covered.length ? null : await loadStatus(g, p.tab_id);
  return {
    tabId: p.tab_id,
    restaurantName: g.restaurant.name,
    tableLabel: g.table.label,
    paidAt: p.paid_at,
    method: p.method,
    status: p.status,
    lines: status
      ? status.orders
          .filter((o) => o.status !== "void")
          .flatMap((o) => o.lines)
          .map((l) => ({
            qty: l.qty,
            nameEs: l.nameEs,
            nameEn: l.nameEn,
            lineCents: l.lineCents,
            partial: false,
          }))
      : covered
          .filter((a) => a.order_items)
          .map((a) => ({
            qty: a.order_items!.qty,
            nameEs: a.order_items!.name_snapshot_es,
            nameEn: a.order_items!.name_snapshot_en,
            lineCents: a.cents,
            partial: a.share_id !== null || a.cents < a.order_items!.qty * a.order_items!.unit_price_cents,
          })),
    plan: p.plan_parts && p.split_plans ? { parts: p.plan_parts, of: p.split_plans.parts } : null,
    subtotalCents: p.amount_cents,
    ivuStateCents: p.ivu_state_cents,
    ivuMunicipalCents: p.ivu_municipal_cents,
    tipCents: p.tip_cents,
    totalCents: p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents + p.tip_cents,
  };
}
