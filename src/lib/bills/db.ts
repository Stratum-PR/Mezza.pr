import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/db/admin";
import type { Database, Json } from "@/lib/db/types";

// Extend the checked-in schema while the migration is staged, keeping RPC arguments typed.
type BillsDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Functions"> & {
    Functions: Database["public"]["Functions"] & {
      visit_financial_summary: {
        Args: { p_restaurant: string; p_actor: string; p_from: string; p_to: string };
        Returns: Json;
      };
      visit_workflow: {
        Args: {
          p_op: string;
          p_table?: string;
          p_tab?: string;
          p_actor?: string;
          p_secret_hash?: string;
          p_data?: Json;
        };
        Returns: Json;
      };
      visit_rate_limit: { Args: { p_key: string; p_max: number; p_seconds: number }; Returns: boolean };
      visit_snapshot: { Args: { p_tab: string }; Returns: Json };
      visit_private_receipts: { Args: { p_hash: string; p_table: string }; Returns: Json };
      visit_claim_recovery: {
        Args: { p_ticket_hash: string; p_table: string; p_secret_hash: string; p_receipt_hash: string };
        Returns: Json;
      };
    };
  };
};
export const billsDb = () => createAdminClient() as unknown as SupabaseClient<BillsDatabase>;
export async function workflow<T>(
  args: BillsDatabase["public"]["Functions"]["visit_workflow"]["Args"],
): Promise<T> {
  const { data, error } = await billsDb().rpc("visit_workflow", args);
  if (error || !data) throw new Error(error?.message ?? "failed");
  return data as unknown as T;
}
