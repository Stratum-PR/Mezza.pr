import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { loadFloor } from "@/lib/staff/floor";
import { METHODS, type Method } from "./summary";
import { addDays, localParts, localToUtc, type Ymd } from "./time";

type Db = SupabaseClient<Database>;
type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];

export interface Today {
  date: Ymd;
  timeZone: string;
  hour: number;
  sales: number;
  tips: number;
  ivuState: number;
  ivuMunicipal: number;
  refunds: number;
  payments: number;
  byMethod: { method: Method; amount: number; count: number }[];
  /** Same weekday last week: up to this hour (the fair comparison) and the whole day. */
  lastWeek: { date: Ymd; soFar: number; fullDay: number };
  /** Running total by hour, today and last week, for the comparison chart. */
  hourly: { hour: number; today: number | null; lastWeek: number }[];
  openTables: number;
  tables: number;
  alerts: {
    requests: { id: string; tableLabel: string; kind: "call_server" | "bring_check"; createdAt: string }[];
    cash: { id: string; tableLabel: string; totalCents: number }[];
    pos: { tabId: string; tableLabel: string; posTotalCents: number }[];
    printerFailures: { id: string; kind: string; error: string | null; createdAt: string }[];
  };
}

/**
 * Inicio. Today's numbers come live from payments (no waiting on a summary refresh); last week's
 * from daily_sales. Everything is in the restaurant's local time.
 */
export async function loadToday(db: Db, restaurant: Restaurant, now = new Date()): Promise<Today> {
  const tz = restaurant.timezone;
  const { ymd: date, hour } = localParts(now, tz);
  const start = localToUtc(date, 0, tz).toISOString();
  const weekAgo = addDays(date, -7);

  const [pays, refunds, lastWeekRows, failures, floor] = await Promise.all([
    db
      .from("payments")
      .select("method, amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents, paid_at")
      .eq("restaurant_id", restaurant.id)
      .in("status", ["paid", "partially_refunded", "refunded"])
      .gte("paid_at", start),
    db.from("refunds").select("amount_cents").eq("restaurant_id", restaurant.id).gte("created_at", start),
    db.from("daily_sales").select("hour, sales_cents").eq("restaurant_id", restaurant.id).eq("date", weekAgo),
    db
      .from("print_jobs")
      .select("id, kind, error, created_at")
      .eq("restaurant_id", restaurant.id)
      .eq("status", "failed")
      .gte("created_at", start)
      .order("created_at", { ascending: false })
      .limit(5),
    loadFloor(db, restaurant),
  ]);

  const rows = pays.data ?? [];
  const sum = (key: "amount_cents" | "tip_cents" | "ivu_state_cents" | "ivu_municipal_cents") =>
    rows.reduce((n, p) => n + p[key], 0);

  const todayByHour = new Array<number>(24).fill(0);
  for (const p of rows)
    if (p.paid_at) todayByHour[localParts(new Date(p.paid_at), tz).hour]! += p.amount_cents;
  const weekByHour = new Array<number>(24).fill(0);
  for (const r of lastWeekRows.data ?? []) weekByHour[r.hour]! += r.sales_cents;

  // Chart from the first hour either day had sales to the later of now and last week's last sale.
  const active = [...todayByHour, ...weekByHour].map((v, i) => (v > 0 ? i % 24 : -1)).filter((h) => h >= 0);
  const first = active.length ? Math.min(...active, hour) : hour;
  const lastWeekEnd = weekByHour.findLastIndex((v) => v > 0);
  const last = Math.max(hour, lastWeekEnd);
  let runToday = 0;
  let runWeek = 0;
  const hourly: Today["hourly"] = [];
  for (let h = 0; h <= last; h++) {
    runToday += todayByHour[h]!;
    runWeek += weekByHour[h]!;
    if (h >= first) hourly.push({ hour: h, today: h <= hour ? runToday : null, lastWeek: runWeek });
  }

  return {
    date,
    timeZone: tz,
    hour,
    sales: sum("amount_cents"),
    tips: sum("tip_cents"),
    ivuState: sum("ivu_state_cents"),
    ivuMunicipal: sum("ivu_municipal_cents"),
    refunds: (refunds.data ?? []).reduce((n, r) => n + r.amount_cents, 0),
    payments: rows.length,
    byMethod: METHODS.map((method) => {
      const m = rows.filter((p) => p.method === method);
      return { method, amount: m.reduce((n, p) => n + p.amount_cents, 0), count: m.length };
    }),
    lastWeek: {
      date: weekAgo,
      soFar: weekByHour.slice(0, hour + 1).reduce((a, b) => a + b, 0),
      fullDay: weekByHour.reduce((a, b) => a + b, 0),
    },
    hourly,
    openTables: floor.tabs.length,
    tables: floor.tables.length,
    alerts: {
      requests: floor.requests,
      cash: floor.cashToCollect,
      pos: floor.posToClose,
      printerFailures: (failures.data ?? []).map((f) => ({
        id: f.id,
        kind: f.kind,
        error: f.error,
        createdAt: f.created_at,
      })),
    },
  };
}
