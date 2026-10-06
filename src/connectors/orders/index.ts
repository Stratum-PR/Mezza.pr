import { offlineStubQueue } from "./offline-stub";
import { onlineOrderQueue, type PlaceOrderAction } from "./online";
import type { OrderQueue } from "./types";

export * from "./types";
export type { PlaceOrderAction } from "./online";

/**
 * Client-side registry. The implementation name comes from the server (MEZZA_ORDER_QUEUE is not a
 * public variable), passed down by the page that renders the ordering UI.
 */
export function orderQueue(impl: "online" | "offline_stub", placeOrder: PlaceOrderAction): OrderQueue {
  return impl === "online" ? onlineOrderQueue(placeOrder) : offlineStubQueue;
}
