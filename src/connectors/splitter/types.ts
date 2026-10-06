import type { Cents } from "../shared";

export type SplitMode = "one" | "even" | "items";

export interface SplitPart {
  participantId: string | null;
  subtotalCents: Cents;
  ivuStateCents: Cents;
  ivuMunicipalCents: Cents;
}

export interface TabSplitter {
  // contract: parts always sum exactly to the tab's subtotal and IVU totals
  split(
    tab: { lines: { participantId: string | null; shared: boolean; lineTotalCents: Cents }[] },
    rates: { stateBps: number; municipalBps: number },
    mode: SplitMode,
    count?: number,
  ): SplitPart[];
}
