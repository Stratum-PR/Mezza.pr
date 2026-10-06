import { describe, expect, it } from "vitest";
import { renderTicketText, type Ticket } from ".";

const kitchen: Ticket = {
  kind: "kitchen",
  restaurantName: "Café Lucía",
  tableLabel: "4",
  orderNumber: 1042,
  createdAt: "2026-10-05T13:05:00Z",
  locale: "es",
  lines: [
    { qty: 2, name: "Café con leche", modifiers: ["Avena", "Poca"] },
    {
      qty: 1,
      name: "Mallorca",
      modifiers: ["A la plancha con mantequilla"],
      note: "Bien tostada, por favor",
    },
  ],
};

describe("renderTicketText", () => {
  it.each([24, 32, 42, 48])("never exceeds %i characters per line", (width) => {
    const text = renderTicketText(
      {
        ...kitchen,
        lines: [...kitchen.lines, { qty: 3, name: "x".repeat(80), modifiers: ["y".repeat(70)] }],
      },
      width,
    );
    for (const line of text.split("\n")) expect(line.length).toBeLessThanOrEqual(width);
  });

  it("prints a kitchen ticket", () => {
    const text = renderTicketText(kitchen, 32);
    expect(text).toContain("COCINA");
    expect(text).toMatch(/Mesa 4\s+Orden #1042/);
    expect(text).toContain("2x Café con leche");
    expect(text).toContain("- Avena");
    expect(text).toContain("Nota: Bien tostada");
    expect(text).not.toContain("Total");
    expect(text).not.toContain("MESA NUEVA");
  });

  it("marks a QR order that opened a free table, in the ticket's language", () => {
    expect(renderTicketText({ ...kitchen, newTable: true }, 32)).toContain("** MESA NUEVA (QR) **");
    expect(renderTicketText({ ...kitchen, newTable: true, locale: "en" }, 24)).toContain("NEW TABLE (QR)");
  });

  it("prints a receipt with separate IVU lines and the footer", () => {
    const text = renderTicketText(
      {
        ...kitchen,
        kind: "receipt",
        locale: "en",
        totals: {
          subtotalCents: 1000,
          ivuStateCents: 105,
          ivuMunicipalCents: 10,
          tipCents: 180,
          totalCents: 1295,
        },
        footer: "Payment receipt: the fiscal receipt is issued by the restaurant.",
      },
      42,
    );
    expect(text).toContain("PAYMENT RECEIPT");
    expect(text).toMatch(/State IVU\s+1\.05/);
    expect(text).toMatch(/Municipal IVU\s+0\.10/);
    expect(text).toMatch(/Total\s+12\.95/);
    expect(text).toContain("fiscal receipt");
  });

  it("rejects unusable widths", () => {
    expect(() => renderTicketText(kitchen, 10)).toThrow(RangeError);
  });
});
