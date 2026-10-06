import { describe, expect, it } from "vitest";
import { computeIvu } from "@/lib/money";
import { tabSplitter, type SplitLine, type SplitPart } from ".";

const rates = { stateBps: 1050, municipalBps: 100 };

/** Random tabs: owned lines, table lines, and shared lines with locked shares (summing to the line). */
function randomTab(seed: number): { lines: SplitLine[] } {
  const lines = Array.from({ length: 1 + (seed % 9) }, (_, i): SplitLine => {
    const lineTotalCents = ((seed * 7919 + i * 104729) % 4000) + 1;
    const kind = (seed + i) % 4;
    if (kind === 0) return { participantId: null, shared: false, lineTotalCents };
    if (kind === 1) {
      const a = Math.ceil(lineTotalCents / 2);
      return {
        participantId: "p1",
        shared: true,
        lineTotalCents,
        shares: [
          { participantId: "p1", cents: a },
          { participantId: "p2", cents: lineTotalCents - a },
        ],
      };
    }
    if (kind === 2) return { participantId: "p1", shared: true, lineTotalCents }; // no shares yet: the table's
    return { participantId: `p${1 + (i % 3)}`, shared: false, lineTotalCents };
  });
  return { lines };
}

function expectConserves(tab: { lines: SplitLine[] }, parts: SplitPart[]) {
  const subtotal = tab.lines.reduce((s, l) => s + l.lineTotalCents, 0);
  const ivu = computeIvu(subtotal, rates);
  expect(parts.reduce((s, p) => s + p.subtotalCents, 0)).toBe(subtotal);
  expect(parts.reduce((s, p) => s + p.ivuStateCents, 0)).toBe(ivu.state);
  expect(parts.reduce((s, p) => s + p.ivuMunicipalCents, 0)).toBe(ivu.municipal);
  for (const p of parts)
    expect(Math.min(p.subtotalCents, p.ivuStateCents, p.ivuMunicipalCents)).toBeGreaterThanOrEqual(0);
}

describe("tab splitter", () => {
  it("one check: parts always sum to the tab subtotal and IVU (property)", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const tab = randomTab(seed);
      expectConserves(tab, tabSplitter().split(tab, rates, "one"));
    }
  });

  it("even split: parts sum to the tab subtotal and IVU (property)", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const tab = randomTab(seed);
      const count = 2 + (seed % 19);
      const parts = tabSplitter().split(tab, rates, "even", count);
      expect(parts).toHaveLength(count);
      expectConserves(tab, parts);
      const subs = parts.map((p) => p.subtotalCents);
      expect(Math.max(...subs) - Math.min(...subs)).toBeLessThanOrEqual(1);
    }
  });

  it("per-item split with shared lines: parts sum to the tab subtotal and IVU (property)", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const tab = randomTab(seed);
      expectConserves(tab, tabSplitter().split(tab, rates, "items"));
    }
  });

  it("per-item split: own lines plus shares by person, the table's lines last", () => {
    const parts = tabSplitter().split(
      {
        lines: [
          { participantId: "ana", shared: false, lineTotalCents: 200 },
          {
            participantId: "ben",
            shared: true,
            lineTotalCents: 1001,
            shares: [
              { participantId: "ana", cents: 501 },
              { participantId: "ben", cents: 500 },
            ],
          },
          { participantId: null, shared: false, lineTotalCents: 400 },
        ],
      },
      rates,
      "items",
    );
    expect(parts.map((p) => [p.participantId, p.subtotalCents])).toEqual([
      ["ana", 701],
      ["ben", 500],
      [null, 400],
    ]);
  });

  it("an even split needs 2–20 parts", () => {
    expect(() => tabSplitter().split(randomTab(1), rates, "even", 1)).toThrow();
    expect(() => tabSplitter().split(randomTab(1), rates, "even", 21)).toThrow();
  });
});
