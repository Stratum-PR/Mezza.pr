/**
 * Generates 90 days of Café Lucía history as plain rows (no I/O), so it can be unit-tested.
 * Café hours with breakfast and lunch peaks and a weekend lift; parties of 1–4; card 45% /
 * ATH Móvil 20% / cash 35%; tips 15–20% on card and ATH; a few voids, refunds, English orders and
 * sold-out intervals. Deterministic for a given seed.
 */
import { randomUUID } from "node:crypto";
import { computeIvu, tipFromPercent, type IvuRates } from "../../src/lib/money";

export interface HistoryItem {
  id: string;
  nameEs: string;
  nameEn: string;
  priceCents: number;
  section: "cafe" | "desayuno" | "sand" | "dulce" | "beb";
  groups: {
    id: string;
    min: number;
    max: number;
    options: {
      id: string;
      nameEs: string;
      nameEn: string;
      priceCents: number;
      groupEs: string;
      groupEn: string;
    }[];
  }[];
}

export interface HistoryInput {
  restaurantId: string;
  tableIds: string[];
  items: HistoryItem[];
  rates: IvuRates;
  staffUserIds: { manager: string; server: string };
  days: number;
  now: Date;
  /** Hours east of UTC are negative: Puerto Rico is UTC−4 all year. */
  utcOffsetHours: number;
  seed: number;
  firstOrderNumber: number;
  /** Share of a busy café's traffic (1 = full; the cloud demo uses less to stay small). */
  volume?: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Parties per hour on a weekday, 7:00–15:00 local.
const HOURLY: Record<number, number> = { 7: 2, 8: 4.5, 9: 4, 10: 2.5, 11: 3, 12: 5, 13: 4, 14: 2 };
const SECTION_WEIGHTS: Record<"breakfast" | "lunch", Record<HistoryItem["section"], number>> = {
  breakfast: { cafe: 5, desayuno: 4, sand: 0.6, dulce: 2.5, beb: 1.2 },
  lunch: { cafe: 2, desayuno: 0.6, sand: 4.5, dulce: 1.5, beb: 3 },
};

export function generateHistory(input: HistoryInput) {
  const rnd = mulberry32(input.seed);
  const pickWeighted = <T>(entries: [T, number][]): T => {
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = rnd() * total;
    for (const [v, w] of entries) if ((r -= w) <= 0) return v;
    return entries[entries.length - 1]![0];
  };
  const poisson = (mean: number) => {
    let k = 0;
    let p = Math.exp(-mean);
    let s = p;
    const u = rnd();
    while (u > s && k < 50) {
      k++;
      p *= mean / k;
      s += p;
    }
    return k;
  };

  const tabs: Record<string, unknown>[] = [];
  const orders: Record<string, unknown>[] = [];
  const orderItems: Record<string, unknown>[] = [];
  const payments: Record<string, unknown>[] = [];
  const refunds: Record<string, unknown>[] = [];
  const availability: Record<string, unknown>[] = [];
  const audit: Record<string, unknown>[] = [];
  let number = input.firstOrderNumber;

  const offsetMs = input.utcOffsetHours * 3600_000;
  const localNow = new Date(input.now.getTime() + offsetMs); // wall-clock fields via getUTC*
  const startLocal =
    Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()) -
    (input.days - 1) * 86_400_000;
  const toUtc = (localMs: number) => new Date(localMs - offsetMs);

