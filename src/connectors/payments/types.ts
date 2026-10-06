import type { Cents, Ctx } from "../shared";

export type PaymentMethod = "card" | "ath" | "cash";
export type ProviderStatus = "not_connected" | "pending" | "connected" | "unavailable";

export interface CreatePaymentInput {
  tabId: string;
  participantId?: string;
  idempotencyKey: string;
  amountCents: Cents;
  tipCents: Cents;
  ivuStateCents: Cents;
  ivuMunicipalCents: Cents;
  returnUrl: string;
}

export type PaymentNext =
  | { kind: "done" }
  | { kind: "staff_confirmation" } // cash
  | { kind: "client_secret"; secret: string } // card form (future)
  | { kind: "external_app"; reference: string }; // ATH Móvil (future)

export interface PaymentProvider {
  method: PaymentMethod;
  status(ctx: Ctx): Promise<ProviderStatus>;
  startOnboarding?(ctx: Ctx, returnUrl: string): Promise<{ url: string }>;
  createPayment(ctx: Ctx, input: CreatePaymentInput): Promise<{ paymentId: string; next: PaymentNext }>;
  confirm?(ctx: Ctx, paymentId: string): Promise<void>;
  refund(ctx: Ctx, paymentId: string, amountCents: Cents, reason: string): Promise<{ refundId: string }>;
  handleWebhook?(rawBody: string, headers: Headers): Promise<{ eventId: string; handled: boolean }>;
}
