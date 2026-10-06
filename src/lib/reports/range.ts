import { addDays, daysBetween, isYmd, monthRange, type Ymd } from "./time";

export const PRESETS = ["7d", "30d", "90d", "month", "lastMonth"] as const;
export type Preset = (typeof PRESETS)[number];
export const MAX_DAYS = 366;

export interface Range {
  from: Ymd;
  to: Ymd;
  preset: Preset | null;
}

/** ?range=30d, or ?from=…&to=… (clamped to today and to a year). Defaults to the last 30 days. */
export function resolveRange(params: { range?: string; from?: string; to?: string }, today: Ymd): Range {
  const preset = PRESETS.find((p) => p === params.range);
  if (!preset && isYmd(params.from) && isYmd(params.to)) {
    let [from, to] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
    if (to > today) to = today;
    if (from > to) from = to;
    if (daysBetween(from, to) >= MAX_DAYS) from = addDays(to, -(MAX_DAYS - 1));
    return { from, to, preset: null };
  }
  const p = preset ?? "30d";
  const month = today.slice(0, 7);
  switch (p) {
    case "7d":
      return { from: addDays(today, -6), to: today, preset: p };
    case "90d":
      return { from: addDays(today, -89), to: today, preset: p };
    case "month":
      return { from: monthRange(month).from, to: today, preset: p };
    case "lastMonth": {
      const last = monthRange(addDays(`${month}-01`, -1).slice(0, 7));
      return { ...last, preset: p };
    }
    default:
      return { from: addDays(today, -29), to: today, preset: "30d" };
  }
}
