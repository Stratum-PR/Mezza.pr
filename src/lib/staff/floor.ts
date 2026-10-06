import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { computeIvu, type Cents } from "@/lib/money";

type Db = SupabaseClient<Database>;
type Snapshot = { name_es?: string; name_en?: string }[];

export type OrderStatus = "new" | "in_kitchen" | "ready" | "served" | "void";

export interface FloorLine {
  id: string;
  qty: number;
  nameEs: string;
  nameEn: string;
  options: string[];
  note: string | null;
  lineCents: Cents;
  voided: boolean;
}

export interface FloorOrder {
  id: string;
  number: number;
  status: OrderStatus;
  source: "qr" | "staff";
  createdAt: string;
  tabId: string;
  tableLabel: string;
  lines: FloorLine[];
  /** A QR order that opened a table that was free ("Mesa nueva por QR"). */
  openedTab: boolean;
  /** Ordered by someone who already paid at the table ("Pagó y pidió de nuevo"). */
  afterPayment: boolean;
}

export interface FloorTab {
  id: string;
  tableId: string;
  tableLabel: string;
  status: "open" | "paying" | "closed";
  openedAt: string;
  subtotalCents: Cents;
  totalWithIvuCents: Cents;
  posClosedAt: string | null;
  /** The tab's QR ordering cap: the restaurant's, plus whatever staff added ("Ampliar límite"). */
  qrCapCents: Cents;
}

export interface Floor {
  tables: {
    id: string;
    label: string;
    seats: number | null;
    area: string | null;
    shape: "square" | "round" | "long";
    pos_x: number | null;
    pos_y: number | null;
  }[];
  tabs: FloorTab[];
  requests: {
    id: string;
    tabId: string;
    tableLabel: string;
    kind: "call_server" | "bring_check";
    createdAt: string;
  }[];
  cashToCollect: { id: string; tabId: string; tableLabel: string; totalCents: Cents; createdAt: string }[];
  posToClose: { tabId: string; tableLabel: string; posTotalCents: Cents }[];
  /** Live tabs at 80% or more of their QR cap, so staff can raise it before guests get refused. */
  nearLimit: { tabId: string; tableLabel: string; subtotalCents: Cents; capCents: Cents }[];
  orders: FloorOrder[];
  payments: {
    id: string;
    tableLabel: string;
    method: "card" | "ath" | "cash";
    status: string;
    totalCents: Cents;
    paidAt: string | null;
  }[];
}

/**
 * The live floor for staff screens, read with the user's own client (RLS applies; the kitchen gets
 * no payments). Orders are the live tabs' plus anything the kitchen hasn't served yet.
 */
