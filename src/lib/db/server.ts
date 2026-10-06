import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Supabase client for Server Components, Server Actions and Route Handlers, acting as the signed-in
 * user (row-level security applies). Create one per request.
 */
export async function createClient() {
  const store = await cookies();
  return createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) store.set(name, value, options);
          } catch {
            // Server Components can't set cookies; the proxy refreshes the session instead.
          }
        },
      },
    },
  );
}