  for (let d = 0; d < input.days; d++) {
    const dayStart = startLocal + d * 86_400_000;
    const weekday = new Date(dayStart).getUTCDay();
    const weekend = weekday === 0 || weekday === 6;

    // A few sold-out intervals: some days a dish runs out mid-afternoon.
    const soldOut = new Map<string, [number, number]>();
    if (rnd() < 0.12) {
      const item = input.items[Math.floor(rnd() * input.items.length)]!;
      const from = dayStart + (11 + Math.floor(rnd() * 3)) * 3600_000;
      const to = Math.min(from + (1 + Math.floor(rnd() * 3)) * 3600_000, dayStart + 15 * 3600_000);
      soldOut.set(item.id, [from, to]);
      if (toUtc(from) < input.now) {
        availability.push({
          restaurant_id: input.restaurantId,
          item_id: item.id,
          sold_out_at: toUtc(from).toISOString(),
          back_at: toUtc(to) < input.now ? toUtc(to).toISOString() : null,
        });
      }
    }

    for (const [hourStr, base] of Object.entries(HOURLY)) {
      const hour = Number(hourStr);
      const parties = poisson(base * (input.volume ?? 1) * (weekend ? 1.35 : 1) * (0.85 + rnd() * 0.3));
      for (let p = 0; p < parties; p++) {
        const openedLocal = dayStart + hour * 3600_000 + Math.floor(rnd() * 3600_000);
        const opened = toUtc(openedLocal);
        if (opened > input.now) continue;
        const partySize = pickWeighted<number>([
          [1, 3],
          [2, 4],
          [3, 2],
          [4, 1.5],
        ]);
        const tabId = randomUUID();
        const tableId = input.tableIds[Math.floor(rnd() * input.tableIds.length)]!;
        const lang = rnd() < 0.15 ? "en" : "es";
        const meal = hour < 11 ? "breakfast" : "lunch";
        const available = input.items.filter((i) => {
          const s = soldOut.get(i.id);
          return !s || openedLocal < s[0] || openedLocal >= s[1];
        });

        let subtotal = 0;
        const orderCount = rnd() < 0.2 ? 2 : 1;
        for (let o = 0; o < orderCount; o++) {
          const orderId = randomUUID();
          const created = new Date(opened.getTime() + o * (15 + rnd() * 20) * 60_000);
          const lines = o === 0 ? partySize + (rnd() < 0.4 ? 1 : 0) : 1 + Math.floor(rnd() * 2);
          let orderLive = 0;
          for (let l = 0; l < lines; l++) {
            const section = pickWeighted(
              Object.entries(SECTION_WEIGHTS[meal]) as [HistoryItem["section"], number][],
            );
            const pool = available.filter((i) => i.section === section);
            const item = (pool.length ? pool : available)[
              Math.floor(rnd() * (pool.length || available.length))
            ]!;
            const chosen = item.groups.flatMap((g) => {
              const want = g.min > 0 ? 1 : rnd() < 0.35 ? 1 : 0;
              if (!want) return [];
              // Mostly the first option; sometimes an add-on.
              return [rnd() < 0.7 ? g.options[0]! : g.options[Math.floor(rnd() * g.options.length)]!];
            });
            const unit = item.priceCents + chosen.reduce((s, c) => s + c.priceCents, 0);
            const qty = rnd() < 0.12 ? 2 : 1;
            const voided = rnd() < 0.01;
            orderItems.push({
              restaurant_id: input.restaurantId,
              order_id: orderId,
              item_id: item.id,
              name_snapshot_es: item.nameEs,
              name_snapshot_en: item.nameEn,
              unit_price_cents: unit,
              qty,
              modifiers_snapshot: chosen.map((c) => ({
                option_id: c.id,
                name_es: c.nameEs,
                name_en: c.nameEn,
                group_es: c.groupEs,
                group_en: c.groupEn,
                price_cents: c.priceCents,
              })),
              status: voided ? "void" : "served",
              voided_at: voided ? created.toISOString() : null,
              voided_by: voided ? input.staffUserIds.manager : null,
              void_reason: voided ? "Error al tomar la orden" : null,
              created_at: created.toISOString(),
            });
            if (voided) {
              audit.push({
                restaurant_id: input.restaurantId,
                actor_id: input.staffUserIds.manager,
                action: "void",
                target_table: "order_items",
                target_id: null,
                before: { status: "served" },
                after: { status: "void", reason: "Error al tomar la orden" },
                created_at: created.toISOString(),
              });
            } else {
              orderLive += unit * qty;
            }
          }
          subtotal += orderLive;
          orders.push({
            id: orderId,
            restaurant_id: input.restaurantId,
            tab_id: tabId,
            number: number++,
            source: rnd() < 0.7 ? "qr" : "staff",
            idempotency_key: `seed-${orderId}`,
            status: orderLive > 0 ? "served" : "void",
            guest_language: lang,
            created_by: null,
            created_at: created.toISOString(),
          });
        }

        const paidAt = new Date(opened.getTime() + (25 + rnd() * 40) * 60_000);
        const closed = paidAt <= input.now && subtotal > 0;
        tabs.push({
          id: tabId,
          restaurant_id: input.restaurantId,
          table_id: tableId,
          status: "closed",
          party_size: partySize,
          opened_at: opened.toISOString(),
          closed_at: (closed ? paidAt : opened).toISOString(),
          pos_closed_at: closed ? new Date(paidAt.getTime() + 120_000).toISOString() : null,
          pos_closed_by: closed ? input.staffUserIds.server : null,
        });
        if (!closed) continue;

        const method = pickWeighted<"card" | "ath" | "cash">([
          ["card", 45],
          ["ath", 20],
          ["cash", 35],
        ]);
        const tipPercent =
          method === "cash" ? (rnd() < 0.5 ? 0 : 10 + Math.floor(rnd() * 6)) : 15 + Math.floor(rnd() * 6);
        const ivu = computeIvu(subtotal, input.rates);
        const paymentId = randomUUID();
        const tip = tipFromPercent(subtotal, tipPercent);
        const refunded = rnd() < 0.005;
        payments.push({
          id: paymentId,
          restaurant_id: input.restaurantId,
          tab_id: tabId,
          method,
          amount_cents: subtotal,
          tip_cents: tip,
          ivu_state_cents: ivu.state,
          ivu_municipal_cents: ivu.municipal,
          status: refunded ? "partially_refunded" : "paid",
          provider_ref: method === "cash" ? null : `mock_${paymentId.slice(0, 8)}`,
          idempotency_key: `seed-${paymentId}`,
          paid_at: paidAt.toISOString(),
          confirmed_by: method === "cash" ? input.staffUserIds.server : null,
          created_at: paidAt.toISOString(),
        });
        if (refunded) {
          const amount = Math.min(subtotal, 250 + Math.floor(rnd() * 400));
          refunds.push({
            restaurant_id: input.restaurantId,
            payment_id: paymentId,
            amount_cents: amount,
            reason: "Plato frío, se devolvió el importe",
            approved_by: input.staffUserIds.manager,
            created_at: new Date(paidAt.getTime() + 300_000).toISOString(),
          });
          audit.push({
            restaurant_id: input.restaurantId,
            actor_id: input.staffUserIds.manager,
            action: "refund",
            target_table: "payments",
            target_id: paymentId,
            before: { status: "paid" },
            after: { amount_cents: amount },
            created_at: new Date(paidAt.getTime() + 300_000).toISOString(),
          });
        }
      }
    }
  }

  return { tabs, orders, orderItems, payments, refunds, availability, audit, nextOrderNumber: number };
}
