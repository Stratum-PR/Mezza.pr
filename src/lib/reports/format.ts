/** Number formats for Inicio, Reportes and exports (client-safe). */
import type { Ymd } from "./time";

export type Locale = "es" | "en";
const tag = (l: Locale) => (l === "es" ? "es-PR" : "en-US");

/**
 * Node and browsers ship different ICU data: one writes "7 a. m." with narrow no-break spaces,
 * the other with plain ones. Labels rendered on both sides use plain spaces so hydration matches.
 */
const plain = (s: string) => s.replace(/[\u00a0\u202f]/g, " ");

export function pct(value: number | null, locale: Locale, digits = 0): string {
  if (value === null) return "—";
  return plain(
    new Intl.NumberFormat(tag(locale), {
      style: "percent",
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value),
  );
}

/** $1.2 mil / $1.2K: for axis ticks, never for values a reader needs exactly. */
export function centsCompact(cents: number, locale: Locale): string {
  return plain(
    new Intl.NumberFormat(tag(locale), {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(cents / 100),
  );
}

/** Whole dollars: $1,234 (headline tiles). */
export function centsWhole(cents: number, locale: Locale): string {
  return plain(
    new Intl.NumberFormat(tag(locale), {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(Math.round(cents / 100)),
  );
}

export function count(n: number, locale: Locale, digits = 0): string {
  return plain(new Intl.NumberFormat(tag(locale), { maximumFractionDigits: digits }).format(n));
}

/** 9 a. m. / 9 AM */
export function hourLabel(hour: number, locale: Locale): string {
  return plain(
    new Intl.DateTimeFormat(tag(locale), { hour: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 0, 1, hour)),
    ),
  );
}

/** ISO weekday (1 = Monday) → "lun" / "Mon". */
export function weekdayShort(dow: number, locale: Locale): string {
  // 2026-01-05 is a Monday.
  return plain(
    new Intl.DateTimeFormat(tag(locale), { weekday: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(2026, 0, 4 + dow)),
    ),
  );
}

export function dayLabel(ymd: Ymd, locale: Locale, withWeekday = false): string {
  return plain(
    new Intl.DateTimeFormat(tag(locale), {
      day: "numeric",
      month: "short",
      ...(withWeekday ? { weekday: "short" } : {}),
      timeZone: "UTC",
    }).format(new Date(`${ymd}T00:00:00Z`)),
  );
}

/** "2026-09" → "septiembre 2026" / "September 2026". */
export function monthLabel(month: string, locale: Locale, short = false): string {
  return plain(
    new Intl.DateTimeFormat(tag(locale), {
      month: short ? "short" : "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`)),
  );
}

/** "lunes" / "Monday" */
export function weekdayLong(ymd: Ymd, locale: Locale): string {
  return plain(
    new Intl.DateTimeFormat(tag(locale), { weekday: "long", timeZone: "UTC" }).format(
      new Date(`${ymd}T00:00:00Z`),
    ),
  );
}

/** 4:05 p. m. in the restaurant's timezone (the same on server and browser). */
export function timeLabel(iso: string, locale: Locale, timeZone: string): string {
  return plain(
    new Intl.DateTimeFormat(tag(locale), { hour: "numeric", minute: "2-digit", timeZone }).format(
      new Date(iso),
    ),
  );
}
