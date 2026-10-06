import { ConnectorNotImplementedError } from "../shared";
import type { RateLimiter } from "./types";

export const upstashStubRateLimiter: RateLimiter = {
  async limit() {
    throw new ConnectorNotImplementedError("rateLimit", "upstash_stub");
  },
};
