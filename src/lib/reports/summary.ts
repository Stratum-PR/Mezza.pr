/**
 * Turns report_summary's raw rows into the ten Reportes metrics. Pure, so every derived number
 * (averages, shares, rates, the week-over-week pairing) is unit-tested without a database.
 */
import { addDays, daysBetween, isoWeekday, type Ymd } from "./time";

export type Method = "card" | "ath" | "cash";
export const METHODS: Method[] = ["card", "ath", "cash"];

export interface RawReport {
  totals: {
    sales: number;
    ivuState: number;
    ivuMunicipal: number;
    tips: number;
    covers: number;
    orders: number;
    card: number;
    ath: number;
    cash: number;
    refunds: number;
  };
  heat: { dow: number; hour: number; sales: number }[];
  daily: { date: Ymd; sales: number; orders: number; covers: number }[];
  tables: { label: string; tabs: number; covers: number; sales: number }[];
  methods: { method: Method; count: number; amount: number; tips: number }[];
  ivuMonthly: { month: string; sales: number; state: number; municipal: number }[];
  items: {
    id: string;
    nameEs: string;
    nameEn: string;
    archived: boolean;
    units: number;
    revenue: number;
    withModifiers: number;
    hasModifiers: boolean;
  }[];
  soldOut: {
    id: string;
    nameEs: string;
    nameEn: string;
    events: number;
    hours: number;
    lostUnits: number;
    lostRevenue: number;
  }[];
  sources: { source: "qr" | "staff"; language: "es" | "en"; count: number }[];
}

const share = (part: number, whole: number) => (whole > 0 ? part / whole : null);

export interface Report {
  range: { from: Ymd; to: Ymd; days: number };
  totals: RawReport["totals"] & { tabs: number };
  /** 1. Average sales per weekday (1 = Monday) and hour; null where the restaurant had no sales. */
  heat: { dow: number; hour: number; avg: number }[];
  heatHours: number[];
  /** 2. Each day of the range next to the same weekday a week earlier. */
  daily: { date: Ymd; sales: number; lastWeek: number }[];
  /** 3. */
  averageCheck: { perTable: number | null; perGuest: number | null };
  tables: {
    label: string;
    tabs: number;
    covers: number;
    sales: number;
    perTable: number;
    perGuest: number;
  }[];
  /** 4. Tip % is over the pre-tax amount, card and ATH only (cash tips stay off the books). */
  mix: { method: Method; amount: number; count: number; share: number | null; tipPct: number | null }[];
  tipPct: number | null;
  /** 5. */
  ivuMonthly: RawReport["ivuMonthly"];
  /** 6. Best and worst five, by units and by revenue. Worst includes dishes that never sold. */
  sellers: {
    byUnits: { best: RawReport["items"]; worst: RawReport["items"] };
    byRevenue: { best: RawReport["items"]; worst: RawReport["items"] };
  };
  /** 7. Share of units ordered with at least one add-on, for dishes that offer any. */
  modifierRate: { id: string; nameEs: string; nameEn: string; units: number; rate: number }[];
  /** 8. */
  soldOut: RawReport["soldOut"];
  lostRevenue: number;
  /** 9. Orders placed from guest phones (QR) and payments made on them (card and ATH Móvil). */
  qr: { orderShare: number | null; paymentShare: number | null; qrOrders: number; orders: number };
  /** 10. Menu language on QR orders. */
  language: { es: number; en: number; enShare: number | null };
}

function pick(items: RawReport["items"], key: "units" | "revenue") {
  const sold = [...items].sort((a, b) => b[key] - a[key] || a.nameEs.localeCompare(b.nameEs));
  const current = sold.filter((i) => !i.archived);
  return {
    best: sold.filter((i) => i[key] > 0).slice(0, 5),
    worst: [...current].reverse().slice(0, 5),
  };
}

