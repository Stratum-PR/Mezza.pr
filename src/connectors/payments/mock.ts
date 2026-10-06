import "server-only";
import { refreshRecentSales } from "@/lib/reports/refresh";
import { insertPayment, recordRefund } from "./store";
import type { PaymentMethod, PaymentProvider } from "./types";

/** Demo-mode card and ATH Móvil: succeed after about 1.5 s with provider_ref mock_… */
export function mockProvider(method: Exclude<PaymentMethod, "cash">): PaymentProvider {
  return {
    method,
    async status() {
      return "connected";
    },
    async createPayment(ctx, input) {
      await new Promise((r) => setTimeout(r, 1500));
      const providerRef = `mock_${method}_${input.idempotencyKey.slice(0, 12)}`;
      const paymentId = await insertPayment(ctx, method, input, { status: "paid", providerRef });
      await refreshRecentSales(ctx.restaurantId);
      return { paymentId, next: { kind: "done" } };
    },
    async refund(ctx, paymentId, amountCents, reason) {
      const refundId = await recordRefund(paymentId, amountCents, reason);
      await refreshRecentSales(ctx.restaurantId);
      return { refundId };
    },
  };
}
