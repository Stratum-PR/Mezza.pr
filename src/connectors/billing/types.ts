import type { Ctx } from "../shared";

export interface BillingProvider {
  current(ctx: Ctx): Promise<{
    plan: string;
    status: "trial" | "active" | "past_due" | "cancelled";
    trialEndsAt: string | null;
  }>;
  startCheckout?(ctx: Ctx, planId: string): Promise<{ url: string }>;
}
