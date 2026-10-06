import { describe, expect, it } from "vitest";
import { generateHistory, type HistoryItem } from "./history";

const items: HistoryItem[] = [
  {
    id: "i-cafe",
    nameEs: "Café con leche",
    nameEn: "Café con leche",
    priceCents: 250,
    section: "cafe",
    groups: [],
  },
  { id: "i-mall", nameEs: "Mallorca", nameEn: "Mallorca", priceCents: 350, section: "desayuno", groups: [] },
  { id: "i-trip", nameEs: "Tripleta", nameEn: "Tripleta", priceCents: 900, section: "sand", groups: [] },
  { id: "i-ques", nameEs: "Quesito", nameEn: "Quesito", priceCents: 200, section: "dulce", groups: [] },
  { id: "i-malt", nameEs: "Malta", nameEn: "Malta", priceCents: 200, section: "beb", groups: [] },
];

const history = generateHistory({
  restaurantId: "r",
  tableIds: ["t1", "t2", "t3"],
  items,
  rates: { stateBps: 1050, municipalBps: 100 },
  staffUserIds: { manager: "m", server: "s" },
  days: 90,
  now: new Date("2026-10-05T16:00:00Z"),
  utcOffsetHours: -4,
  seed: 42,
  firstOrderNumber: 1001,
});

describe("generated history", () => {
  it("has a realistic volume", () => {
    expect(history.tabs.length).toBeGreaterThan(90 * 15);
    expect(history.tabs.length).toBeLessThan(90 * 60);
  });

  it("numbers orders consecutively from 1001", () => {
    const numbers = history.orders.map((o) => o.number as number);
    expect(numbers[0]).toBe(1001);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(history.nextOrderNumber).toBe(1001 + numbers.length);
  });

  it("uses roughly the card / ATH / cash mix", () => {
    const n = history.payments.length;
    const share = (m: string) => history.payments.filter((p) => p.method === m).length / n;
    expect(share("card")).toBeGreaterThan(0.38);
    expect(share("card")).toBeLessThan(0.52);
    expect(share("ath")).toBeGreaterThan(0.14);
    expect(share("cash")).toBeGreaterThan(0.28);
  });

  it("charges each tab its unvoided lines", () => {
    for (const payment of history.payments.slice(0, 200)) {
      const orderIds = new Set(history.orders.filter((o) => o.tab_id === payment.tab_id).map((o) => o.id));
      const live = history.orderItems
        .filter((l) => orderIds.has(l.order_id) && !l.voided_at)
        .reduce((s, l) => s + (l.unit_price_cents as number) * (l.qty as number), 0);
      expect(payment.amount_cents).toBe(live);
    }
  });

  it("includes voids, refunds, English orders and sold-out intervals", () => {
    expect(history.orderItems.some((l) => l.voided_at)).toBe(true);
    expect(history.refunds.length).toBeGreaterThan(0);
    expect(history.orders.some((o) => o.guest_language === "en")).toBe(true);
    expect(history.availability.length).toBeGreaterThan(0);
  });

  it("never invents the future", () => {
    expect(
      history.tabs.every((t) => new Date(t.opened_at as string) <= new Date("2026-10-05T16:00:00Z")),
    ).toBe(true);
  });
});
