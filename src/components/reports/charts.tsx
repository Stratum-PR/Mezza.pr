"use client";

import { Fragment, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { centsCompact, type Locale } from "@/lib/reports/format";
import { Legend, Swatch } from "./chart-card";

export interface Series {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}

const axisTick = { fill: "var(--muted)", fontSize: 12 };

function TipBox({
  active,
  payload,
  label,
  series,
  locale,
}: TooltipContentProps<number, string> & { series: Series[]; locale: Locale }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-lift">
      <p className="mb-1 font-bold">{label}</p>
      {series.map((s) => {
        const v = payload.find((p) => p.dataKey === s.key)?.value;
        if (v === undefined || v === null) return null;
        return (
          <p key={s.key} className="flex items-center gap-2 text-ink-2">
            <Swatch color={s.color} dashed={s.dashed} />
            <span>{s.label}</span>
            <b className="tabular ml-auto pl-3 text-ink">{formatCents(Number(v), locale)}</b>
          </p>
        );
      })}
    </div>
  );
}

/** Money over time: one solid series and an optional dashed reference (last week). */
export function TrendChart({
  data,
  xKey,
  series,
  locale,
  height = 260,
  ariaLabel,
}: {
  data: Record<string, string | number | null>[];
  xKey: string;
  series: Series[];
  locale: Locale;
  height?: number;
  ariaLabel: string;
}) {
  return (
    <figure aria-label={ariaLabel}>
      <Legend items={series} />
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 640, height }}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey={xKey}
            tick={axisTick}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            minTickGap={18}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v: number) => centsCompact(v, locale)}
          />
          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
            content={(p) => (
              <TipBox {...(p as TooltipContentProps<number, string>)} series={series} locale={locale} />
            )}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              type="monotone"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dashed ? "5 4" : undefined}
              dot={false}
              activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

/** Stacked monthly columns (IVU state + municipal), with a 2 px surface gap between segments. */
export function StackedColumns({
  data,
  xKey,
  series,
  locale,
  height = 240,
  ariaLabel,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  locale: Locale;
  height?: number;
  ariaLabel: string;
}) {
  return (
    <figure aria-label={ariaLabel}>
      <Legend items={series} />
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 480, height }}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v: number) => centsCompact(v, locale)}
          />
          <Tooltip
            cursor={{ fill: "var(--soft)" }}
            content={(p) => (
              <TipBox {...(p as TooltipContentProps<number, string>)} series={series} locale={locale} />
            )}
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="a"
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth={2}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={56}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

/**
 * Weekday × hour grid in one hue, light to dark (mixed toward the surface, so it works in both
 * themes). Every cell names its value on hover and focus.
 */
export function HeatGrid({
  rows,
  cols,
  value,
  rowLabel,
  colLabel,
  format,
  ariaLabel,
  lowLabel,
  highLabel,
}: {
  rows: number[];
  cols: number[];
  value: (row: number, col: number) => number;
  rowLabel: (row: number) => string;
  colLabel: (col: number) => string;
  format: (v: number) => string;
  ariaLabel: string;
  lowLabel: string;
  highLabel: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => cols.map((c) => value(r, c))));
  return (
    <figure aria-label={ariaLabel} className="overflow-x-auto">
      <div
        className="grid min-w-[520px] gap-[2px] text-xs"
        style={{ gridTemplateColumns: `44px repeat(${cols.length}, minmax(22px, 1fr))` }}
      >
        <span />
        {cols.map((c, i) => (
          <span key={c} className="pb-1 text-center text-muted">
            {i % 2 === 0 ? colLabel(c) : ""}
          </span>
        ))}
        {rows.map((r) => (
          <Fragment key={r}>
            <span className="flex items-center font-semibold text-ink-2">{rowLabel(r)}</span>
            {cols.map((c) => {
              const v = value(r, c);
              const level = v > 0 ? 12 + Math.round((v / max) * 88) : 0;
              const tip = `${rowLabel(r)} ${colLabel(c)}: ${format(v)}`;
              return (
                <span
                  key={c}
                  title={tip}
                  aria-label={tip}
                  tabIndex={0}
                  className="h-7 rounded-[4px] outline-offset-1 focus-visible:outline-2 focus-visible:outline-accent"
                  style={{
                    background:
                      level === 0
                        ? "var(--line-2)"
                        : `color-mix(in oklab, var(--chart-1) ${level}%, var(--surface))`,
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <figcaption className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span>{lowLabel}</span>
        <span
          aria-hidden
          className="h-2.5 w-28 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in oklab, var(--chart-1) 12%, var(--surface)), var(--chart-1))",
          }}
        />
        <span>{highLabel}</span>
      </figcaption>
    </figure>
  );
}

/** One 100% bar split into parts, each named below with its value and share. */
export function ShareBar({
  parts,
  ariaLabel,
}: {
  parts: { key: string; label: string; color: string; value: string; share: number | null }[];
  ariaLabel: string;
}) {
  const shown = parts.filter((p) => (p.share ?? 0) > 0);
  return (
    <figure aria-label={ariaLabel}>
      <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-[6px] bg-line-2">
        {shown.map((p) => (
          <span key={p.key} style={{ width: `${(p.share ?? 0) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {parts.map((p) => (
          <li key={p.key} className="flex items-baseline gap-2">
            <span className="translate-y-px">
              <Swatch color={p.color} />
            </span>
            <span className="text-sm text-ink-2">{p.label}</span>
            <b className="tabular ml-auto text-sm sm:ml-0">{p.value}</b>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Ranked horizontal bars with the label above and the value at the end (direct labels). */
export function BarList({
  items,
  color = "var(--chart-1)",
  ariaLabel,
  className,
}: {
  items: { key: string; label: string; value: number; display: string; sub?: string }[];
  color?: string;
  ariaLabel: string;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-label={ariaLabel} className={cn("grid gap-2.5", className)}>
      {items.map((i) => (
        <li key={i.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{i.label}</span>
            <span className="tabular shrink-0 text-ink-2">
              <b className="text-ink">{i.display}</b>
              {i.sub && <span className="text-muted"> · {i.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-line-2">
            <div
              className="h-2 rounded-full"
              style={{ width: `${Math.max(i.value > 0 ? 2 : 0, (i.value / max) * 100)}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A headline number tile. `hero` gets the screen's one gradient. */
export function Stat({
  label,
  value,
  sub,
  hero,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  hero?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-card border p-4",
        hero ? "border-transparent text-white" : "border-line bg-surface",
        className,
      )}
      style={hero ? { background: "var(--gradient)" } : undefined}
    >
      <p className={cn("text-sm font-semibold", hero ? "text-white/80" : "text-muted")}>{label}</p>
      <p className="tabular mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">{value}</p>
      {sub && <div className={cn("mt-1 text-sm", hero ? "text-white/85" : "text-ink-2")}>{sub}</div>}
    </div>
  );
}
