import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";
import type { Database } from "./types";

/**
 * Service-role client: bypasses row-level security. Server code only, after it has checked who is
 * calling (guest pages resolve the QR token first; staff actions check the role).
 * A unit test fails if any 'use client' file imports this module.
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
