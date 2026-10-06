import "server-only";
import { pickImplementation } from "../shared";
import { personalAccountSession } from "./personal-account";
import { pinSwitchStubSession } from "./pin-switch-stub";
import type { StaffSession } from "./types";

export * from "./types";

const impl = pickImplementation(
  "MEZZA_STAFF_SESSION",
  ["personal_account", "pin_switch_stub"] as const,
  "personal_account",
);

export function staffSession(restaurantSlug: string): StaffSession {
  return impl === "personal_account"
    ? personalAccountSession(restaurantSlug)
    : pinSwitchStubSession(restaurantSlug);
}
