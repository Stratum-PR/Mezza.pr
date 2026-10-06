import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import type { RateLimiter } from "./types";

/**
 * Fixed-window counters in Postgres (`rate_limit_hit`), shared by every app instance. Fails closed:
 * if the counter can't be read, the request is refused (it never authorizes a write).
 */
export const postgresRateLimiter: RateLimiter = {
  async limit(key, max, windowSeconds) {
    const { data, error } = await createAdminClient().rpc("rate_limit_hit", {
      p_key: key.slice(0, 200),
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    return !error && data ? { ok: true } : { ok: false, retryAfter: windowSeconds };
  },
};
