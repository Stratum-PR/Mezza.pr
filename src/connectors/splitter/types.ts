import type { Cents } from "../shared";

type SplitMode = "one" | "even" | "items";

export interface SplitPart {
  participantId: string | null;
  subtotalCents: Cents;
  ivuStateCents: Cents;
  ivuMunicipalCents: Cents;
}

export interface SplitLine {
  participantId: string | null;
  shared: boolean;
  lineTotalCents: Cents;
  /** Locked shares of a shared line (order_item_shares); they sum to lineTotalCents. */
  shares?: { participantId: string; cents: Cents }[];
}

export interface TabSplitter {
  // contract: parts always sum exactly to the tab's subtotal and IVU totals
  split(
    tab: { lines: SplitLine[] },
    rates: { stateBps: number; municipalBps: number },
    mode: SplitMode,
    count?: number,
  ): SplitPart[];
}
