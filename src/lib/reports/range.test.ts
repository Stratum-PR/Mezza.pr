import { describe, expect, it } from "vitest";
import { resolveRange } from "./range";

const today = "2026-10-05";

describe("resolveRange", () => {
  it("defaults to the last 30 days, today included", () => {
    expect(resolveRange({}, today)).toEqual({ from: "2026-09-06", to: today, preset: "30d" });
  });

  it("knows the presets", () => {
    expect(resolveRange({ range: "7d" }, today).from).toBe("2026-09-29");
    expect(resolveRange({ range: "month" }, today)).toEqual({
      from: "2026-10-01",
      to: today,
      preset: "month",
    });
    expect(resolveRange({ range: "lastMonth" }, today)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
      preset: "lastMonth",
    });
  });

  it("accepts a custom range, swapped if reversed, never past today", () => {
    expect(resolveRange({ from: "2026-09-10", to: "2026-09-01" }, today)).toEqual({
      from: "2026-09-01",
      to: "2026-09-10",
      preset: null,
    });
    expect(resolveRange({ from: "2026-10-01", to: "2026-12-01" }, today).to).toBe(today);
  });

  it("caps a custom range at a year", () => {
    expect(resolveRange({ from: "2020-01-01", to: "2026-10-05" }, today).from).toBe("2025-10-05");
  });

  it("ignores garbage", () => {
    expect(resolveRange({ from: "nope", to: "2026-09-01" }, today).preset).toBe("30d");
  });
});
