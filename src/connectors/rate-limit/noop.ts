import type { RateLimiter } from "./types";

/** Always allows. The call sites on guest actions are already in place for a real backend. */
export const noopRateLimiter: RateLimiter = {
  async limit() {
    return { ok: true };
  },
};
