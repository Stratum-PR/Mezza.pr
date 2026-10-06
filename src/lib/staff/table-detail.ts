import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { CheckLineInput, CheckPersonRef } from "@/lib/guest/group-check";
import type { Cents } from "@/lib/money";

type Db = SupabaseClient<Database>;

export interface TableDetail {
  table: { id: string; label: string };
  tab: {
    id: string;
    status: "open" | "paying" | "closed";
    openedAt: string;
    people: CheckPersonRef[];
    orders: { id: string; number: number; status: string; lines: (CheckLineInput & { orderId: string })[] }[];
    /** Lines money has touched (a payment that hasn't failed, a write-off, or the active even split). */
    lockedLines: string[];
    owed: Record<string, Cents>;
    tableCents: Cents;
    balanceCents: Cents;
    plan: { parts: number; partsLeft: number; amountLeftCents: Cents; nextShareCents: Cents } | null;
    payments: {
      id: string;
      status: string;
      method: "card" | "ath" | "cash";
      participantId: string | null;
      forParticipantId: string | null;
      option: string | null;
      planParts: number | null;
      subtotalCents: Cents;
      totalCents: Cents;
      refundedCents: Cents;
      createdAt: string;
    }[];
    writeOffs: {
      id: string;
      participantId: string | null;
      scope: string;
      cents: Cents;
      reason: string;
      createdAt: string;
    }[];
  } | null;
}

/** One table for staff (Mesas → table), read with the signed-in user's client so RLS applies. */
export async function loadTableDetail(
  db: Db,
  restaurantId: string,
  tableId: string,
): Promise<TableDetail | null> {
  const { data: table } = await db
    .from("dining_tables")
    .select("id, label")
    .eq("id", tableId)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (!table) return null;
  const { data: tab } = await db
    .from("tabs")
    .select("id, status, opened_at")
    .eq("table_id", tableId)
    .neq("status", "closed")
    .maybeSingle();
  if (!tab) return { table, tab: null };

  const [people, orders, checkout, payments, allocations, writeOffs, planUnits] = await Promise.all([
    db
      .from("tab_participants")
      .select("id, guest_number, display_name")
      .eq("tab_id", tab.id)
      .order("guest_number"),
    db
      .from("orders")
      .select(
        "id, number, status, order_items(id, qty, name_snapshot_es, name_snapshot_en, unit_price_cents, voided_at, participant_id, shared, created_at, order_item_shares(participant_id, cents))",
      )
      .eq("tab_id", tab.id)
      .order("created_at"),
    db.rpc("tab_checkout", { p_tab_id: tab.id }),
    db
      .from("payments")
      .select(
        "id, status, method, participant_id, for_participant_id, split_option, plan_parts, amount_cents, ivu_state_cents, ivu_municipal_cents, tip_cents, created_at, refunds(amount_cents)",
      )
      .eq("tab_id", tab.id)
      .neq("status", "failed")
      .order("created_at", { ascending: false }),
    db
      .from("payment_allocations")
      .select("order_item_id, payments!inner(tab_id, status)")
      .eq("payments.tab_id", tab.id)
      .neq("payments.status", "failed"),
    db
      .from("write_offs")
      .select("id, participant_id, scope, cents, reason, created_at, write_off_allocations(order_item_id)")
      .eq("tab_id", tab.id)
      .order("created_at", { ascending: false }),
    db
      .from("split_plan_units")
      .select("order_item_id, split_plans!inner(tab_id, status)")
      .eq("split_plans.tab_id", tab.id)
      .eq("split_plans.status", "active"),
  ]);

  const c = checkout.data as unknown as {
    people: { id: string; owed_cents: number }[];
    table_cents: number;
    balance_cents: number;
    plan: { parts: number; parts_left: number; amount_left_cents: number; next_share_cents: number } | null;
  } | null;

  const locked = new Set<string>([
    ...(allocations.data ?? []).map((a) => a.order_item_id),
    ...(writeOffs.data ?? []).flatMap((w) => (w.write_off_allocations ?? []).map((a) => a.order_item_id)),
    ...(planUnits.data ?? []).map((u) => u.order_item_id),
  ]);

  return {
    table,
    tab: {
      id: tab.id,
      status: tab.status,
      openedAt: tab.opened_at,
      people: (people.data ?? [])
        .filter((p) => p.guest_number !== null)
        .map((p) => ({ id: p.id, number: p.guest_number!, name: p.display_name })),
      orders: (orders.data ?? []).map((o) => ({
        id: o.id,
        number: o.number,
        status: o.status,
        lines: (o.order_items ?? [])
          .filter((l) => !l.voided_at)
          .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
          .map((l) => ({
            id: l.id,
            orderId: o.id,
            qty: l.qty,
            nameEs: l.name_snapshot_es,
            nameEn: l.name_snapshot_en,
            lineCents: l.qty * l.unit_price_cents,
            participantId: l.participant_id,
            shared: l.shared,
            shares: (l.order_item_shares ?? []).map((s) => ({
              participantId: s.participant_id,
              cents: s.cents,
            })),
          })),
      })),
      lockedLines: [...locked],
      owed: Object.fromEntries((c?.people ?? []).map((p) => [p.id, p.owed_cents])),
      tableCents: c?.table_cents ?? 0,
      balanceCents: c?.balance_cents ?? 0,
      plan: c?.plan
        ? {
            parts: c.plan.parts,
            partsLeft: c.plan.parts_left,
            amountLeftCents: c.plan.amount_left_cents,
            nextShareCents: c.plan.next_share_cents,
          }
        : null,
      payments: (payments.data ?? []).map((p) => ({
        id: p.id,
        status: p.status,
        method: p.method,
        participantId: p.participant_id,
        forParticipantId: p.for_participant_id,
        option: p.split_option,
        planParts: p.plan_parts,
        subtotalCents: p.amount_cents,
        totalCents: p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents + p.tip_cents,
        refundedCents: (p.refunds ?? []).reduce((n, r) => n + r.amount_cents, 0),
        createdAt: p.created_at,
      })),
      writeOffs: (writeOffs.data ?? []).map((w) => ({
        id: w.id,
        participantId: w.participant_id,
        scope: w.scope,
        cents: w.cents,
        reason: w.reason,
        createdAt: w.created_at,
      })),
    },
  };
}
