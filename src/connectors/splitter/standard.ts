import { computeIvu, distributeCents, ivuForPart } from "@/lib/money";
import type { SplitPart, TabSplitter } from "./types";

/** IVU for parts paid in order: the cumulative difference, so parts add up to the one-check IVU. */
function withIvu(
  parts: { participantId: string | null; subtotalCents: number }[],
  rates: Parameters<typeof computeIvu>[1],
) {
  let paid = 0;
  return parts.map((p): SplitPart => {
    const ivu = ivuForPart(paid, p.subtotalCents, rates);
    paid += p.subtotalCents;
    return { ...p, ivuStateCents: ivu.state, ivuMunicipalCents: ivu.municipal };
  });
}

/**
 * Previews of how a tab divides (for screens); actual payments are computed by create_tab_payment in
 * the database, with the same rules.
 *   one    one check for the table
 *   even   `count` equal parts, leftover cents to the first parts
 *   items  by person: own lines plus locked shares of shared lines; the table's lines (no person, or a
 *          shared line without shares) as a last part with participantId null
 */
export const standardSplitter: TabSplitter = {
  split(tab, rates, mode, count) {
    const subtotal = tab.lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
    if (mode === "one") {
      const ivu = computeIvu(subtotal, rates);
      return [
        {
          participantId: null,
          subtotalCents: subtotal,
          ivuStateCents: ivu.state,
          ivuMunicipalCents: ivu.municipal,
        },
      ];
    }
    if (mode === "even") {
      if (!Number.isInteger(count) || count! < 2 || count! > 20) throw new RangeError("count must be 2–20");
      return withIvu(
        distributeCents(subtotal, count!).map((c) => ({ participantId: null, subtotalCents: c })),
        rates,
      );
    }
    const owed = new Map<string | null, number>();
    const add = (who: string | null, cents: number) => owed.set(who, (owed.get(who) ?? 0) + cents);
    for (const l of tab.lines) {
      if (l.shared && l.shares?.length) for (const s of l.shares) add(s.participantId, s.cents);
      else add(l.shared ? null : l.participantId, l.lineTotalCents);
    }
    const people = [...owed.keys()].filter((k): k is string => k !== null);
    const order: (string | null)[] = owed.has(null) ? [...people, null] : people;
    return withIvu(
      order.map((who) => ({ participantId: who, subtotalCents: owed.get(who)! })),
      rates,
    );
  },
};
