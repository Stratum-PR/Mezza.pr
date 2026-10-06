"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/db/admin";
import type { FormResult } from "@/lib/settings/actions";

const schema = z.object({
  restaurantId: z.uuid(),
  reason: z.string().trim().min(5).max(500),
  hours: z.coerce.number().int().min(1).max(72),
});

/**
 * Stratum asks for time-limited support access. It stays inactive until the owner approves it in
 * Ajustes. Every request is logged. (Actual impersonation comes in a later pass.)
 */
export async function requestSupport(_: FormResult, form: FormData): Promise<FormResult> {
  const userId = await requirePlatformAdmin();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: "validation" };
  const db = createAdminClient();
  const { data, error } = await db
    .from("support_access_grants")
    .insert({
      restaurant_id: parsed.data.restaurantId,
      requested_by: userId,
      reason: parsed.data.reason,
      expires_at: new Date(Date.now() + parsed.data.hours * 3600_000).toISOString(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: "failed" };
  await db.from("audit_log").insert({
    restaurant_id: parsed.data.restaurantId,
    actor_id: userId,
    action: "support_access",
    target_table: "support_access_grants",
    target_id: data.id,
    after: { requested: true, hours: parsed.data.hours, reason: parsed.data.reason },
  });
  revalidatePath("/admin");
  return { ok: true, code: "requested" };
}