export async function loadFloor(
  db: Db,
  restaurant: { id: string; ivu_state_bps: number; ivu_municipal_bps: number; qr_max_tab_cents: number },
): Promise<Floor> {
  const rid = restaurant.id;
  const rates = { stateBps: restaurant.ivu_state_bps, municipalBps: restaurant.ivu_municipal_bps };
  const since = new Date(Date.now() - 16 * 3600_000).toISOString(); // today's service
  // Paid tables quiet for 10 minutes close on their own (close_idle_tabs), before the floor is read.
  await db.rpc("close_idle_tabs", { p_restaurant_id: rid });

  const [tables, tabs, requests, orders, pays] = await Promise.all([
    db
      .from("dining_tables")
      .select("id, label, seats, area, shape, pos_x, pos_y")
      .eq("restaurant_id", rid)
      .order("sort_order"),
    db
      .from("tabs")
      .select("id, table_id, status, opened_at, pos_closed_at, qr_limit_extra_cents")
      .eq("restaurant_id", rid)
      .or(`status.neq.closed,pos_closed_at.is.null`)
      .gt("opened_at", new Date(Date.now() - 24 * 3600_000).toISOString()),
    db
      .from("service_requests")
      .select("id, tab_id, kind, created_at")
      .eq("restaurant_id", rid)
      .eq("status", "open")
      .order("created_at"),
    db
      .from("orders")
      .select(
        "id, number, status, source, created_at, tab_id, opened_tab, after_payment, tabs(table_id), order_items(id, qty, name_snapshot_es, name_snapshot_en, unit_price_cents, modifiers_snapshot, note, voided_at)",
      )
      .eq("restaurant_id", rid)
      .gt("created_at", since)
      .order("created_at"),
    db
      .from("payments")
      .select(
        "id, tab_id, method, status, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents, created_at, paid_at, tabs(table_id)",
      )
      .eq("restaurant_id", rid)
      .gt("created_at", since)
      .order("created_at", { ascending: false }),
  ]);

  const tableLabel = new Map((tables.data ?? []).map((t) => [t.id, t.label]));
  const tabTable = new Map((tabs.data ?? []).map((t) => [t.id, t.table_id]));
  // Closed tabs aren't in the live list, so remember every tab's table from the rows that name it.
  for (const row of [...(orders.data ?? []), ...(pays.data ?? [])]) {
    if (row.tabs?.table_id) tabTable.set(row.tab_id, row.tabs.table_id);
  }
  const labelForTab = (tabId: string) => tableLabel.get(tabTable.get(tabId) ?? "") ?? "?";

  const mappedOrders: FloorOrder[] = (orders.data ?? []).map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    source: o.source,
    createdAt: o.created_at,
    tabId: o.tab_id,
    tableLabel: labelForTab(o.tab_id),
    lines: (o.order_items ?? []).map((l) => ({
      id: l.id,
      qty: l.qty,
      nameEs: l.name_snapshot_es,
      nameEn: l.name_snapshot_en,
      options: ((l.modifiers_snapshot ?? []) as Snapshot).map((m) => m.name_es ?? ""),
      note: l.note,
      lineCents: l.qty * l.unit_price_cents,
      voided: Boolean(l.voided_at),
    })),
    openedTab: o.opened_tab,
    afterPayment: o.after_payment,
  }));

  const liveTabIds = new Set((tabs.data ?? []).map((t) => t.id));
  const subtotalByTab = new Map<string, number>();
  for (const o of mappedOrders) {
    if (o.status === "void" || !liveTabIds.has(o.tabId)) continue;
    const live = o.lines.filter((l) => !l.voided).reduce((s, l) => s + l.lineCents, 0);
    subtotalByTab.set(o.tabId, (subtotalByTab.get(o.tabId) ?? 0) + live);
  }

  const payRows = pays.data ?? [];
  const paidByTab = new Map<string, number>();
  const paidSubtotalByTab = new Map<string, number>();
  for (const p of payRows) {
    if (p.status === "paid" || p.status === "partially_refunded") {
      paidByTab.set(
        p.tab_id,
        (paidByTab.get(p.tab_id) ?? 0) + p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents,
      );
      paidSubtotalByTab.set(p.tab_id, (paidSubtotalByTab.get(p.tab_id) ?? 0) + p.amount_cents);
    }
  }

  const floorTabs: FloorTab[] = (tabs.data ?? []).map((t) => {
    const subtotal = subtotalByTab.get(t.id) ?? 0;
    return {
      id: t.id,
      tableId: t.table_id,
      tableLabel: tableLabel.get(t.table_id) ?? "?",
      status: t.status,
      openedAt: t.opened_at,
      subtotalCents: subtotal,
      totalWithIvuCents: subtotal + computeIvu(subtotal, rates).total,
      posClosedAt: t.pos_closed_at,
      qrCapCents: restaurant.qr_max_tab_cents + t.qr_limit_extra_cents,
    };
  });

  return {
    tables: (tables.data ?? []) as Floor["tables"],
    tabs: floorTabs.filter((t) => t.status !== "closed"),
    requests: (requests.data ?? []).map((r) => ({
      id: r.id,
      tabId: r.tab_id,
      tableLabel: labelForTab(r.tab_id),
      kind: r.kind,
      createdAt: r.created_at,
    })),
    cashToCollect: payRows
      .filter((p) => p.method === "cash" && p.status === "pending")
      .map((p) => ({
        id: p.id,
        tabId: p.tab_id,
        tableLabel: labelForTab(p.tab_id),
        totalCents: p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents + p.tip_cents,
        createdAt: p.created_at,
      })),
    // Fiscal path A: a fully paid table stays on the list until someone taps "Cerrado en el POS".
    // People pay in parts now, so the table waits until payments cover everything on it.
    posToClose: floorTabs
      .filter(
        (t) => !t.posClosedAt && paidByTab.has(t.id) && (paidSubtotalByTab.get(t.id) ?? 0) >= t.subtotalCents,
      )
      .map((t) => ({ tabId: t.id, tableLabel: t.tableLabel, posTotalCents: paidByTab.get(t.id) ?? 0 })),
    nearLimit: floorTabs
      .filter((t) => t.status !== "closed" && t.subtotalCents * 5 >= t.qrCapCents * 4)
      .map((t) => ({
        tabId: t.id,
        tableLabel: t.tableLabel,
        subtotalCents: t.subtotalCents,
        capCents: t.qrCapCents,
      })),
    orders: mappedOrders,
    payments: payRows.map((p) => ({
      id: p.id,
      tableLabel: labelForTab(p.tab_id),
      method: p.method,
      status: p.status,
      totalCents: p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents + p.tip_cents,
      paidAt: p.paid_at,
    })),
  };
}
