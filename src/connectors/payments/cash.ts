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
  /** Staff confirms cash received (signed-in server/manager/owner; RLS checks the role). */
  async confirm(ctx, paymentId) {
    const supabase = await createClient();
    const { data: payment, error } = await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString(), confirmed_by: ctx.actorUserId ?? null })
      .eq("id", paymentId)
      .eq("status", "pending")
      .select("tab_id")
      .maybeSingle();
    if (error) throw new Error(`cash confirmation failed: ${error.message}`);
    if (!payment) return; // already confirmed, or not visible to this user
    await fiscal().recordSale(ctx, payment.tab_id);
    await refreshRecentSales(ctx.restaurantId);
  },
  async refund(ctx, paymentId, amountCents, reason) {
    const refundId = await recordRefund(paymentId, amountCents, reason);
    await refreshRecentSales(ctx.restaurantId);
    return { refundId };
  },
};
