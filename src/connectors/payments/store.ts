import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import type { Ctx } from "../shared";
import type { CreatePaymentInput, PaymentMethod } from "./types";

/**
 * Shared payment writes. Guests have no session, so new payments are inserted with the service
 * role after server code resolved the table. Refunds run as the signed-in manager so
 * record_refund can check the role and audit the actor.
 */
export async function insertPayment(
  ctx: Ctx,
  method: PaymentMethod,
  input: CreatePaymentInput,
  extra: { status?: "pending" | "paid"; providerRef?: string } = {},
): Promise<string> {
  const db = createAdminClient();
  const existing = await db
    .from("payments")
    .select("id")
    .eq("restaurant_id", ctx.restaurantId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing.data) return existing.data.id;
  const { data, error } = await db
    .from("payments")
    .insert({
      restaurant_id: ctx.restaurantId,
      tab_id: input.tabId,
      participant_id: input.participantId ?? null,
      method,
      amount_cents: input.amountCents,
      tip_cents: input.tipCents,
      ivu_state_cents: input.ivuStateCents,
      ivu_municipal_cents: input.ivuMunicipalCents,
      idempotency_key: input.idempotencyKey,
      status: extra.status ?? "pending",
      provider_ref: extra.providerRef ?? null,
      paid_at: extra.status === "paid" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`payment insert failed: ${error.message}`);
  return data.id;
}

export async function recordRefund(paymentId: string, amountCents: number, reason: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_refund", {
    p_payment_id: paymentId,
    p_amount_cents: amountCents,
    p_reason: reason,
  });
  if (error) throw new Error(`refund failed: ${error.message}`);
  return data;
}
