import { describe, expect, it } from "vitest";
import { allocateBill, distribute, type BillLine } from "@/lib/bills/allocation";
const people = [
  { participantId: "a", label: "Ana" },
  { participantId: "b", label: "Ben" },
  { participantId: "c", label: "Cam" },
];
const line = (id: string, unitCents: number, qty = 1): BillLine => ({
  id,
  unitCents,
  qty,
  name: id,
  participantId: "a",
});
describe("bill allocation", () => {
  it("splits the whole bill evenly even with many odd-priced units", () => {
    const parts = allocateBill([line("x", 101, 99)], people, "even", [], { state: 1050, municipal: 100 });
    expect(parts.map((p) => p.subtotalCents)).toEqual([3333, 3333, 3333]);
    expect(parts.reduce((n, p) => n + p.stateCents, 0)).toBe(1050);
  });
  it("allocates individual quantities and shared dishes with deterministic pennies", () => {
    const parts = allocateBill(
      [line("shared", 1001), line("owned", 333, 2)],
      people,
      "items",
      [
        { lineId: "shared", unit: 0, recipients: ["a", "b", "c"] },
        { lineId: "owned", unit: 0, recipients: ["b"] },
        { lineId: "owned", unit: 1, recipients: ["c"] },
      ],
      { state: 175, municipal: 17 },
    );
    expect(parts.map((p) => p.subtotalCents)).toEqual([334, 667, 666]);
    expect(parts.reduce((n, p) => n + p.stateCents + p.municipalCents, 0)).toBe(192);
  });
  it("rejects missing, repeated, foreign and unknown assignments", () => {
    const lines = [line("x", 100)];
    for (const assignments of [
      [],
      [{ lineId: "x", unit: 0, recipients: ["z"] }],
      [{ lineId: "x", unit: 0, recipients: ["a", "a"] }],
      [
        { lineId: "x", unit: 0, recipients: ["a"] },
        { lineId: "x", unit: 1, recipients: ["b"] },
      ],
      [
        { lineId: "x", unit: 0, recipients: ["a"] },
        { lineId: "x", unit: 0, recipients: ["b"] },
      ],
    ])
      expect(() => allocateBill(lines, people, "items", assignments, { state: 0, municipal: 0 })).toThrow();
  });
  it("conserves every cent across 1000 varied bills", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      const lines = [
        line("x", (seed * 37) % 12347, (seed % 20) + 1),
        line("y", (seed * 101) % 31000, (seed % 7) + 1),
      ];
      const total = lines.reduce((n, l) => n + l.qty * l.unitCents, 0),
        tax = { state: Math.floor(total * 0.105 + 0.5), municipal: Math.floor(total * 0.01 + 0.5) };
      const parts = allocateBill(lines, people, "even", [], tax);
      expect(parts.reduce((n, p) => n + p.subtotalCents, 0)).toBe(total);
      expect(
        Math.max(...parts.map((p) => p.subtotalCents)) - Math.min(...parts.map((p) => p.subtotalCents)),
      ).toBeLessThanOrEqual(1);
      const dues = parts.map((p) => p.subtotalCents + p.stateCents + p.municipalCents);
      expect(Math.max(...dues) - Math.min(...dues)).toBeLessThanOrEqual(1);
      expect(parts.reduce((n, p) => n + p.stateCents, 0)).toBe(tax.state);
      expect(parts.reduce((n, p) => n + p.municipalCents, 0)).toBe(tax.municipal);
      for (const l of lines)
        for (let unit = 0; unit < l.qty; unit++)
          expect(
            parts
              .flatMap((p) => p.lines)
              .filter((a) => a.lineId === l.id && a.unit === unit)
              .reduce((n, a) => n + a.cents, 0),
          ).toBe(l.unitCents);
    }
  });
  it("rejects negative amounts and unsafe totals", () => {
    expect(() => distribute(-1, [1])).toThrow();
    expect(() =>
      allocateBill([line("x", Number.MAX_SAFE_INTEGER, 2)], people, "even", [], { state: 0, municipal: 0 }),
    ).toThrow();
  });
});
