import { getLocale, getTranslations } from "next-intl/server";
import { billsDb } from "@/lib/bills/db";
import { splitWorkflowEnabled } from "@/lib/bills/feature";
import { formatCents } from "@/lib/money";
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

  let writtenOff: { writtenOffCents: number; writtenOffCount: number } | null = null;
  if (splitWorkflowEnabled()) {
    const res = await billsDb().rpc("visit_financial_summary", {
      p_restaurant: ctx.restaurant.id,
      p_actor: ctx.userId,
      p_from: range.from,
      p_to: range.to,
    });
    if (res.error) throw new Error("bill settlement report failed");
    writtenOff = res.data as unknown as { writtenOffCents: number; writtenOffCount: number };
  }
  return (
    <div>
      <h1 className="mb-3 text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <RangeBar base={`/app/${restaurant}/reportes`} range={range} locale={locale} />
      {writtenOff && (
        <div className="my-4 rounded-card border border-line p-4">
          <b>
            {locale === "es" ? "Saldos resueltos sin cobro" : "Balances written off"}:{" "}
            {formatCents(writtenOff.writtenOffCents, locale)}
          </b>
          <p>
            {writtenOff.writtenOffCount}{" "}
            {locale === "es"
              ? "porciones en este período. Incluye IVU. No es efectivo recibido ni reembolsos."
              : "portions in this period. Includes tax. Separate from cash collected and refunds."}
          </p>
        </div>
      )}
      <ReportsView report={report} locale={locale} />
    </div>
  );
}
