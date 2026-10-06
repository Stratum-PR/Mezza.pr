import { pollingChannel } from "./polling";
import { supabaseStubChannel } from "./supabase-stub";
import type { RealtimeChannel } from "./types";

export * from "./types";

/** Client-side registry; the implementation name (MEZZA_REALTIME) is passed down from the server. */
export function realtimeChannel(impl: "polling" | "supabase_stub", endpoint?: string): RealtimeChannel {
  return impl === "polling" ? pollingChannel(endpoint) : supabaseStubChannel;
}
