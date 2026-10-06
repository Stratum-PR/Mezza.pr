"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import type { FloorOrder } from "@/lib/staff/floor";
import { OrderFlags } from "./order-flags";

type Filter = "all" | "new" | "in_kitchen" | "ready" | "served";
const FILTERS: Filter[] = ["all", "new", "in_kitchen", "ready", "served"];

// Status colour always comes with its label (never colour alone).
const TONE: Record<Exclude<Filter, "all">, string> = {
  new: "border-l-warn",
  in_kitchen: "border-l-blue",
  ready: "border-l-ok",
  served: "border-l-line",
};
const PILL: Record<Exclude<Filter, "all">, string> = {
  new: "bg-warn-bg text-warn",
  in_kitchen: "bg-soft text-accent",
  ready: "bg-ok-bg text-ok",
  served: "bg-line-2 text-muted",
};

/** Today's orders at a glance: one card per order, filtered by status, newest first. */
export function OrderStrip({ orders, minutes }: { orders: FloorOrder[]; minutes: (iso: string) => number }) {
  const t = useTranslations("staff");
  const [filter, setFilter] = useState<Filter>("all");
  const live = orders.filter((o) => o.status !== "void");
  const count = (f: Filter) => (f === "all" ? live.length : live.filter((o) => o.status === f).length);
  const shown = live
    .filter((o) => filter === "all" || o.status === filter)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return (
    <section
      aria-labelledby="order-strip-title"
      className="min-w-0 rounded-card border border-line bg-surface p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="order-strip-title" className="text-lg font-extrabold">
          {t("strip.title")}
        </h2>
        <div role="tablist" aria-label={t("strip.filter")} className="flex gap-1 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-bold",
                filter === f ? "border-accent bg-accent text-accent-ink" : "border-line text-ink-2",
              )}
            >
              {t(`strip.${f}`)}
              <span className="tabular rounded-full bg-current/15 px-1.5 text-xs">{count(f)}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">{t("strip.empty")}</p>
      ) : (
        <ul className="flex gap-2.5 overflow-x-auto pb-1">
          {shown.map((o) => {
            const status = o.status as Exclude<Filter, "all">;
            const dishes = o.lines.filter((l) => !l.voided).reduce((n, l) => n + l.qty, 0);
            return (
              <li
                key={o.id}
                className={cn(
                  "min-w-[180px] rounded-xl border border-line border-l-4 bg-bg p-3",
                  TONE[status],
                )}
              >
                <p className="flex items-baseline justify-between gap-2 font-extrabold">
                  <span>{t("orderNumber", { number: o.number })}</span>
                  <span className="text-sm font-bold text-ink-2">{t("table", { label: o.tableLabel })}</span>
                </p>
                <p className="mt-1 text-sm text-ink-2">{t("strip.dishes", { n: dishes })}</p>
                <OrderFlags order={o} className="mt-1.5" />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted">{t("minutes", { n: minutes(o.createdAt) })}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", PILL[status])}>
                    {t(`strip.${status}`)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
