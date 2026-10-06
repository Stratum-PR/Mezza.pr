import { ConnectorNotImplementedError } from "../shared";
import type { OrderQueue } from "./types";

/** Offline queue, service worker and on-device database come in a later pass. */
export const offlineStubQueue: OrderQueue = {
  async submit() {
    throw new ConnectorNotImplementedError("orderQueue", "offline_stub");
  },
  pending: () => 0,
  async flush() {
    throw new ConnectorNotImplementedError("orderQueue", "offline_stub");
  },
};
