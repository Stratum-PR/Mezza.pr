import { describe, expect, it } from "vitest";
import { flags } from "@/config/flags";
import { MENU_FONTS, isMenuFont } from "@/config/menu-fonts";
import { activePricingModel, monthlyFee, pricing } from "@/config/pricing";
import { isMarketingPath } from "@/i18n/paths";
import { isLocale } from "@/i18n/locales";

describe("locale routing", () => {
  it.each(["/", "/es", "/en/precios", "/demo", "/apple"])("%s is a marketing path", (p) => {
    expect(isMarketingPath(p)).toBe(true);
  });

  it.each(["/app", "/app/cafe-lucia/cocina", "/r/cafe-lucia/t/abc", "/admin", "/api/events"])(
    "%s has no locale prefix",
    (p) => {
      expect(isMarketingPath(p)).toBe(false);
    },
  );

  it("accepts only es and en", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("config", () => {
  it("keeps every feature flag off except those whose tests pass (CONNECTORS.md)", () => {
    // sharedTab: pass 2 phase 1 (people, locked shares); splitBill: phase 4 (checkout, after the
    // splitter property tests in phase 3). Add a flag here only with its tests.
    const on = Object.entries(flags)
      .filter(([, v]) => v)
      .map(([k]) => k);
    expect(on).toEqual(["splitBill", "sharedTab"]);
  });

  it("uses pricing model A with integer cents", () => {
    expect(activePricingModel()).toMatchObject({ id: "A", monthlyCents: 2_900, cardFeeBps: 50 });
    expect(Number.isInteger(pricing.guidedSetupCents)).toBe(true);
    expect(pricing.models.map((m) => m.id)).toEqual(["A", "B", "C", "D"]);
  });

  it("computes the monthly fee: $29 + 0.5% of card volume", () => {
    expect(monthlyFee(0)).toBe(2_900);
    expect(monthlyFee(300_000)).toBe(4_400);
    expect(monthlyFee(101)).toBe(2_901); // 0.505¢ rounds half-up
  });

  it("curates about 12 unique menu fonts and never Archivo", () => {
    const families = MENU_FONTS.map((f) => f.family);
    expect(new Set(families).size).toBe(families.length);
    expect(families.length).toBeGreaterThanOrEqual(10);
    expect(isMenuFont("Playfair Display")).toBe(true);
    expect(isMenuFont("Archivo")).toBe(false);
  });
});
