import "server-only";
import { ConnectorNotImplementedError } from "../shared";
import { trialOnlyBilling } from "./trial-only";
import type { BillingProvider } from "./types";

/** Stratum subscription billing through Stripe comes in a later pass. */
export const stripeStubBilling: BillingProvider = {
  current: trialOnlyBilling.current,
  async startCheckout() {
    throw new ConnectorNotImplementedError("billing", "stripe_stub");
  },
};
