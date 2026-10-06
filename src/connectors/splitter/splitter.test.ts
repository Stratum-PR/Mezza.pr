import { describe, expect, it } from "vitest";
import { computeIvu } from "@/lib/money";
import { isNotImplemented } from "../shared";
import { tabSplitter } from ".";

const rates = { stateBps: 1050, municipalBps: 100 };

function randomTab(seed: number) {
  const lines = Array.from({ length: 1 + (seed % 9) }, (_, i) => ({
    participantId: i % 3 === 0 ? null : `p${i % 3}`,
    shared: i % 4 === 0,
    lineTotalCents: ((seed * 7919 + i * 104729) % 4000) + 1,
  }));
  return { lines };
}

describe("tab splitter", () => {
  it("one check: parts always sum to the tab subtotal and IVU (property)", () => {
    for (let seed = 0; seed < 1000; seed++) {
      const tab = randomTab(seed);
      const parts = tabSplitter().split(tab, rates, "one");
      const subtotal = tab.lines.reduce((s, l) => s + l.lineTotalCents, 0);
      const ivu = computeIvu(subtotal, rates);
      expect(parts.reduce((s, p) => s + p.subtotalCents, 0)).toBe(subtotal);
      expect(parts.reduce((s, p) => s + p.ivuStateCents, 0)).toBe(ivu.state);
      expect(parts.reduce((s, p) => s + p.ivuMunicipalCents, 0)).toBe(ivu.municipal);
    }
  });

  it("even and per-item splits are not built yet", () => {
    for (const mode of ["even", "items"] as const) {
      let error: unknown;
      try {
        tabSplitter().split(randomTab(1), rates, mode, 2);
      } catch (e) {
        error = e;
      }
      expect(isNotImplemented(error)).toBe(true);
    }
  });

  it.todo("even split: parts sum to the tab subtotal and IVU (property)");
  it.todo("per-item split with shared lines: parts sum to the tab subtotal and IVU (property)");
});
