import { ConnectorNotImplementedError } from "../shared";
import type { RealtimeChannel } from "./types";

/** Supabase Realtime comes in a later pass. */
export const supabaseStubChannel: RealtimeChannel = {
  subscribe() {
    throw new ConnectorNotImplementedError("realtime", "supabase_stub");
  },
};
