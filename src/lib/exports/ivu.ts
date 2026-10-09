/**
 * "Resumen de IVU para preparar la planilla en SURI": taxable sales, state and municipal IVU, and
 * refunds for one month, by day and in total. A working summary, never an official form.
 */
import { addDays, daysBetween, monthRange, type Ymd } from "@/lib/reports/time";
import { dollars, toCsv, type Cell } from "./csv";

interface IvuDay {
  date: Ymd;
  taxable: number;
  state: number;
  municipal: number;
  refunds: number;
}

export interface IvuSummary {
  restaurant: { name: string; address: string | null };
  month: string; // 2026-09
  rates: { stateBps: number; municipalBps: number };
  days: IvuDay[];
  totals: Omit<IvuDay, "date">;
  generatedAt: string;
}

/** Every day of the month (up to `today` for the current month), zeros included. */
export function buildIvuSummary(input: {
  restaurant: IvuSummary["restaurant"];
  month: string;
  rates: IvuSummary["rates"];
  sales: { date: Ymd; sales_cents: number; ivu_state_cents: number; ivu_municipal_cents: number }[];
  refunds: { date: Ymd; amount_cents: number }[];
  today: Ymd;
  generatedAt: string;
}): IvuSummary {
  const { from, to } = monthRange(input.month);
  const last = to > input.today ? input.today : to;
  const days: IvuDay[] = [];
  for (let i = 0; i <= daysBetween(from, last); i++) {
    const date = addDays(from, i);
    const s = input.sales.filter((r) => r.date === date);
    days.push({
      date,
      taxable: s.reduce((n, r) => n + r.sales_cents, 0),
      state: s.reduce((n, r) => n + r.ivu_state_cents, 0),
      municipal: s.reduce((n, r) => n + r.ivu_municipal_cents, 0),
      refunds: input.refunds.filter((r) => r.date === date).reduce((n, r) => n + r.amount_cents, 0),
    });
  }
  const totals = days.reduce(
    (t, d) => ({
      taxable: t.taxable + d.taxable,
      state: t.state + d.state,
      municipal: t.municipal + d.municipal,
      refunds: t.refunds + d.refunds,
    }),
    { taxable: 0, state: 0, municipal: 0, refunds: 0 },
  );
  return {
    restaurant: input.restaurant,
    month: input.month,
    rates: input.rates,
    days,
    totals,
    generatedAt: input.generatedAt,
  };
}

export interface IvuLabels {
  title: string;
  disclaimer: string;
  restaurant: string;
  period: string;
  periodValue: string;
  generated: string;
  generatedValue: string;
  date: string;
  taxable: string;
  state: string;
  municipal: string;
  totalIvu: string;
  refunds: string;
  total: string;
}

export function ivuCsv(s: IvuSummary, l: IvuLabels): string {
  const rows: Cell[][] = [
    [l.title],
    [l.disclaimer],
    [l.restaurant, s.restaurant.name],
    [l.period, l.periodValue],
    [l.generated, l.generatedValue],
    [],
    [l.date, l.taxable, l.state, l.municipal, l.totalIvu, l.refunds],
    ...s.days.map((d) => [
      d.date,
      dollars(d.taxable),
      dollars(d.state),
      dollars(d.municipal),
      dollars(d.state + d.municipal),
      dollars(d.refunds),
    ]),
    [
      l.total,
      dollars(s.totals.taxable),
      dollars(s.totals.state),
      dollars(s.totals.municipal),
      dollars(s.totals.state + s.totals.municipal),
      dollars(s.totals.refunds),
    ],
  ];
  return toCsv(rows);
}
