export interface RateLimiter {
  limit(key: string, max: number, windowSeconds: number): Promise<{ ok: boolean; retryAfter?: number }>;
}
