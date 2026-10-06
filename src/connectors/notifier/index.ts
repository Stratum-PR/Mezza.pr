import "server-only";
import { pickImplementation } from "../shared";
import { consoleNotifier } from "./console";
import { resendStubNotifier } from "./resend-stub";
import type { Notifier } from "./types";

export * from "./types";

const impl = pickImplementation("MEZZA_NOTIFIER", ["console", "resend_stub"] as const, "console");

export function notifier(): Notifier {
  return impl === "console" ? consoleNotifier : resendStubNotifier;
}