export function shapeReport(raw: RawReport, from: Ymd, to: Ymd): Report {
  const days = daysBetween(from, to) + 1;

  // Heat map: average per occurrence of that weekday in the range.
  const weekdayCount = new Map<number, number>();
  for (let i = 0; i < days; i++) {
    const dow = isoWeekday(addDays(from, i));
    weekdayCount.set(dow, (weekdayCount.get(dow) ?? 0) + 1);
  }
  const heat = raw.heat.map((h) => ({
    dow: h.dow,
    hour: h.hour,
    avg: Math.round(h.sales / (weekdayCount.get(h.dow) ?? 1)),
  }));
  const hoursWithSales = heat.filter((h) => h.avg > 0).map((h) => h.hour);
  const heatHours = hoursWithSales.length
    ? Array.from(
        { length: Math.max(...hoursWithSales) - Math.min(...hoursWithSales) + 1 },
        (_, i) => Math.min(...hoursWithSales) + i,
      )
    : [];

  const byDate = new Map(raw.daily.map((d) => [d.date, d.sales]));
  const daily = Array.from({ length: days }, (_, i) => {
    const date = addDays(from, i);
    return { date, sales: byDate.get(date) ?? 0, lastWeek: byDate.get(addDays(date, -7)) ?? 0 };
  });

  const tabs = raw.tables.reduce((n, t) => n + t.tabs, 0);
  const tabSales = raw.tables.reduce((n, t) => n + t.sales, 0);
  const tabCovers = raw.tables.reduce((n, t) => n + t.covers, 0);
  const tables = [...raw.tables]
    .sort((a, b) => a.label.localeCompare(b.label, "es", { numeric: true }))
    .map((t) => ({
      ...t,
      perTable: Math.round(t.sales / Math.max(t.tabs, 1)),
      perGuest: Math.round(t.sales / Math.max(t.covers, 1)),
    }));

  const paid = raw.methods.reduce((n, m) => n + m.amount, 0);
  const mix = METHODS.map((method) => {
    const m = raw.methods.find((x) => x.method === method);
    const amount = m?.amount ?? 0;
    return {
      method,
      amount,
      count: m?.count ?? 0,
      share: share(amount, paid),
      tipPct: method === "cash" ? null : share(m?.tips ?? 0, amount),
    };
  });
  const phone = raw.methods.filter((m) => m.method !== "cash");
  const tipPct = share(
    phone.reduce((n, m) => n + m.tips, 0),
    phone.reduce((n, m) => n + m.amount, 0),
  );

  const offersModifiers = raw.items.filter((i) => i.hasModifiers && i.units > 0);
  const modifierRate = offersModifiers
    .map((i) => ({
      id: i.id,
      nameEs: i.nameEs,
      nameEn: i.nameEn,
      units: i.units,
      rate: i.withModifiers / i.units,
    }))
    .sort((a, b) => b.rate - a.rate || b.units - a.units);

  const orders = raw.sources.reduce((n, s) => n + s.count, 0);
  const qrOrders = raw.sources.filter((s) => s.source === "qr").reduce((n, s) => n + s.count, 0);
  const payments = raw.methods.reduce((n, m) => n + m.count, 0);
  const phonePayments = phone.reduce((n, m) => n + m.count, 0);
  const lang = (l: "es" | "en") =>
    raw.sources.filter((s) => s.source === "qr" && s.language === l).reduce((n, s) => n + s.count, 0);

  return {
    range: { from, to, days },
    totals: { ...raw.totals, tabs },
    heat,
    heatHours,
    daily,
    averageCheck: {
      perTable: tabs ? Math.round(tabSales / tabs) : null,
      perGuest: tabCovers ? Math.round(tabSales / tabCovers) : null,
    },
    tables,
    mix,
    tipPct,
    ivuMonthly: raw.ivuMonthly,
    sellers: { byUnits: pick(raw.items, "units"), byRevenue: pick(raw.items, "revenue") },
    modifierRate,
    soldOut: raw.soldOut.filter((s) => s.hours > 0),
    lostRevenue: raw.soldOut.reduce((n, s) => n + s.lostRevenue, 0),
    qr: {
      orderShare: share(qrOrders, orders),
      paymentShare: share(phonePayments, payments),
      qrOrders,
      orders,
    },
    language: { es: lang("es"), en: lang("en"), enShare: share(lang("en"), lang("es") + lang("en")) },
  };
}
