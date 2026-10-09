import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * The phone's person on this tab: the participant whose device hash (scoped to the tab) is this
 * phone's, or null when it never joined (no order or payment yet) or the lookup fails. Read-only:
 * unlike ensure_participant it never creates one, so it can gate actions only participants may take.
 */
export async function tabParticipant(
  db: SupabaseClient<Database>,
  tabId: string,
  device: string | null,
): Promise<string | null> {
  if (!device) return null;
  const { data, error } = await db
    .from("tab_participants")
    .select("id")
    .eq("tab_id", tabId)
    .eq("device_hash", device)
    .maybeSingle();
  return error ? null : (data?.id ?? null);
}
