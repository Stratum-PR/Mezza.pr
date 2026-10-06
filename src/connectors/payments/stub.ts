import { ConnectorNotImplementedError } from "../shared";
import type { PaymentMethod, PaymentProvider } from "./types";

/** Real Stripe Connect and ATH Móvil come in a later pass. Status says "not connected". */
export function stubProvider(
  method: Exclude<PaymentMethod, "cash">,
  implementation: string,
): PaymentProvider {
  const fail = (): never => {
    throw new ConnectorNotImplementedError(`payments.${method}`, implementation);
  };
  return {
    method,
    async status() {
      return "not_connected";
    },
    async startOnboarding() {
      return fail();
    },
    async createPayment() {
      return fail();
    },
    async refund() {
      return fail();
    },
  };
}
