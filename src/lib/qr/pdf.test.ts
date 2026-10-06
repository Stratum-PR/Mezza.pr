import { describe, expect, it, vi } from "vitest";
import type { CardDesign, CardTable } from "./card";

vi.mock("server-only", () => ({}));
const { renderQrPdf } = await import("./pdf");

const design: CardDesign = {
  fg: "#1F4D3A",
  bg: "#F3E9D2",
  frame: "#1F4D3A",
  frameInk: "#F3E9D2",
  dotStyle: "rounded",
  eyeStyle: "rounded",
  logoMode: "mono",
  frameTextEs: "Escanea para ordenar y pagar",
  frameTextEn: "Scan to order and pay",
  font: "menu",
  restaurantName: "Café Lucía",
  displayHost: "mezza.pr",
};
const tables: CardTable[] = Array.from({ length: 7 }, (_, i) => ({
  id: `t${i + 1}`,
  label: String(i + 1),
  url: `https://mezza.pr/r/cafe-lucia/t/token-${i + 1}`,
}));

function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

describe("QR PDFs", () => {
  it("letter sheet: six cards per page", async () => {
    const pdf = await renderQrPdf("sheet", design, tables);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pageCount(pdf)).toBe(2);
  }, 30_000);

  it("table tents: one 4×6 page per table", async () => {
    const pdf = await renderQrPdf("tent", design, tables.slice(0, 3));
    expect(pageCount(pdf)).toBe(3);
    expect(pdf.toString("latin1")).toMatch(/\/MediaBox\s*\[\s*0 0 288 432\s*\]/);
  }, 30_000);

  it("stickers: one 3×3 page per table", async () => {
    const pdf = await renderQrPdf(
      "sticker",
      { ...design, dotStyle: "dots", eyeStyle: "circle", font: "modern" },
      tables.slice(0, 2),
    );
    expect(pageCount(pdf)).toBe(2);
    expect(pdf.toString("latin1")).toMatch(/\/MediaBox\s*\[\s*0 0 216 216\s*\]/);
  }, 30_000);
});
