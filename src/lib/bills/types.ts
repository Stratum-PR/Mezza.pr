import type { CartLine } from "@/components/menu/item-sheet";
import type { Allocation, BillLine } from "./allocation";
export interface VisitState {
  id: string;
  tableId: string;
  status: "open" | "paying" | "closed";
  revision: number;
  orderingPaused: boolean;
  participants: {
    id: string;
    name: string;
    removed: boolean;
    draft: { version: number; lines: CartLine[] };
  }[];
  requests: {
    id: string;
    participantId: string;
    name: string;
    status: string;
    lines: CartLine[];
    createdAt: string;
  }[];
  lines: BillLine[];
  tax: { state: number; municipal: number };
  portions: (Allocation & {
    id: string;
    status: "unpaid" | "paid" | "written_off";
    paymentId: string | null;
    payerName: string | null;
  })[];
}
export interface GuestVisit {
  participantId: string;
  expiresAt: string;
  visit: VisitState;
}

export interface VisitReceipt {
  paymentStatus: string;
  refundCents: number;
  paymentId: string;
  restaurant: string;
  paidAt: string;
  subtotalCents: number;
  stateCents: number;
  municipalCents: number;
  tipCents: number;
  portions: { label: string; lines: Allocation["lines"] }[];
}
export type BillResult<T> = { ok: true; data: T } | { ok: false; error: string };
