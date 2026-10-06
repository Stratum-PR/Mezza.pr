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
}

type Snapshot = { name_es?: string; name_en?: string }[];

/** What the guest's phone shows for its table: the live tab's orders, requests, totals and payment. */
export async function guestStatus(
  g: GuestTable,
  tabId?: string,
  device?: string | null,
): Promise<GuestStatus> {
  const db = createAdminClient();
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
    };
  }

  const [{ data: orders }, { data: requests }, { data: payments }, { data: people }] = await Promise.all([
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
      .select("id, status, method, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents")
      .eq("tab_id", tab.id)
      .order("created_at", { ascending: false })
      .limit(1),
    db
      .from("tab_participants")
      .select("id, guest_number, display_name, device_hash")
      .eq("tab_id", tab.id)
      .order("guest_number"),
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
  };
}
