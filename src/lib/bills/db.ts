import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import type { Database } from "@/lib/db/types";

export const billsDb = createAdminClient;
export async function workflow<T>(
  args: Database["public"]["Functions"]["visit_workflow"]["Args"],
): Promise<T> {
  const { data, error } = await billsDb().rpc("visit_workflow", args);
  if (error || !data) throw new Error(error?.message ?? "failed");
  return data as unknown as T;
}
