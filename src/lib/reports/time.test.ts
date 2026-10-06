import { describe, expect, it } from "vitest";
import { addDays, daysBetween, isoWeekday, isYmd, localParts, localToUtc, monthRange } from "./time";

const PR = "America/Puerto_Rico";

describe("restaurant-local time", () => {
  it("puts a 9:30 pm San Juan sale on its local day", () => {
    expect(localParts(new Date("2026-10-06T01:30:00Z"), PR)).toEqual({
      ymd: "2026-10-05",
      hour: 21,
      minute: 30,
    });
  });

  it("finds the instant of local midnight", () => {
    expect(localToUtc("2026-10-05", 0, PR).toISOString()).toBe("2026-10-05T04:00:00.000Z");
  });

  it("handles a zone with daylight saving", () => {
    // New York is UTC-4 in summer and UTC-5 in winter.
    expect(localToUtc("2026-07-01", 0, "America/New_York").toISOString()).toBe("2026-07-01T04:00:00.000Z");
    expect(localToUtc("2026-12-01", 0, "America/New_York").toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  it("does date arithmetic across months and years", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(daysBetween("2026-09-01", "2026-10-01")).toBe(30);
  });

  it("numbers weekdays from Monday", () => {
    expect(isoWeekday("2026-10-05")).toBe(1);
    expect(isoWeekday("2026-10-11")).toBe(7);
  });

  it("gives a month's first and last day", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("validates dates", () => {
    expect(isYmd("2026-10-05")).toBe(true);
    expect(isYmd("2026-13-05")).toBe(false);
    expect(isYmd("10/05/2026")).toBe(false);
  });
});
