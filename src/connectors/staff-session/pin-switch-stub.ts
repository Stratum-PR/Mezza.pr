import "server-only";
import { ConnectorNotImplementedError } from "../shared";
import { personalAccountSession } from "./personal-account";
import type { StaffSession } from "./types";

/** PIN switching on shared devices comes in a later pass; sign-in still works per person. */
export function pinSwitchStubSession(restaurantSlug: string): StaffSession {
  return {
    ...personalAccountSession(restaurantSlug),
    async switchWithPin() {
      throw new ConnectorNotImplementedError("staffSession", "pin_switch_stub");
    },
    async setPin() {
      throw new ConnectorNotImplementedError("staffSession", "pin_switch_stub");
    },
  };
}
