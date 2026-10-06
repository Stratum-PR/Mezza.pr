import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import { localParts, addDays } from "./time";

/**
 * Rebuilds the sales summaries around now. Runs after every confirmed payment and refund, and from
 * the cron route. The window spans the restaurant's local yesterday and today, so a payment shortly
 * after midnight still lands on the right day and late corrections are picked up.
 */
export async function refreshRecentSales(restaurantId: string, days = 2): Promise<void> {
  const db = createAdminClient();
  const { data: restaurant } = await db
    .from("restaurants")
    .select("timezone")
    .eq("id", restaurantId)
    .single();
  const today = localParts(new Date(), restaurant?.timezone ?? "America/Puerto_Rico").ymd;
  const { error } = await db.rpc("refresh_sales_summaries", {
    p_restaurant_id: restaurantId,
    p_from: addDays(today, -(days - 1)),
    p_to: today,
  });
  if (error) throw new Error(`summary refresh failed: ${error.message}`);
}
