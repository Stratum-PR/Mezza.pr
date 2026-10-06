import { describe, expect, it } from "vitest";
import {
  checkTotals,
  computeIvu,
  distributeCents,
  dollarsToCents,
  formatCents,
  formatPlain,
  ivuForPart,
  tipFromPercent,
} from ".";

describe("computeIvu", () => {
  it.each([
    [0, 0, 0],
    [1, 0, 0], // 0.105¢ and 0.01¢ round down
    [5, 1, 0], // 0.525¢ → 1¢
    [50, 5, 1], // 5.25¢ → 5¢, 0.5¢ → 1¢ (half-up)
    [250, 26, 3], // 26.25¢ → 26¢, 2.5¢ → 3¢
    [1999, 210, 20],
    [123_456_789, 12_962_963, 1_234_568],
  ])("subtotal %i¢ → state %i¢, municipal %i¢", (subtotal, state, municipal) => {
    expect(computeIvu(subtotal)).toEqual({ state, municipal, total: state + municipal });
  });

  it("rejects fractional or negative cents", () => {
    expect(() => computeIvu(1.5)).toThrow(RangeError);
    expect(() => computeIvu(-1)).toThrow(RangeError);
  });
});

describe("tips", () => {
  it("are taken on the pre-tax subtotal, half-up", () => {
    expect(tipFromPercent(1000, 18)).toBe(180);
    expect(tipFromPercent(325, 15)).toBe(49); // 48.75
    expect(tipFromPercent(1, 20)).toBe(0);
    expect(tipFromPercent(0, 20)).toBe(0);
  });
});

describe("checkTotals", () => {
  it("total is always subtotal + IVU + tip", () => {
    for (let i = 0; i < 500; i++) {
      const lines = Array.from({ length: 1 + (i % 7) }, (_, j) => ((i * 37 + j * 113) % 2500) + 1);
      const tip = (i * 13) % 900;
      const t = checkTotals(lines, { stateBps: 1050, municipalBps: 100 }, tip);
      expect(t.subtotalCents).toBe(lines.reduce((a, b) => a + b, 0));
      expect(t.totalCents).toBe(t.subtotalCents + t.ivuStateCents + t.ivuMunicipalCents + t.tipCents);
      expect(Number.isInteger(t.totalCents)).toBe(true);
    }
  });
});

describe("dollarsToCents", () => {
  it.each([
    ["3.5", 350],
    ["$3.50", 350],
    ["3", 300],
    ["1,250.00", 125_000],
    ["0.01", 1],
  ])("%s → %i", (input, cents) => expect(dollarsToCents(input)).toBe(cents));

  it.each(["", "abc", "3.505", "-1", "1.2.3"])("rejects %s", (input) =>
    expect(dollarsToCents(input)).toBeNull(),
  );
});

describe("formatting", () => {
  it("formats dollars", () => {
    expect(formatCents(350, "en")).toBe("$3.50");
    expect(formatPlain(250)).toBe("2.50");
    expect(formatPlain(5)).toBe("0.05");
  });
});

describe("paying a tab in parts", () => {
  it("splits cents evenly, leftover cents first", () => {
    expect(distributeCents(100, 3)).toEqual([34, 33, 33]);
    expect(distributeCents(10050, 3)).toEqual([3350, 3350, 3350]);
    expect(distributeCents(0, 2)).toEqual([0, 0]);
    expect(() => distributeCents(100, 0)).toThrow();
  });

  it("IVU per part is never negative and adds up to the one-check IVU (property)", () => {
    // The case that broke "the last payer absorbs the rounding": 21 × $1.00, then $0.50.
    const parts = [...Array(21).fill(100), 50];
    let paid = 0;
    const ivus = parts.map((p) => {
      const ivu = ivuForPart(paid, p);
      paid += p;
      return ivu;
    });
    expect(Math.min(...ivus.map((i) => Math.min(i.state, i.municipal)))).toBeGreaterThanOrEqual(0);
    expect(ivus.reduce((n, i) => n + i.state, 0)).toBe(computeIvu(paid).state);

    for (let seed = 1; seed <= 1000; seed++) {
      const rates = { stateBps: 1050, municipalBps: 50 + (seed % 200) };
      const sizes = Array.from(
        { length: 1 + (seed % 12) },
        (_, i) => ((seed * 7919 + i * 104729) % 5000) + 1,
      );
      let before = 0;
      let state = 0;
      let municipal = 0;
      for (const s of sizes) {
        const ivu = ivuForPart(before, s, rates);
        expect(ivu.state).toBeGreaterThanOrEqual(0);
        expect(ivu.municipal).toBeGreaterThanOrEqual(0);
        state += ivu.state;
        municipal += ivu.municipal;
        before += s;
      }
      expect({ state, municipal }).toEqual({
        state: computeIvu(before, rates).state,
        municipal: computeIvu(before, rates).municipal,
      });
    }
  });
});
