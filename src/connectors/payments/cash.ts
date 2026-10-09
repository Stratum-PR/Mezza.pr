import "server-only";
import { fiscal } from "@/connectors/fiscal";
import { createClient } from "@/lib/db/server";
import { refreshRecentSales } from "@/lib/reports/refresh";
import { insertPayment, recordRefund } from "./store";
import type { PaymentProvider } from "./types";

/** Cash is always available: the guest asks to pay cash and a server confirms it. */
export const cashProvider: PaymentProvider = {
  method: "cash",
  async status() {
    return "connected";
  },
  async createPayment(ctx, input) {
    const paymentId = await insertPayment(ctx, "cash", input);
    return { paymentId, next: { kind: "staff_confirmation" } };
  },
  /**
   * Staff confirms cash received, as the signed-in server/manager/owner. confirm_cash_payment checks
   * the role and the payment and audits it; staff never write payments directly.
   */
  async confirm(ctx, paymentId) {
    const supabase = await createClient();
    const { data: tabId, error } = await supabase.rpc("confirm_cash_payment", { p_payment_id: paymentId });
    if (error) throw new Error(`cash confirmation failed: ${error.message}`);
    if (!tabId) return; // already confirmed or lapsed
    await fiscal().recordSale(ctx, tabId);
    await refreshRecentSales(ctx.restaurantId);
  },
  async refund(ctx, paymentId, amountCents, reason) {
    const refundId = await recordRefund(paymentId, amountCents, reason);
    await refreshRecentSales(ctx.restaurantId);
    return { refundId };
  },
};
