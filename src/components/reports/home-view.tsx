"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/components/ui/button";
import { Pill } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { dayLabel, hourLabel, pct, timeLabel, weekdayLong, type Locale } from "@/lib/reports/format";
import type { Today } from "@/lib/reports/today";
import { ShareBar, Stat, TrendChart } from "./charts";

const METHOD_COLOR = {
  card: "var(--chart-card)",
  ath: "var(--chart-ath)",
  cash: "var(--chart-cash)",
} as const;

export function HomeView({ today, slug, locale }: { today: Today; slug: string; locale: Locale }) {
  const t = useTranslations("home");
  const tm = useTranslations("staff.methods");
  const money = (c: number) => formatCents(c, locale);
  const weekday = weekdayLong(today.lastWeek.date, locale);

  const change = today.lastWeek.soFar > 0 ? today.sales / today.lastWeek.soFar - 1 : null;
  const paid = today.byMethod.reduce((n, m) => n + m.amount, 0);
  const { alerts } = today;
  const alertCount =
    alerts.requests.length + alerts.cash.length + alerts.pos.length + alerts.printerFailures.length;
  const service = `/app/${slug}/servicio`;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          hero
          className="col-span-2"
          label={t("sales")}
          value={money(today.sales)}
          sub={
            change === null
              ? t("noComparison", { day: weekday })
              : t(change >= 0 ? "up" : "down", { pct: pct(Math.abs(change), locale), day: weekday })
          }
        />
        <Stat
          label={t("openTables")}
          value={`${today.openTables}`}
          sub={
            <Link
              href={`/app/${slug}/mesas`}
              className="font-bold text-accent underline-offset-2 hover:underline"
            >
              {t("openSub", { total: today.tables })}
            </Link>
          }
        />
        <Stat
          label={t("tips")}
          value={money(today.tips)}
          sub={t("refunds", { amount: money(today.refunds) })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
        <section className="min-w-0 rounded-card border border-line bg-surface p-5">
          <h2 className="text-lg font-extrabold">{t("chartTitle", { day: weekday })}</h2>
          <p className="mb-3 text-sm text-muted">
            {t("chartNote", {
              amount: money(today.lastWeek.fullDay),
              date: dayLabel(today.lastWeek.date, locale),
            })}
          </p>
          {today.hourly.length > 1 ? (
            <TrendChart
              ariaLabel={t("chartTitle", { day: weekday })}
              locale={locale}
              height={220}
              xKey="hour"
              data={today.hourly.map((h) => ({ ...h, hour: hourLabel(h.hour, locale) }))}
              series={[
                { key: "today", label: t("today"), color: "var(--chart-1)" },
                {
                  key: "lastWeek",
                  label: t("lastWeek", { day: weekday }),
                  color: "var(--chart-ref)",
                  dashed: true,
                },
              ]}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted">{t("noSalesYet")}</p>
          )}
        </section>

        <section className="rounded-card border border-line bg-surface p-5" aria-labelledby="alerts-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="alerts-title" className="text-lg font-extrabold">
              {t("alerts.title")}
            </h2>
            {alertCount > 0 && <Pill tone="bad">{alertCount}</Pill>}
          </div>
          {alertCount === 0 ? (
            <p className="text-sm text-muted">{t("alerts.none")}</p>
          ) : (
            <ul className="grid gap-2">
              {alerts.requests.map((r) => (
                <Alert key={r.id} href={service} tone="warn">
                  {t(r.kind === "bring_check" ? "alerts.check" : "alerts.call", { label: r.tableLabel })}
                </Alert>
              ))}
              {alerts.cash.map((c) => (
                <Alert key={c.id} href={service} tone="warn">
                  {t("alerts.cash", { label: c.tableLabel, amount: money(c.totalCents) })}
                </Alert>
              ))}
              {alerts.pos.map((p) => (
                <Alert key={p.tabId} href={service} tone="navy">
                  {t("alerts.pos", { label: p.tableLabel, amount: money(p.posTotalCents) })}
                </Alert>
              ))}
              {alerts.printerFailures.map((f) => (
                <Alert key={f.id} href={`/app/${slug}/cocina`} tone="bad">
                  {t("alerts.printer", {
                    kind: t(f.kind === "receipt" ? "alerts.receipt" : "alerts.kitchen"),
                    time: timeLabel(f.createdAt, locale, today.timeZone),
                  })}
                </Alert>
              ))}
            </ul>
          )}
          <Link href={service} className={cn(buttonClass({ variant: "soft", size: "sm" }), "mt-4")}>
            {t("alerts.go")}
          </Link>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-1 text-lg font-extrabold">{t("methods")}</h2>
          <p className="mb-3 text-sm text-muted">{t("paymentsCount", { n: today.payments })}</p>
          <ShareBar
            ariaLabel={t("methods")}
            parts={today.byMethod.map((m) => ({
              key: m.method,
              label: tm(m.method),
              color: METHOD_COLOR[m.method],
              share: paid ? m.amount / paid : null,
              value: money(m.amount),
            }))}
          />
        </section>
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-3 text-lg font-extrabold">{t("ivu")}</h2>
          <dl className="grid grid-cols-3 gap-3">
            <div>
              <dt className="text-sm text-muted">{t("ivuState")}</dt>
              <dd className="tabular text-xl font-extrabold">{money(today.ivuState)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{t("ivuMunicipal")}</dt>
              <dd className="tabular text-xl font-extrabold">{money(today.ivuMunicipal)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">{t("ivuTotal")}</dt>
              <dd className="tabular text-xl font-extrabold">{money(today.ivuState + today.ivuMunicipal)}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/app/${slug}/reportes`} className={buttonClass({ variant: "soft", size: "sm" })}>
              {t("reportsLink")}
            </Link>
            <Link href={`/app/${slug}/exportar`} className={buttonClass({ variant: "ghost", size: "sm" })}>
              {t("exportLink")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Alert({
  href,
  tone,
  children,
}: {
  href: string;
  tone: "warn" | "bad" | "navy";
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2 rounded-lg border-l-4 bg-soft px-3 py-2 text-sm font-semibold hover:bg-line-2",
          tone === "warn" && "border-warn",
          tone === "bad" && "border-bad",
          tone === "navy" && "border-accent",
        )}
      >
        {children}
      </Link>
    </li>
  );
}
