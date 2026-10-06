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
    .select("id, status")
    .eq("restaurant_id", ctx.restaurantId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing.data) {
    // Split payments are created (pending, with what they cover) by create_tab_payment first; a
    // provider that settles at once marks that same payment paid.
    if (extra.status === "paid" && existing.data.status === "pending") {
      const { error } = await db
        .from("payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          provider_ref: extra.providerRef ?? null,
        })
        .eq("id", existing.data.id)
        .eq("status", "pending");
      if (error) throw new Error(`payment update failed: ${error.message}`);
    }
    return existing.data.id;
  }
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
