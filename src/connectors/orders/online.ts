import type { OrderDraft, OrderQueue, SubmitResult } from "./types";

export type PlaceOrderAction = (draft: OrderDraft) => Promise<SubmitResult>;

/**
 * Online queue: sends the draft through the place-order server action. Network failures are
 * retried with the same clientOrderId, so a retry (or a double tap) can never create two orders.
 */
export function onlineOrderQueue(placeOrder: PlaceOrderAction, retries = 2): OrderQueue {
  return {
    async submit(draft) {
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await placeOrder(draft);
        } catch (error) {
          lastError = error;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      throw lastError;
    },
    pending: () => 0,
    flush: async () => undefined,
  };
}
