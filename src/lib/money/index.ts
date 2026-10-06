import type { Cents } from "./types";

export type { Cents } from "./types";

export interface IvuRates {
  stateBps: number; // 1050 = 10.5%
  municipalBps: number; // 100 = 1%
}

export const DEFAULT_IVU: IvuRates = { stateBps: 1050, municipalBps: 100 };

export function assertCents(value: number, label = "amount"): Cents {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${label} must be a non-negative integer of cents`);
  return value;
}

/** value × bps / 10000, rounded half-up to the cent, in integer math. */
function applyBps(cents: Cents, bps: number): Cents {
  return Math.floor((cents * bps + 5000) / 10000);
}

/**
 * IVU on a pre-tax subtotal. Each component (state, municipal) is rounded half-up to the cent
 * separately. Rounding rule awaits CPA confirmation (DECISIONS.md).
 */
export function computeIvu(subtotalCents: Cents, rates: IvuRates = DEFAULT_IVU) {
  assertCents(subtotalCents, "subtotal");
  const state = applyBps(subtotalCents, rates.stateBps);
  const municipal = applyBps(subtotalCents, rates.municipalBps);
  return { state, municipal, total: state + municipal };
}

/**
 * IVU for one payment when a tab is paid in parts: IVU(everything paid including it) minus
 * IVU(everything paid before), per component. Never negative, and the parts always add up to the
 * one-check IVU. Mirrors create_tab_payment in the database, which is the authority.
 */
export function ivuForPart(paidBeforeCents: Cents, partCents: Cents, rates: IvuRates = DEFAULT_IVU) {
  const before = computeIvu(paidBeforeCents, rates);
  const after = computeIvu(paidBeforeCents + assertCents(partCents, "part"), rates);
  const state = after.state - before.state;
  const municipal = after.municipal - before.municipal;
  return { state, municipal, total: state + municipal };
}

/** Splits cents into equal parts; the first parts get the leftover cents (100 / 3 → 34, 33, 33). */
export function distributeCents(totalCents: Cents, parts: number): Cents[] {
  assertCents(totalCents, "total");
  if (!Number.isInteger(parts) || parts < 1 || parts > 100) throw new RangeError("parts must be 1–100");
  const base = Math.floor(totalCents / parts);
  const extra = totalCents - base * parts;
  return Array.from({ length: parts }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Tip as a whole percent of the pre-tax subtotal, half-up. Tips are not taxed. */
export function tipFromPercent(subtotalCents: Cents, percent: number): Cents {
  assertCents(subtotalCents, "subtotal");
  if (!Number.isInteger(percent) || percent < 0 || percent > 100)
    throw new RangeError("percent must be 0–100");
  return applyBps(subtotalCents, percent * 100);
}

export function checkTotals(lineTotalsCents: Cents[], rates: IvuRates, tipCents: Cents = 0) {
  const subtotal = lineTotalsCents.reduce((sum, c) => sum + assertCents(c, "line"), 0);
  const ivu = computeIvu(subtotal, rates);
  assertCents(tipCents, "tip");
  return {
    subtotalCents: subtotal,
    ivuStateCents: ivu.state,
    ivuMunicipalCents: ivu.municipal,
    tipCents,
    totalCents: subtotal + ivu.total + tipCents,
  };
}

/** Parses a dollar amount typed in the UI ("3.5", "$3.50", "1,250.00") into cents. */
export function dollarsToCents(input: string): Cents | null {
  const clean = input.trim().replace(/^\$/, "").replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** $3.50 — Puerto Rico uses US dollars in both languages. */
export function formatCents(cents: Cents, locale: "es" | "en" = "es"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-PR" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** 3.50 — the bare number printed menus use. */
export function formatPlain(cents: Cents): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
