"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/controls";
import { formatCents } from "@/lib/money";
import {
  centsWhole,
  count,
  dayLabel,
  hourLabel,
  monthLabel,
  pct,
  weekdayShort,
  type Locale,
} from "@/lib/reports/format";
import type { Report } from "@/lib/reports/summary";
import { ChartCard } from "./chart-card";
import { BarList, HeatGrid, ShareBar, StackedColumns, Stat, TrendChart } from "./charts";

const METHOD_COLOR = {
  card: "var(--chart-card)",
  ath: "var(--chart-ath)",
  cash: "var(--chart-cash)",
} as const;

/** Voids and write-offs in the period (period_adjustments): never sales; write-offs aren't collected money. */
export interface Adjustments {
  voidsCents: number;
  voidsCount: number;
  writeOffsCents: number;
  writeOffsCount: number;
}

export function ReportsView({
  report,
  locale,
  adjustments,
}: {
  report: Report;
  locale: Locale;
  adjustments?: Adjustments;
}) {
  const t = useTranslations("reports");
  const tm = useTranslations("staff.methods");
  const money = (c: number) => formatCents(c, locale);
  const name = (i: { nameEs: string; nameEn: string }) => (locale === "en" ? i.nameEn : i.nameEs);
  const [rankBy, setRankBy] = useState<"byUnits" | "byRevenue">("byUnits");
  const { totals } = report;

  // 1. Heat map
  const heatValue = new Map(report.heat.map((h) => [`${h.dow}:${h.hour}`, h.avg]));
  const dows = [1, 2, 3, 4, 5, 6, 7];

  // 2. Daily
  const daily = report.daily.map((d) => ({
    day: dayLabel(d.date, locale),
    sales: d.sales,
    lastWeek: d.lastWeek,
  }));

  // 6. Sellers
  const ranked = report.sellers[rankBy];
  const sellerValue = (i: Report["sellers"]["byUnits"]["best"][number]) =>
    rankBy === "byUnits" ? i.units : i.revenue;
  const sellerDisplay = (i: Report["sellers"]["byUnits"]["best"][number]) =>
    rankBy === "byUnits" ? t("sellers.unitsValue", { n: i.units }) : money(i.revenue);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat hero label={t("kpi.sales")} value={centsWhole(totals.sales, locale)} sub={t("kpi.salesNote")} />
        <Stat
          label={t("kpi.orders")}
          value={count(totals.orders, locale)}
          sub={t("kpi.covers", { n: count(totals.covers, locale) })}
        />
        <Stat
          label={t("kpi.perTable")}
          value={report.averageCheck.perTable === null ? "—" : money(report.averageCheck.perTable)}
          sub={
            report.averageCheck.perGuest === null
              ? undefined
              : t("kpi.perGuest", { amount: money(report.averageCheck.perGuest) })
          }
        />
        <Stat
          label={t("kpi.tip")}
          value={pct(report.tipPct, locale, 1)}
          sub={t("kpi.refunds", { amount: money(totals.refunds) })}
        />
      </div>

      {adjustments && (
        <section
          aria-labelledby="adjustments-title"
          className="mb-4 rounded-card border border-line bg-surface p-4 text-sm"
        >
          <h2 id="adjustments-title" className="mb-1.5 font-extrabold">
            {t("adjustments.title")}
          </h2>
          <ul className="tabular flex flex-wrap gap-x-6 gap-y-1">
            <li>
              {t("adjustments.voids", {
                count: adjustments.voidsCount,
                amount: money(adjustments.voidsCents),
              })}
            </li>
            <li>
              {t("adjustments.writeOffs", {
                count: adjustments.writeOffsCount,
                amount: money(adjustments.writeOffsCents),
              })}
            </li>
            <li>{t("adjustments.refunds", { amount: money(totals.refunds) })}</li>
          </ul>
          <p className="mt-1.5 text-xs text-muted">{t("adjustments.note")}</p>
        </section>
      )}

      {/* 1 */}
      <ChartCard
        title={t("heat.title")}
        note={t("heat.note")}
        table={{
          head: [t("heat.day"), ...report.heatHours.map((h) => hourLabel(h, locale))],
          rows: dows.map((d) => [
            weekdayShort(d, locale),
            ...report.heatHours.map((h) => money(heatValue.get(`${d}:${h}`) ?? 0)),
          ]),
        }}
      >
        {report.heatHours.length ? (
          <HeatGrid
            rows={dows}
            cols={report.heatHours}
            value={(d, h) => heatValue.get(`${d}:${h}`) ?? 0}
            rowLabel={(d) => weekdayShort(d, locale)}
            colLabel={(h) => hourLabel(h, locale)}
            format={money}
            ariaLabel={t("heat.title")}
            lowLabel={t("heat.low")}
            highLabel={t("heat.high")}
          />
        ) : (
          <Empty />
        )}
      </ChartCard>

      {/* 2 */}
      <ChartCard
        title={t("daily.title")}
        note={t("daily.note")}
        table={{
          head: [t("daily.date"), t("daily.current"), t("daily.lastWeek")],
          rows: report.daily.map((d) => [dayLabel(d.date, locale, true), money(d.sales), money(d.lastWeek)]),
        }}
      >
        <TrendChart
          data={daily}
          xKey="day"
          locale={locale}
          ariaLabel={t("daily.title")}
          series={[
            { key: "sales", label: t("daily.current"), color: "var(--chart-1)" },
            { key: "lastWeek", label: t("daily.lastWeek"), color: "var(--chart-ref)", dashed: true },
          ]}
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 3 */}
        <ChartCard
          title={t("tables.title")}
          note={t("tables.note")}
          table={{
            head: [
              t("tables.table"),
              t("tables.tabs"),
              t("tables.covers"),
              t("tables.sales"),
              t("tables.perTable"),
              t("tables.perGuest"),
            ],
            rows: report.tables.map((r) => [
              r.label,
              count(r.tabs, locale),
              count(r.covers, locale),
              money(r.sales),
              money(r.perTable),
              money(r.perGuest),
            ]),
          }}
        >
          {report.tables.length ? (
            <BarList
              ariaLabel={t("tables.title")}
              items={report.tables.map((r) => ({
                key: r.label,
                label: t("tables.label", { label: r.label }),
                value: r.perTable,
                display: money(r.perTable),
                sub: t("tables.sub", { covers: r.covers, perGuest: money(r.perGuest) }),
              }))}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>

        {/* 4 */}
        <ChartCard
          title={t("mix.title")}
          note={t("mix.tipNote", { pct: pct(report.tipPct, locale, 1) })}
          table={{
            head: [t("mix.method"), t("mix.amount"), t("mix.count"), t("mix.share"), t("mix.tip")],
            rows: report.mix.map((m) => [
              tm(m.method),
              money(m.amount),
              count(m.count, locale),
              pct(m.share, locale, 1),
              pct(m.tipPct, locale, 1),
            ]),
          }}
        >
          <ShareBar
            ariaLabel={t("mix.title")}
            parts={report.mix.map((m) => ({
              key: m.method,
              label: tm(m.method),
              color: METHOD_COLOR[m.method],
              share: m.share,
              value: pct(m.share, locale),
            }))}
          />
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line-2 pt-3 text-sm">
            {report.mix.map((m) => (
              <div key={m.method}>
                <dt className="text-muted">{tm(m.method)}</dt>
                <dd className="tabular font-bold">{money(m.amount)}</dd>
                <dd className="text-muted">
                  {m.tipPct === null ? t("mix.noTip") : t("mix.tipValue", { pct: pct(m.tipPct, locale, 1) })}
                </dd>
              </div>
            ))}
          </dl>
        </ChartCard>

        {/* 5 */}
        <ChartCard
          title={t("ivu.title")}
          note={t("ivu.note")}
          table={{
            head: [t("ivu.month"), t("ivu.taxable"), t("ivu.state"), t("ivu.municipal"), t("ivu.total")],
            rows: report.ivuMonthly.map((m) => [
              monthLabel(m.month, locale),
              money(m.sales),
              money(m.state),
              money(m.municipal),
              money(m.state + m.municipal),
            ]),
          }}
        >
          {report.ivuMonthly.length ? (
            <StackedColumns
              ariaLabel={t("ivu.title")}
              locale={locale}
              xKey="month"
              data={report.ivuMonthly.map((m) => ({
                month: monthLabel(m.month, locale, true),
                state: m.state,
                municipal: m.municipal,
              }))}
              series={[
                { key: "state", label: t("ivu.state"), color: "var(--chart-state)" },
                { key: "municipal", label: t("ivu.municipal"), color: "var(--chart-municipal)" },
              ]}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>

        {/* 6 */}
        <ChartCard
          title={t("sellers.title")}
          actions={
            <Segmented
              label={t("sellers.rankBy")}
              value={rankBy}
              onChange={setRankBy}
              options={[
                { value: "byUnits", label: t("sellers.byUnits") },
                { value: "byRevenue", label: t("sellers.byRevenue") },
              ]}
            />
          }
          table={{
            head: [t("sellers.list"), t("sellers.dish"), t("sellers.units"), t("sellers.revenue")],
            rows: [
              ...ranked.best.map((i) => [
                t("sellers.best"),
                name(i),
                count(i.units, locale),
                money(i.revenue),
              ]),
              ...ranked.worst.map((i) => [
                t("sellers.worst"),
                name(i),
                count(i.units, locale),
                money(i.revenue),
              ]),
            ],
            numeric: [2, 3],
          }}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-bold text-ink-2">{t("sellers.best")}</h3>
              <BarList
                ariaLabel={t("sellers.best")}
                items={ranked.best.map((i) => ({
                  key: i.id,
                  label: name(i),
                  value: sellerValue(i),
                  display: sellerDisplay(i),
                }))}
              />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-bold text-ink-2">{t("sellers.worst")}</h3>
              <BarList
                ariaLabel={t("sellers.worst")}
                color="var(--chart-ref)"
                items={ranked.worst.map((i) => ({
                  key: i.id,
                  label: name(i),
                  value: sellerValue(i),
                  display: sellerDisplay(i),
                }))}
              />
            </div>
          </div>
        </ChartCard>

        {/* 7 */}
        <ChartCard
          title={t("modifiers.title")}
          note={t("modifiers.note")}
          table={{
            head: [t("modifiers.dish"), t("modifiers.units"), t("modifiers.rate")],
            rows: report.modifierRate.map((m) => [name(m), count(m.units, locale), pct(m.rate, locale)]),
          }}
        >
          {report.modifierRate.length ? (
            <BarList
              ariaLabel={t("modifiers.title")}
              items={report.modifierRate.map((m) => ({
                key: m.id,
                label: name(m),
                value: m.rate,
                display: pct(m.rate, locale),
                sub: t("sellers.unitsValue", { n: m.units }),
              }))}
            />
          ) : (
            <Empty />
          )}
        </ChartCard>

        {/* 8 */}
        <ChartCard
          title={t("soldOut.title")}
          note={t("soldOut.note")}
          table={{
            head: [
              t("soldOut.dish"),
              t("soldOut.times"),
              t("soldOut.hours"),
              t("soldOut.lostUnits"),
              t("soldOut.lostRevenue"),
            ],
            rows: report.soldOut.map((s) => [
              name(s),
              count(s.events, locale),
              count(s.hours, locale, 1),
              count(s.lostUnits, locale, 1),
              money(s.lostRevenue),
            ]),
          }}
        >
          {report.soldOut.length ? (
            <>
              <p className="mb-3 text-sm">
                {t.rich("soldOut.total", {
                  amount: money(report.lostRevenue),
                  b: (c) => <b className="tabular">{c}</b>,
                })}
              </p>
              <BarList
                ariaLabel={t("soldOut.title")}
                items={report.soldOut.map((s) => ({
                  key: s.id,
                  label: name(s),
                  value: s.lostRevenue,
                  display: t("soldOut.lostValue", { amount: money(s.lostRevenue) }),
                  sub: t("soldOut.hoursValue", { n: count(s.hours, locale, 1) }),
                }))}
              />
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted">{t("soldOut.none")}</p>
          )}
        </ChartCard>

        {/* 9 */}
        <ChartCard
          title={t("qr.title")}
          note={t("qr.note")}
          table={{
            head: [t("qr.metric"), t("qr.value")],
            rows: [
              [t("qr.orders"), pct(report.qr.orderShare, locale)],
              [t("qr.payments"), pct(report.qr.paymentShare, locale)],
            ],
          }}
        >
          <div className="grid gap-4">
            <ShareRow
              label={t("qr.orders")}
              value={report.qr.orderShare}
              locale={locale}
              sub={t("qr.ordersSub", { qr: report.qr.qrOrders, total: report.qr.orders })}
            />
            <ShareRow label={t("qr.payments")} value={report.qr.paymentShare} locale={locale} />
          </div>
        </ChartCard>

        {/* 10 */}
        <ChartCard
          title={t("language.title")}
          note={t("language.note")}
          table={{
            head: [t("language.language"), t("language.orders"), t("language.share")],
            rows: [
              [
                t("language.es"),
                count(report.language.es, locale),
                pct(report.language.enShare === null ? null : 1 - report.language.enShare, locale),
              ],
              [t("language.en"), count(report.language.en, locale), pct(report.language.enShare, locale)],
            ],
          }}
        >
          <ShareBar
            ariaLabel={t("language.title")}
            parts={[
              {
                key: "es",
                label: t("language.es"),
                color: "var(--chart-1)",
                share: report.language.enShare === null ? null : 1 - report.language.enShare,
                value: count(report.language.es, locale),
              },
              {
                key: "en",
                label: t("language.en"),
                color: "var(--chart-municipal)",
                share: report.language.enShare,
                value: count(report.language.en, locale),
              },
            ]}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function ShareRow({
  label,
  value,
  sub,
  locale,
}: {
  label: string;
  value: number | null;
  sub?: string;
  locale: Locale;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink-2">{label}</span>
        <b className="tabular text-2xl font-extrabold">{pct(value, locale)}</b>
      </div>
      <div className="h-2 rounded-full bg-line-2">
        <div className="h-2 rounded-full bg-[var(--chart-1)]" style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  );
}

function Empty() {
  const t = useTranslations("reports");
  return <p className="py-6 text-center text-sm text-muted">{t("empty")}</p>;
}
