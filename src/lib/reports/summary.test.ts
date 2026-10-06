import { describe, expect, it } from "vitest";
import { shapeReport, type RawReport } from "./summary";

const item = (
  id: string,
  units: number,
  revenue: number,
  extra: Partial<RawReport["items"][number]> = {},
) => ({
  id,
  nameEs: id,
  nameEn: id,
  archived: false,
  units,
  revenue,
  withModifiers: 0,
  hasModifiers: false,
  ...extra,
});

const raw: RawReport = {
  totals: {
    sales: 10_000,
    ivuState: 1050,
    ivuMunicipal: 100,
    tips: 900,
    covers: 6,
    orders: 4,
    card: 5000,
    ath: 2000,
    cash: 3000,
    refunds: 0,
  },
  // Range is Mon 2026-09-28 … Sun 2026-10-11: two Mondays.
  heat: [
    { dow: 1, hour: 9, sales: 4000 },
    { dow: 1, hour: 12, sales: 1000 },
  ],
  daily: [
    { date: "2026-09-21", sales: 700, orders: 1, covers: 2 },
    { date: "2026-09-28", sales: 900, orders: 1, covers: 2 },
    { date: "2026-10-05", sales: 1200, orders: 1, covers: 2 },
  ],
  tables: [
    { label: "10", tabs: 1, covers: 2, sales: 3000 },
    { label: "2", tabs: 2, covers: 4, sales: 7000 },
  ],
  methods: [
    { method: "card", count: 2, amount: 5000, tips: 900 },
    { method: "ath", count: 1, amount: 2000, tips: 300 },
    { method: "cash", count: 1, amount: 3000, tips: 0 },
  ],
  ivuMonthly: [],
  items: [
    item("cafe", 40, 10_000, { hasModifiers: true, withModifiers: 10 }),
    item("flan", 5, 2000),
    item("malta", 0, 0),
    item("viejo", 3, 600, { archived: true }),
  ],
  soldOut: [
    { id: "flan", nameEs: "Flan", nameEn: "Flan", events: 1, hours: 2, lostUnits: 1.5, lostRevenue: 600 },
    { id: "malta", nameEs: "Malta", nameEn: "Malta", events: 3, hours: 0, lostUnits: 0, lostRevenue: 0 },
  ],
  sources: [
    { source: "qr", language: "es", count: 2 },
    { source: "qr", language: "en", count: 1 },
    { source: "staff", language: "es", count: 1 },
  ],
};

const report = shapeReport(raw, "2026-09-28", "2026-10-11");

describe("shapeReport", () => {
  it("averages the heat map per occurrence of each weekday", () => {
    expect(report.heat.find((h) => h.hour === 9)?.avg).toBe(2000);
    expect(report.heatHours).toEqual([9, 10, 11, 12]);
  });

  it("pairs each day with the same weekday a week earlier", () => {
    expect(report.daily).toHaveLength(14);
    expect(report.daily[0]).toEqual({ date: "2026-09-28", sales: 900, lastWeek: 700 });
    expect(report.daily[7]).toEqual({ date: "2026-10-05", sales: 1200, lastWeek: 900 });
    expect(report.daily[1]?.sales).toBe(0);
  });

  it("computes average checks per table and per guest, tables in natural order", () => {
    expect(report.averageCheck).toEqual({ perTable: 3333, perGuest: 1667 });
    expect(report.tables.map((t) => t.label)).toEqual(["2", "10"]);
    expect(report.tables[0]).toMatchObject({ perTable: 3500, perGuest: 1750 });
  });

  it("splits the payment mix and keeps cash out of the tip %", () => {
    expect(report.mix.map((m) => m.share)).toEqual([0.5, 0.2, 0.3]);
    expect(report.mix[0]?.tipPct).toBe(0.18);
    expect(report.mix[2]?.tipPct).toBeNull();
    expect(report.tipPct).toBeCloseTo(1200 / 7000);
  });

  it("ranks sellers; worst sellers include unsold dishes but not archived ones", () => {
    expect(report.sellers.byUnits.best.map((i) => i.id)).toEqual(["cafe", "flan", "viejo"]);
    expect(report.sellers.byUnits.worst.map((i) => i.id)).toEqual(["malta", "flan", "cafe"]);
  });

  it("rates add-ons only on dishes that offer them", () => {
    expect(report.modifierRate).toEqual([
      { id: "cafe", nameEs: "cafe", nameEn: "cafe", units: 40, rate: 0.25 },
    ]);
  });

  it("drops zero-length sold-out blips and totals the estimate", () => {
    expect(report.soldOut.map((s) => s.id)).toEqual(["flan"]);
    expect(report.lostRevenue).toBe(600);
  });

  it("measures QR adoption and menu language on QR orders", () => {
    expect(report.qr).toEqual({ orderShare: 0.75, paymentShare: 0.75, qrOrders: 3, orders: 4 });
    expect(report.language).toEqual({ es: 2, en: 1, enShare: 1 / 3 });
  });

  it("returns nulls rather than dividing by zero on an empty range", () => {
    const empty = shapeReport(
      { ...raw, heat: [], daily: [], tables: [], methods: [], items: [], soldOut: [], sources: [] },
      "2026-10-05",
      "2026-10-05",
    );
    expect(empty.averageCheck).toEqual({ perTable: null, perGuest: null });
    expect(empty.tipPct).toBeNull();
    expect(empty.qr.orderShare).toBeNull();
    expect(empty.heatHours).toEqual([]);
  });
});
