import "server-only";
import { pickImplementation } from "../shared";
import { noopRateLimiter } from "./noop";
import { postgresRateLimiter } from "./postgres";
import type { RateLimiter } from "./types";
import { upstashStubRateLimiter } from "./upstash-stub";

export * from "./types";

const impl = pickImplementation(
  "MEZZA_RATE_LIMIT",
  ["postgres", "noop", "upstash_stub"] as const,
  "postgres",
);

export function rateLimiter(): RateLimiter {
  return impl === "postgres"
    ? postgresRateLimiter
    : impl === "noop"
      ? noopRateLimiter
      : upstashStubRateLimiter;
}
