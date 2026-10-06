import type { Locale } from "../shared";

export interface OrderDraft {
  clientOrderId: string; // UUID made on the device; it is the idempotency key
  tableId: string;
  source: "qr" | "staff";
  guestLanguage: Locale;
  lines: {
    itemId: string;
    qty: number;
    modifierOptionIds: string[];
    note?: string;
    participantId?: string;
    shared?: boolean;
  }[];
}

export type SubmitResult =
  | { status: "accepted"; orderId: string; number: number }
  | { status: "queued" }
  | {
      status: "rejected";
      reason: "item_unavailable" | "tab_closed" | "invalid_table" | "validation";
      detail?: string;
    };

export interface OrderQueue {
  submit(draft: OrderDraft): Promise<SubmitResult>;
  pending(): number;
  flush(): Promise<void>;
}

/** Made once per order, before the first attempt, and reused on every retry. */
export function newClientOrderId(): string {
  return crypto.randomUUID();
}
