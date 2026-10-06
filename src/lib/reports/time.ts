/**
 * Restaurant-local dates. Reports and summaries work in the restaurant's timezone, never UTC:
 * a sale at 9:30 pm in San Juan belongs to that day, not the next one.
 */

export type Ymd = string; // "2026-10-05"

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    partsCache.set(tz, f);
  }
  return f;
}

/** The local calendar date, hour (0–23) and minute of an instant. */
export function localParts(at: Date, tz: string): { ymd: Ymd; hour: number; minute: number } {
  const p = Object.fromEntries(
    formatter(tz)
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}

export function addDays(ymd: Ymd, days: number): Ymd {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: Ymd, to: Ymd): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function isoWeekday(ymd: Ymd): number {
  const d = new Date(`${ymd}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** The instant a local wall-clock time happens (handles any fixed or DST offset). */
export function localToUtc(ymd: Ymd, hour: number, tz: string, minute = 0): Date {
  const guess = Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), hour, minute);
  // The offset at the guess, then once more in case the guess crossed an offset change.
  let at = guess;
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(at), tz);
    const shown = Date.UTC(+p.ymd.slice(0, 4), +p.ymd.slice(5, 7) - 1, +p.ymd.slice(8, 10), p.hour, p.minute);
    at += guess - shown;
  }
  return new Date(at);
}

export function isYmd(value: unknown): value is Ymd {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

/** "2026-09" → first and last local date of that month. */
export function monthRange(month: string): { from: Ymd; to: Ymd } {
  const from = `${month}-01`;
  const next = new Date(`${from}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { from, to: addDays(next.toISOString().slice(0, 10), -1) };
}
