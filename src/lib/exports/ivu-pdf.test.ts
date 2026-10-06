import { writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { dayLabel } from "@/lib/reports/format";
import { buildIvuSummary } from "./ivu";

vi.mock("server-only", () => ({}));
const { renderIvuPdf } = await import("./ivu-pdf");

function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

describe("IVU summary PDF", () => {
  it("fits a 31-day month on one letter page", async () => {
    const sales = Array.from({ length: 31 }, (_, i) => ({
      date: `2026-10-${String(i + 1).padStart(2, "0")}`,
      sales_cents: 30_000 + i * 517,
      ivu_state_cents: Math.round((30_000 + i * 517) * 0.105),
      ivu_municipal_cents: Math.round((30_000 + i * 517) * 0.01),
    }));
    const summary = buildIvuSummary({
      restaurant: { name: "Café Lucía", address: "Calle Loíza 1800, San Juan" },
      month: "2026-10",
      rates: { stateBps: 1050, municipalBps: 100 },
      sales,
      refunds: [{ date: "2026-10-02", amount_cents: 225 }],
      today: "2026-10-31",
      generatedAt: "2026-10-31T12:00:00Z",
    });
    const pdf = await renderIvuPdf(summary, {
      title: "Resumen de IVU para preparar la planilla en SURI",
      disclaimer:
        "Este resumen te ayuda a preparar la planilla. No es un formulario oficial del Departamento de Hacienda ni sustituye la planilla en SURI.",
      restaurant: "Restaurante",
      period: "Período",
      periodValue: "octubre de 2026",
      generated: "Generado",
      generatedValue: "31 oct 2026, 12:00 p. m.",
      date: "Fecha",
      taxable: "Ventas tributables",
      state: "IVU estatal (10.5%)",
      municipal: "IVU municipal (1%)",
      totalIvu: "Total IVU",
      refunds: "Reembolsos",
      total: "Total",
      page: "Página",
      dayLabel: (d) => dayLabel(d, "es", true),
    });
    if (process.env.IVU_PDF_OUT) writeFileSync(process.env.IVU_PDF_OUT, pdf);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(1);
  }, 30_000);
});
