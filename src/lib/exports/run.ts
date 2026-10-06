import "server-only";
import { getTranslations } from "next-intl/server";
import type { StaffContext } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { dayLabel, monthLabel, type Locale } from "@/lib/reports/format";
import { localParts, localToUtc, monthRange, addDays } from "@/lib/reports/time";
import { buildIvuSummary, ivuCsv, type IvuLabels } from "./ivu";
import { renderIvuPdf } from "./ivu-pdf";
import { loadSales, salesCsv, salesXlsx, type SalesColumns } from "./sales";

export const EXPORT_KINDS = ["ivu_monthly_pdf", "ivu_monthly_csv", "sales_csv", "sales_xlsx"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];

const CONTENT_TYPE: Record<ExportKind, string> = {
  ivu_monthly_pdf: "application/pdf",
  ivu_monthly_csv: "text/csv; charset=utf-8",
  sales_csv: "text/csv; charset=utf-8",
  sales_xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
const EXT: Record<ExportKind, string> = {
  ivu_monthly_pdf: "pdf",
  ivu_monthly_csv: "csv",
  sales_csv: "csv",
  sales_xlsx: "xlsx",
};

export interface ExportFile {
  body: Uint8Array;
  filename: string;
  contentType: string;
  stored: boolean;
}

/** Builds one export, stores it in the private exports bucket and records it in `exports`. */
export async function runExport(
  ctx: StaffContext,
  kind: ExportKind,
  month: string,
  locale: Locale,
): Promise<ExportFile> {
  const db = await createClient();
  const r = ctx.restaurant;
  const t = await getTranslations({ locale, namespace: "exports" });
  const now = new Date();
  const today = localParts(now, r.timezone).ymd;
  const generatedValue = new Intl.DateTimeFormat(locale === "es" ? "es-PR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: r.timezone,
  }).format(now);
  const periodValue = monthLabel(month, locale);

  let body: Uint8Array;
  if (kind === "ivu_monthly_pdf" || kind === "ivu_monthly_csv") {
    const { from, to } = monthRange(month);
    const [sales, refunds] = await Promise.all([
      db
        .from("daily_sales")
        .select("date, sales_cents, ivu_state_cents, ivu_municipal_cents")
        .eq("restaurant_id", r.id)
        .gte("date", from)
        .lte("date", to)
        .limit(1000),
      db
        .from("refunds")
        .select("amount_cents, created_at")
        .eq("restaurant_id", r.id)
        .gte("created_at", localToUtc(from, 0, r.timezone).toISOString())
        .lt("created_at", localToUtc(addDays(to, 1), 0, r.timezone).toISOString())
        .limit(1000),
    ]);
    if (sales.error || refunds.error) throw new Error("ivu export query failed");
    const summary = buildIvuSummary({
      restaurant: { name: r.name, address: r.address },
      month,
      rates: { stateBps: r.ivu_state_bps, municipalBps: r.ivu_municipal_bps },
      sales: sales.data,
      refunds: refunds.data.map((x) => ({
        date: localParts(new Date(x.created_at), r.timezone).ymd,
        amount_cents: x.amount_cents,
      })),
      today,
      generatedAt: now.toISOString(),
    });
    const pctOf = (bps: number) => `${(bps / 100).toLocaleString(locale === "es" ? "es-PR" : "en-US")}%`;
    const labels: IvuLabels = {
      title: t("ivu.docTitle"),
      disclaimer: t("ivu.disclaimer"),
      restaurant: t("ivu.restaurant"),
      period: t("ivu.period"),
      periodValue,
      generated: t("ivu.generated"),
      generatedValue,
      date: t("ivu.date"),
      taxable: t("ivu.taxable"),
      state: t("ivu.state", { rate: pctOf(r.ivu_state_bps) }),
      municipal: t("ivu.municipal", { rate: pctOf(r.ivu_municipal_bps) }),
      totalIvu: t("ivu.totalIvu"),
      refunds: t("ivu.refunds"),
      total: t("ivu.total"),
    };
    body =
      kind === "ivu_monthly_csv"
        ? new TextEncoder().encode(ivuCsv(summary, labels))
        : new Uint8Array(
            await renderIvuPdf(summary, {
              ...labels,
              page: t("ivu.page"),
              dayLabel: (ymd) => dayLabel(ymd, locale, true),
            }),
          );
  } else {
    const cols: SalesColumns = {
      orders: t.raw("sales.cols.orders") as string[],
      lines: t.raw("sales.cols.lines") as string[],
      payments: t.raw("sales.cols.payments") as string[],
      refunds: t.raw("sales.cols.refunds") as string[],
      sheetNames: {
        orders: t("sales.sheets.orders"),
        lines: t("sales.sheets.lines"),
        payments: t("sales.sheets.payments"),
        refunds: t("sales.sheets.refunds"),
      },
      source: { qr: t("sales.source.qr"), staff: t("sales.source.staff") },
      method: { card: t("sales.method.card"), ath: t("sales.method.ath"), cash: t("sales.method.cash") },
      status: t.raw("sales.status") as Record<string, string>,
      yes: t("sales.yes"),
    };
    const sheets = await loadSales(db, r, month, cols);
    const title = t("sales.docTitle", { restaurant: r.name, period: periodValue });
    body =
      kind === "sales_csv"
        ? new TextEncoder().encode(
            salesCsv(sheets, cols, [title, `${t("ivu.generated")}: ${generatedValue}`]),
          )
        : new Uint8Array(await salesXlsx(sheets, cols, title));
  }

  const base = kind.startsWith("ivu") ? "resumen-ivu" : "ventas";
  const filename = `${r.slug}-${base}-${month}.${EXT[kind]}`;
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const path = `${r.id}/exports/${base}-${month}-${stamp}.${EXT[kind]}`;
  const upload = await db.storage
    .from("exports")
    .upload(path, body, { contentType: CONTENT_TYPE[kind].split(";")[0] });
  let stored = false;
  if (!upload.error) {
    const { error } = await db
      .from("exports")
      .insert({ restaurant_id: r.id, kind, period: month, file_path: path, created_by: ctx.userId });
    stored = !error;
  }
  return { body, filename, contentType: CONTENT_TYPE[kind], stored };
}
