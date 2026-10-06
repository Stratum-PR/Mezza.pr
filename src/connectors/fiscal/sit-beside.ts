import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import type { FiscalProvider } from "./types";

/**
 * Fiscal path A: the restaurant still closes each sale on its own fiscal terminal. Mezza reports
 * the total to enter; the server view keeps showing it until someone taps "Cerrado en el POS".
 */
export const sitBesideFiscal: FiscalProvider = {
  mode: "sit_beside",
  async recordSale(ctx, tabId) {
    const { data, error } = await createAdminClient()
      .from("payments")
      .select("amount_cents, ivu_state_cents, ivu_municipal_cents")
      .eq("restaurant_id", ctx.restaurantId)
      .eq("tab_id", tabId)
      .in("status", ["paid", "partially_refunded"]);
    if (error) throw new Error(`fiscal total failed: ${error.message}`);
    // The POS records the sale and its IVU; tips are not part of the fiscal sale.
    const posTotalCents = (data ?? []).reduce(
      (sum, p) => sum + p.amount_cents + p.ivu_state_cents + p.ivu_municipal_cents,
      0,
    );
    return { controlNumber: null, requiresPosEntry: true, posTotalCents };
  },
};
