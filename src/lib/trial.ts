/** Whole days left until `endsAt` (never negative), or null when there's no trial end. */
export function trialDaysLeft(endsAt: string | null, now: number = Date.now()): number | null {
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 86_400_000));
}
