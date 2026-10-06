export type MezzaEventType =
  | "order.created"
  | "order.updated"
  | "service_request.created"
  | "service_request.updated"
  | "payment.updated"
  | "item.availability";

export interface MezzaEvent {
  type: MezzaEventType;
  restaurantId: string;
  entityId: string;
  at: string;
}

export interface RealtimeChannel {
  subscribe(
    scope: { restaurantId: string; tabId?: string },
    types: MezzaEventType[],
    onEvent: (e: MezzaEvent) => void,
  ): () => void; // returns unsubscribe
}
