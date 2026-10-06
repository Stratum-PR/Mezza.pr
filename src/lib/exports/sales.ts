import "server-only";
import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { localParts, localToUtc, monthRange, addDays, type Ymd } from "@/lib/reports/time";
import { dollars, safeText, toCsv, type Cell } from "./csv";

type Db = SupabaseClient<Database>;

/** PostgREST returns at most 1000 rows per request; page through everything. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(`export query failed: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}

type Money = { cents: number };
type Value = string | number | Money | null;
export interface Sheet {
  key: "orders" | "lines" | "payments" | "refunds";
  columns: string[];
  rows: Value[][];
}

export type SalesColumns = Record<Sheet["key"], string[]> & {
  sheetNames: Record<Sheet["key"], string>;
  source: Record<"qr" | "staff", string>;
  method: Record<"card" | "ath" | "cash", string>;
  status: Record<string, string>;
  yes: string;
};

/**
 * Orders, lines, payments and refunds for one month (local dates), with table labels and the staff
 * who took, confirmed, voided or approved each one.
 */
export async function loadSales(
  db: Db,
  restaurant: { id: string; timezone: string },
  month: string,
  l: SalesColumns,
): Promise<Sheet[]> {
  const tz = restaurant.timezone;
  const { from, to } = monthRange(month);
  const start = localToUtc(from, 0, tz).toISOString();
  const end = localToUtc(addDays(to, 1), 0, tz).toISOString();
  const rid = restaurant.id;

  const [tables, tabs, profiles, orders, lines, payments, refunds] = await Promise.all([
    db.from("dining_tables").select("id, label").eq("restaurant_id", rid),
    fetchAll((a, b) =>
      db
        .from("tabs")
        .select("id, table_id")
        .eq("restaurant_id", rid)
        .gte("opened_at", new Date(Date.parse(start) - 2 * 86_400_000).toISOString())
        .lt("opened_at", end)
        .order("id")
        .range(a, b),
    ),
    db.from("profiles").select("user_id, full_name"),
    fetchAll((a, b) =>
      db
        .from("orders")
        .select("id, number, tab_id, source, guest_language, status, created_by, created_at")
        .eq("restaurant_id", rid)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("order_items")
        .select(
          "id, qty, unit_price_cents, name_snapshot_es, modifiers_snapshot, note, voided_at, void_reason, voided_by, orders!inner(number, created_at)",
        )
        .eq("restaurant_id", rid)
        .gte("orders.created_at", start)
        .lt("orders.created_at", end)
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("payments")
        .select(
          "id, tab_id, method, status, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents, provider_ref, confirmed_by, paid_at",
        )
        .eq("restaurant_id", rid)
        .in("status", ["paid", "partially_refunded", "refunded"])
        .gte("paid_at", start)
        .lt("paid_at", end)
        .order("paid_at")
        .order("id")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      db
        .from("refunds")
        .select("id, payment_id, amount_cents, reason, approved_by, created_at, payments(method, paid_at)")
        .eq("restaurant_id", rid)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at")
        .order("id")
        .range(a, b),
    ),
  ]);

  const label = new Map((tables.data ?? []).map((t) => [t.id, t.label]));
  const tabTable = new Map(tabs.map((t) => [t.id, t.table_id]));
  const tableOf = (tabId: string) => label.get(tabTable.get(tabId) ?? "") ?? "";
  const person = new Map((profiles.data ?? []).map((p) => [p.user_id, p.full_name ?? ""]));
  const who = (id: string | null) => (id ? person.get(id) || "—" : "");
  const at = (iso: string | null): [Ymd, string] => {
    if (!iso) return ["", ""];
    const p = localParts(new Date(iso), tz);
    return [p.ymd, `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`];
  };
  const lineTotals = new Map<number, number>();
  for (const li of lines) {
    if (li.voided_at) continue;
    lineTotals.set(li.orders.number, (lineTotals.get(li.orders.number) ?? 0) + li.qty * li.unit_price_cents);
  }

  return [
    {
      key: "orders",
      columns: l.orders,
      rows: orders.map((o) => [
        o.number,
        ...at(o.created_at),
        tableOf(o.tab_id),
        l.source[o.source],
        o.guest_language.toUpperCase(),
        l.status[o.status] ?? o.status,
        who(o.created_by),
        { cents: o.status === "void" ? 0 : (lineTotals.get(o.number) ?? 0) },
      ]),
    },
    {
      key: "lines",
      columns: l.lines,
      rows: lines.map((li) => [
        li.orders.number,
        ...at(li.orders.created_at),
        safeText(li.name_snapshot_es),
        li.qty,
        { cents: li.unit_price_cents },
        { cents: li.voided_at ? 0 : li.qty * li.unit_price_cents },
        safeText(
          ((li.modifiers_snapshot ?? []) as { name_es?: string }[])
            .map((m) => m.name_es)
            .filter(Boolean)
            .join(", "),
        ),
        safeText(li.note),
        li.voided_at ? l.yes : "",
        safeText(li.void_reason),
        who(li.voided_by),
      ]),
    },
    {
      key: "payments",
      columns: l.payments,
      rows: payments.map((p) => [
        ...at(p.paid_at),
        tableOf(p.tab_id),
        l.method[p.method],
        { cents: p.amount_cents },
        { cents: p.ivu_state_cents },
        { cents: p.ivu_municipal_cents },
        { cents: p.tip_cents },
        { cents: p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents + p.tip_cents },
        l.status[p.status] ?? p.status,
        p.provider_ref ?? "",
        who(p.confirmed_by),
      ]),
    },
    {
      key: "refunds",
      columns: l.refunds,
      rows: refunds.map((r) => [
        ...at(r.created_at),
        r.payments ? l.method[r.payments.method] : "",
        r.payments ? at(r.payments.paid_at)[0] : "",
        { cents: r.amount_cents },
        safeText(r.reason),
        who(r.approved_by),
      ]),
    },
  ];
}

const isMoney = (v: Value): v is Money => typeof v === "object" && v !== null;

/** One CSV with a titled section per sheet (orders, lines, payments, refunds). */
export function salesCsv(sheets: Sheet[], l: SalesColumns, title: string[]): string {
  const rows: Cell[][] = title.map((t) => [t]);
  for (const sheet of sheets) {
    rows.push([], [l.sheetNames[sheet.key]], sheet.columns);
    for (const r of sheet.rows) rows.push(r.map((v) => (isMoney(v) ? dollars(v.cents) : v)));
  }
  return toCsv(rows);
}

export async function salesXlsx(sheets: Sheet[], l: SalesColumns, title: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mezza";
  wb.title = title;
  for (const sheet of sheets) {
    const ws = wb.addWorksheet(l.sheetNames[sheet.key], { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(sheet.columns).font = { bold: true };
    for (const r of sheet.rows) ws.addRow(r.map((v) => (isMoney(v) ? v.cents / 100 : v)));
    sheet.columns.forEach((_, i) => {
      const col = ws.getColumn(i + 1);
      const sample = sheet.rows.find((r) => r[i] !== null && r[i] !== "")?.[i];
      if (sample !== undefined && isMoney(sample)) col.numFmt = '"$"#,##0.00';
      col.width = Math.min(40, Math.max(10, sheet.columns[i]!.length + 2));
    });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
