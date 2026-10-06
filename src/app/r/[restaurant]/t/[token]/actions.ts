"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { availableMethods, payments } from "@/connectors/payments";
import type { OrderDraft, SubmitResult } from "@/connectors/orders";
import { rateLimiter } from "@/connectors/rate-limit";
import { isNotImplemented } from "@/connectors/shared";
import { createAdminClient } from "@/lib/db/admin";
import { ensureTab, resolveTable, type GuestTable } from "@/lib/guest/resolve";
import { guestStatus as loadStatus, type GuestStatus } from "@/lib/guest/status";
import { computeIvu, tipFromPercent, type Cents } from "@/lib/money";

async function guest(slug: string, token: string): Promise<GuestTable> {
  const g = await resolveTable(slug, token);
  if (!g) throw new Error("invalid_table");
  return g;
}

async function limited(key: string, max: number): Promise<boolean> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  return !(await rateLimiter().limit(`${key}:${ip}`, max, 60)).ok;
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
      }),
    )
    .min(1)
    .max(50),
});

/** "Enviar a cocina". The clientOrderId is the idempotency key, so a double tap makes one order. */
export async function guestPlaceOrder(slug: string, token: string, draft: OrderDraft): Promise<SubmitResult> {
  const g = await resolveTable(slug, token);
  if (!g) return { status: "rejected", reason: "invalid_table" };
  const parsed = draftSchema.safeParse(draft);
  if (!parsed.success) return { status: "rejected", reason: "validation" };
  if (await limited(`place-order:${g.table.id}`, 20))
    return { status: "rejected", reason: "validation", detail: "rate_limited" };

  const { data, error } = await createAdminClient().rpc("place_order", {
    p_restaurant_id: g.restaurant.id,
    p_table_id: g.table.id,
    p_client_order_id: parsed.data.clientOrderId,
    p_source: "qr",
    p_lines: parsed.data.lines,
    p_guest_language: parsed.data.guestLanguage,
  });
  if (error || !data) return { status: "rejected", reason: "validation", detail: "server" };
  const r = data as { status: string; order_id?: string; number?: number; reason?: string; detail?: string };
  if (r.status === "accepted") return { status: "accepted", orderId: r.order_id!, number: r.number! };
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
  return loadStatus(g, tabId && z.uuid().safeParse(tabId).success ? tabId : undefined);
}

/** "Llamar al mesero" / "Pedir la cuenta". One open request of each kind per tab. */
export async function guestRequest(
  slug: string,
  token: string,
  kind: "call_server" | "bring_check",
): Promise<{ ok: boolean }> {
  const g = await guest(slug, token);
  if (!["call_server", "bring_check"].includes(kind)) return { ok: false };
  if (await limited(`request:${g.table.id}`, 10)) return { ok: false };
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
  method: z.enum(["card", "ath", "cash"]),
  tip: z.union([
    z.object({ percent: z.number().int().min(0).max(100) }),
    z.object({ cents: z.number().int().min(0).max(1_000_000) }),
  ]),
  idempotencyKey: z.uuid(),
  locale: z.enum(["es", "en"]),
});

export type PayResult =
  | { ok: true; paymentId: string; next: "done" | "staff_confirmation" }
  | { ok: false; error: "nothing_to_pay" | "unavailable" | "coming_soon" | "failed" };

/**
 * Pays the table's one check. Totals are recomputed here from the database (never trusted from the
 * phone): subtotal of live lines, IVU per component, tip on the pre-tax subtotal.
 */
export async function guestPay(
  slug: string,
  token: string,
  input: z.input<typeof paySchema>,
): Promise<PayResult> {
  const g = await guest(slug, token);
  const parsed = paySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "failed" };
  const status = await loadStatus(g);
  if (!status.tab || status.totals.subtotalCents === 0) return { ok: false, error: "nothing_to_pay" };
  const ctx = { restaurantId: g.restaurant.id, locale: parsed.data.locale };
  if (!(await availableMethods(ctx)).includes(parsed.data.method)) return { ok: false, error: "unavailable" };

  const subtotal: Cents = status.totals.subtotalCents;
  const ivu = computeIvu(subtotal, {
    stateBps: g.restaurant.ivuStateBps,
    municipalBps: g.restaurant.ivuMunicipalBps,
  });
  const tip =
    "percent" in parsed.data.tip ? tipFromPercent(subtotal, parsed.data.tip.percent) : parsed.data.tip.cents;

  // The table stops taking new orders while it pays.
  await createAdminClient()
    .from("tabs")
    .update({ status: "paying" })
    .eq("id", status.tab.id)
    .eq("status", "open");
  try {
    const { paymentId, next } = await payments()[parsed.data.method].createPayment(ctx, {
      tabId: status.tab.id,
      idempotencyKey: parsed.data.idempotencyKey,
      amountCents: subtotal,
      tipCents: tip,
      ivuStateCents: ivu.state,
      ivuMunicipalCents: ivu.municipal,
      returnUrl: `/r/${slug}/t/${token}`,
    });
    return { ok: true, paymentId, next: next.kind === "staff_confirmation" ? "staff_confirmation" : "done" };
  } catch (error) {
    await createAdminClient()
      .from("tabs")
      .update({ status: "open" })
      .eq("id", status.tab.id)
      .eq("status", "paying");
    return { ok: false, error: isNotImplemented(error) ? "coming_soon" : "failed" };
  }
}

export interface Receipt {
  /** The tab it paid; a new tab at the table means a new visit, and the receipt is put away. */
  tabId: string;
  restaurantName: string;
  tableLabel: string;
  paidAt: string | null;
  method: "card" | "ath" | "cash";
  status: string;
  lines: { qty: number; nameEs: string; nameEn: string; lineCents: Cents }[];
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
      "id, tab_id, method, status, paid_at, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents, tabs!inner(table_id)",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!p || p.tabs?.table_id !== g.table.id) return null;
  const status = await loadStatus(g, p.tab_id);
  return {
    tabId: p.tab_id,
    restaurantName: g.restaurant.name,
    tableLabel: g.table.label,
    paidAt: p.paid_at,
    method: p.method,
    status: p.status,
    lines: status.orders
      .filter((o) => o.status !== "void")
      .flatMap((o) => o.lines)
      .map((l) => ({ qty: l.qty, nameEs: l.nameEs, nameEn: l.nameEn, lineCents: l.lineCents })),
    subtotalCents: p.amount_cents,
    ivuStateCents: p.ivu_state_cents,
    ivuMunicipalCents: p.ivu_municipal_cents,
    tipCents: p.tip_cents,
    totalCents: p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents + p.tip_cents,
  };
}
