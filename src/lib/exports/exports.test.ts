import { describe, expect, it } from "vitest";
import { dollars, safeText, toCsv } from "./csv";
import { buildIvuSummary, ivuCsv, type IvuLabels } from "./ivu";

describe("csv", () => {
  it("quotes commas, quotes and newlines and starts with a BOM", () => {
    expect(toCsv([["a,b", 'say "hi"', "x\ny", 3, null]])).toBe('﻿"a,b","say ""hi""","x\ny",3,\r\n');
  });

  it("defuses formulas in free text", () => {
    expect(safeText("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(safeText("-1 sin hielo")).toBe("'-1 sin hielo");
    expect(safeText("Sin cebolla")).toBe("Sin cebolla");
    expect(safeText(null)).toBe("");
  });

  it("writes cents as plain dollars", () => {
    expect(dollars(0)).toBe("0.00");
    expect(dollars(1)).toBe("0.01");
    expect(dollars(123456)).toBe("1234.56");
    expect(dollars(-250)).toBe("-2.50");
  });
});

const labels: IvuLabels = {
  title: "Resumen de IVU para preparar la planilla en SURI",
  disclaimer: "No es un formulario oficial.",
  restaurant: "Restaurante",
  period: "Período",
  periodValue: "septiembre 2026",
  generated: "Generado",
  generatedValue: "5 oct 2026",
  date: "Fecha",
  taxable: "Ventas tributables",
  state: "IVU estatal",
  municipal: "IVU municipal",
  totalIvu: "Total IVU",
  refunds: "Reembolsos",
  total: "Total",
};

describe("IVU summary", () => {
  const summary = buildIvuSummary({
    restaurant: { name: "Café Lucía", address: null },
    month: "2026-09",
    rates: { stateBps: 1050, municipalBps: 100 },
    sales: [
      { date: "2026-09-01", sales_cents: 1000, ivu_state_cents: 105, ivu_municipal_cents: 10 },
      { date: "2026-09-01", sales_cents: 500, ivu_state_cents: 53, ivu_municipal_cents: 5 },
      { date: "2026-09-30", sales_cents: 200, ivu_state_cents: 21, ivu_municipal_cents: 2 },
    ],
    refunds: [{ date: "2026-09-30", amount_cents: 200 }],
    today: "2026-10-05",
    generatedAt: "2026-10-05T12:00:00Z",
  });

  it("lists every day of the month and totals them", () => {
    expect(summary.days).toHaveLength(30);
    expect(summary.days[0]).toEqual({
      date: "2026-09-01",
      taxable: 1500,
      state: 158,
      municipal: 15,
      refunds: 0,
    });
    expect(summary.days[1]?.taxable).toBe(0);
    expect(summary.totals).toEqual({ taxable: 1700, state: 179, municipal: 17, refunds: 200 });
  });

  it("stops at today for the current month", () => {
    const current = buildIvuSummary({
      ...summary,
      sales: [],
      refunds: [],
      month: "2026-10",
      today: "2026-10-05",
    });
    expect(current.days.map((d) => d.date).at(-1)).toBe("2026-10-05");
  });

  it("writes the CSV with its title, disclaimer and a total row", () => {
    const csv = ivuCsv(summary, labels).split("\r\n");
    expect(csv[0]).toBe("﻿Resumen de IVU para preparar la planilla en SURI");
    expect(csv[1]).toBe("No es un formulario oficial.");
    expect(csv[6]).toBe("Fecha,Ventas tributables,IVU estatal,IVU municipal,Total IVU,Reembolsos");
    expect(csv[7]).toBe("2026-09-01,15.00,1.58,0.15,1.73,0.00");
    expect(csv[37]).toBe("Total,17.00,1.79,0.17,1.96,2.00");
  });
});
