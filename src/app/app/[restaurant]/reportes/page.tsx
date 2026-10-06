import { getLocale, getTranslations } from "next-intl/server";
import { RangeBar } from "@/components/reports/range-bar";
import { ReportsView } from "@/components/reports/reports-view";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { resolveRange } from "@/lib/reports/range";
import { shapeReport, type RawReport } from "@/lib/reports/summary";
import { localParts } from "@/lib/reports/time";

export default async function ReportsPage({ params, searchParams }: PageProps<"/app/[restaurant]/reportes">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "reports");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const today = localParts(new Date(), ctx.restaurant.timezone).ymd;
  const range = resolveRange({ range: one(sp.range), from: one(sp.from), to: one(sp.to) }, today);
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const t = await getTranslations("reports");

  const { data, error } = await (
    await createClient()
  ).rpc("report_summary", { p_restaurant_id: ctx.restaurant.id, p_from: range.from, p_to: range.to });
  if (error || !data) throw new Error(`report failed: ${error?.message ?? "no data"}`);
  const report = shapeReport(data as unknown as RawReport, range.from, range.to);

  return (
    <div>
      <h1 className="mb-3 text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <RangeBar base={`/app/${restaurant}/reportes`} range={range} locale={locale} />
      <ReportsView report={report} locale={locale} />
    </div>
  );
}
