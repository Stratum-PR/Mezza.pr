import "server-only";
import { pickImplementation } from "../shared";
import { noopRateLimiter } from "./noop";
import type { RateLimiter } from "./types";
import { upstashStubRateLimiter } from "./upstash-stub";

export * from "./types";

const impl = pickImplementation("MEZZA_RATE_LIMIT", ["noop", "upstash_stub"] as const, "noop");

export function rateLimiter(): RateLimiter {
  return impl === "noop" ? noopRateLimiter : upstashStubRateLimiter;
}
