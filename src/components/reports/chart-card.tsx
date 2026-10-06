"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export interface TableView {
  head: string[];
  rows: ReactNode[][];
  /** Columns to right-align (numbers). Defaults to every column after the first. */
  numeric?: number[];
}

/**
 * One report card: title, an optional note, and the chart, with a plain-table view of the same
 * numbers one tap away (for screen readers, colorblind readers and copying into a spreadsheet).
 */
export function ChartCard({
  title,
  note,
  table,
  children,
  className,
  actions,
}: {
  title: string;
  note?: ReactNode;
  table: TableView;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  const t = useTranslations("reports");
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={cn("min-w-0 rounded-card border border-line bg-surface p-5", className)}>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <div className="flex items-center gap-2">
          {actions}
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className="min-h-9 rounded-lg px-2.5 text-sm font-bold text-accent hover:bg-soft"
          >
            {asTable ? t("showChart") : t("showTable")}
          </button>
        </div>
      </div>
      {note && <p className="mb-3 text-sm text-muted">{note}</p>}
      <div className={cn(!note && "mt-3")}>
        {asTable ? <DataTable {...table} caption={title} /> : children}
      </div>
    </section>
  );
}

export function DataTable({ head, rows, numeric, caption }: TableView & { caption?: string }) {
  const t = useTranslations("reports");
  const isNum = (i: number) => (numeric ? numeric.includes(i) : i > 0);
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted">{t("empty")}</p>;
  return (
    <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 bg-soft">
          <tr>
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={cn("px-3 py-2 font-bold text-ink-2", isNum(i) ? "text-right" : "text-left")}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-line-2">
              {r.map((c, ci) => (
                <td key={ci} className={cn("px-3 py-1.5", isNum(ci) && "tabular text-right")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A colored square that names a series next to its label (identity never by color alone). */
export function Swatch({ color, dashed }: { color: string; dashed?: boolean }) {
  return dashed ? (
    <span
      aria-hidden
      className="inline-block h-0 w-4 border-t-2 border-dashed"
      style={{ borderColor: color }}
    />
  ) : (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-[3px]"
      style={{ background: color }}
    />
  );
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <Swatch color={i.color} dashed={i.dashed} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
