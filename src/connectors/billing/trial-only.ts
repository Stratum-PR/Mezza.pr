import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import type { BillingProvider } from "./types";

/** Pass 1 billing: the 30-day trial, read from the restaurant. No card, no checkout. */
export const trialOnlyBilling: BillingProvider = {
  async current(ctx) {
    const { data, error } = await createAdminClient()
      .from("restaurants")
      .select("plan, status, trial_ends_at")
      .eq("id", ctx.restaurantId)
      .single();
    if (error) throw new Error(`billing lookup failed: ${error.message}`);
    const status = data.status === "paused" ? "past_due" : data.status;
    return { plan: data.plan, status, trialEndsAt: data.trial_ends_at };
  },
};
