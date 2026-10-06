import "server-only";
import { pickImplementation } from "../shared";
import { stripeStubBilling } from "./stripe-stub";
import { trialOnlyBilling } from "./trial-only";
import type { BillingProvider } from "./types";

export * from "./types";

const impl = pickImplementation("MEZZA_BILLING", ["trial_only", "stripe_stub"] as const, "trial_only");

export function billing(): BillingProvider {
  return impl === "trial_only" ? trialOnlyBilling : stripeStubBilling;
}
