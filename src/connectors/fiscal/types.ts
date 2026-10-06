import type { Cents, Ctx } from "../shared";

export interface FiscalProvider {
  mode: "sit_beside" | "processor";
  recordSale(
    ctx: Ctx,
    tabId: string,
  ): Promise<{ controlNumber: string | null; requiresPosEntry: boolean; posTotalCents: Cents }>;
}
