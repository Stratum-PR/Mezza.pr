import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { dayLabel, type Locale } from "@/lib/reports/format";
import { PRESETS, type Range } from "@/lib/reports/range";
import { daysBetween } from "@/lib/reports/time";

/** Date range filter in one row above the charts: presets as links, plus a custom from/to form. */
export async function RangeBar({ base, range, locale }: { base: string; range: Range; locale: Locale }) {
  const t = await getTranslations("reports.range");
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <nav aria-label={t("label")} className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-line p-[3px]">
        {PRESETS.map((p) => {
          const on = range.preset === p;
          return (
            <Link
              key={p}
              href={`${base}?range=${p}`}
              aria-current={on ? "page" : undefined}
              className={cn(
                "inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-bold",
                on
                  ? "bg-surface text-ink shadow-[0_1px_3px_rgba(22,32,79,.15)]"
                  : "text-muted hover:text-ink",
              )}
            >
              {t(p)}
            </Link>
          );
        })}
      </nav>
      <form action={base} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[13px] font-bold text-ink-2">
          {t("from")}
          <input
            type="date"
            name="from"
            defaultValue={range.from}
            className="min-h-10 rounded-btn border-[1.5px] border-line bg-surface px-2.5 text-sm text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-[13px] font-bold text-ink-2">
          {t("to")}
          <input
            type="date"
            name="to"
            defaultValue={range.to}
            className="min-h-10 rounded-btn border-[1.5px] border-line bg-surface px-2.5 text-sm text-ink"
          />
        </label>
        <button type="submit" className={buttonClass({ variant: "soft", size: "sm" })}>
          {t("apply")}
        </button>
      </form>
      <p className="w-full text-sm text-muted" aria-live="polite">
        {t("summary", {
          from: dayLabel(range.from, locale, true),
          to: dayLabel(range.to, locale, true),
          days: daysBetween(range.from, range.to) + 1,
        })}
      </p>
    </div>
  );
}
