import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import { computeIvu, type Cents } from "@/lib/money";
import type { CheckPersonRef } from "./group-check";
import type { GuestTable } from "./resolve";

export type OrderStatus = "new" | "in_kitchen" | "ready" | "served" | "void";

export interface GuestLine {
  id: string;
  qty: number;
  nameEs: string;
  nameEn: string;
  optionsEs: string[];
  optionsEn: string[];
  note: string | null;
  lineCents: Cents;
  participantId: string | null;
  shared: boolean;
  shares: { participantId: string; cents: Cents }[];
}

export interface GuestStatus {
  tab: { id: string; status: "open" | "paying" | "closed" } | null;
  orders: { id: string; number: number; status: OrderStatus; createdAt: string; lines: GuestLine[] }[];
  openRequests: ("call_server" | "bring_check")[];
  totals: { subtotalCents: Cents; ivuStateCents: Cents; ivuMunicipalCents: Cents };
  payment: { id: string; status: string; method: "card" | "ath" | "cash"; totalCents: Cents } | null;
  /** People at the table, in join order. */
  people: CheckPersonRef[];
  /** This phone's participant, once it has ordered. */
  me: string | null;
  /** What's owed, for the "Pagar" screen (tab_checkout); null without a tab. */
  checkout: GuestCheckout | null;
  /** The table's payments that haven't failed, newest first. */
  payments: GuestPayment[];
}

export interface GuestCheckout {
  owed: Record<string, Cents>;
  tableCents: Cents;
  balanceCents: Cents;
  paidBeforeCents: Cents;
  plan: {
    id: string;
    parts: number;
    partsLeft: number;
    amountLeftCents: Cents;
    nextShareCents: Cents;
  } | null;
}

export interface GuestPayment {
  id: string;
  status: string;
  method: "card" | "ath" | "cash";
  totalCents: Cents;
  participantId: string | null;
  createdAt: string;
}

type Snapshot = { name_es?: string; name_en?: string }[];

/** What the guest's phone shows for its table: the live tab's orders, requests, totals and payment. */
export async function guestStatus(
  g: GuestTable,
  tabId?: string,
  device?: string | null,
): Promise<GuestStatus> {
  const db = createAdminClient();
  // A paid table quiet for 10 minutes closes, so the next party starts fresh.
  await db.rpc("close_idle_tabs", { p_restaurant_id: g.restaurant.id });
  const tabQuery = db.from("tabs").select("id, status").eq("table_id", g.table.id);
  const { data: tab } = tabId
    ? await tabQuery.eq("id", tabId).maybeSingle()
    : await tabQuery.neq("status", "closed").maybeSingle();
  if (!tab) {
    return {
      tab: null,
      orders: [],
      openRequests: [],
      totals: { subtotalCents: 0, ivuStateCents: 0, ivuMunicipalCents: 0 },
      payment: null,
      people: [],
      me: null,
      checkout: null,
      payments: [],
    };
  }

  const [{ data: orders }, { data: requests }, { data: payments }, { data: people }, { data: checkout }] =
    await Promise.all([
      db
        .from("orders")
        .select(
          "id, number, status, created_at, order_items(id, qty, name_snapshot_es, name_snapshot_en, unit_price_cents, modifiers_snapshot, note, voided_at, participant_id, shared, created_at, order_item_shares(participant_id, cents))",
        )
        .eq("tab_id", tab.id)
        .order("created_at"),
      db.from("service_requests").select("kind").eq("tab_id", tab.id).eq("status", "open"),
      db
        .from("payments")
        .select(
          "id, status, method, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents, participant_id, created_at",
        )
        .eq("tab_id", tab.id)
        .order("created_at", { ascending: false }),
      db
        .from("tab_participants")
        .select("id, guest_number, display_name, device_hash")
        .eq("tab_id", tab.id)
        .order("guest_number"),
      db.rpc("tab_checkout", { p_tab_id: tab.id }),
    ]);

  const mapped = (orders ?? []).map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status as OrderStatus,
    createdAt: o.created_at,
    lines: (o.order_items ?? [])
      .filter((l) => !l.voided_at)
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
      .map((l) => {
        const mods = (l.modifiers_snapshot ?? []) as Snapshot;
        return {
          id: l.id,
          qty: l.qty,
          nameEs: l.name_snapshot_es,
          nameEn: l.name_snapshot_en,
          optionsEs: mods.map((m) => m.name_es ?? ""),
          optionsEn: mods.map((m) => m.name_en ?? ""),
          note: l.note,
          lineCents: l.qty * l.unit_price_cents,
          participantId: l.participant_id,
          shared: l.shared,
          shares: (l.order_item_shares ?? []).map((s) => ({
            participantId: s.participant_id,
            cents: s.cents,
          })),
        };
      }),
  }));
  const subtotal = mapped
    .filter((o) => o.status !== "void")
    .flatMap((o) => o.lines)
    .reduce((s, l) => s + l.lineCents, 0);
  const ivu = computeIvu(subtotal, {
    stateBps: g.restaurant.ivuStateBps,
    municipalBps: g.restaurant.ivuMunicipalBps,
  });
  const p = payments?.[0];

  return {
    tab: { id: tab.id, status: tab.status },
    orders: mapped,
    openRequests: [...new Set((requests ?? []).map((r) => r.kind))],
    totals: { subtotalCents: subtotal, ivuStateCents: ivu.state, ivuMunicipalCents: ivu.municipal },
    payment: p
      ? {
          id: p.id,
          status: p.status,
          method: p.method,
          totalCents: p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents + p.tip_cents,
        }
      : null,
    people: (people ?? [])
      .filter((p) => p.guest_number !== null)
      .map((p) => ({ id: p.id, number: p.guest_number!, name: p.display_name })),
    me: (device && people?.find((p) => p.device_hash === device)?.id) || null,
    checkout: checkout ? mapCheckout(checkout as unknown as RawCheckout) : null,
    payments: (payments ?? [])
      .filter((x) => x.status !== "failed")
      .map((x) => ({
        id: x.id,
        status: x.status,
        method: x.method,
        totalCents: x.amount_cents + x.ivu_state_cents + x.ivu_municipal_cents + x.tip_cents,
        participantId: x.participant_id,
        createdAt: x.created_at,
      })),
  };
}

interface RawCheckout {
  people: { id: string; owed_cents: number }[];
  table_cents: number;
  balance_cents: number;
  paid_before_cents: number;
  plan: {
    id: string;
    parts: number;
    parts_left: number;
    amount_left_cents: number;
    next_share_cents: number;
  } | null;
}

function mapCheckout(c: RawCheckout): GuestCheckout {
  return {
    owed: Object.fromEntries(c.people.map((p) => [p.id, p.owed_cents])),
    tableCents: c.table_cents,
    balanceCents: c.balance_cents,
    paidBeforeCents: c.paid_before_cents,
    plan: c.plan && {
      id: c.plan.id,
      parts: c.plan.parts,
      partsLeft: c.plan.parts_left,
      amountLeftCents: c.plan.amount_left_cents,
      nextShareCents: c.plan.next_share_cents,
    },
  };
}
