# Rate limit connector

Contract and the keys and limits in use:
[CONNECTORS.md → rate limit](../../../CONNECTORS.md#rate-limit). Only what is local is here.

## Files

- `types.ts`: `RateLimiter.limit(key, max, windowSeconds)`.
- `index.ts`: `rateLimiter()`, from `MEZZA_RATE_LIMIT` (`postgres` default, `noop`, `upstash_stub`).
  Server-only.
- `postgres.ts`: live. Calls RPC `rate_limit_hit` with the service-role client (key cut to 200
  characters); any error counts as refused (fails closed).
- `noop.ts`: always allows. `upstash-stub.ts`: throws `ConnectorNotImplementedError`.

## Callers

- Guest actions, `app/r/[restaurant]/t/[token]/actions.ts`: orders, renames, service requests,
  payments (`pay:phone` 10, `pay:table` 30 per minute) and even-split plans (`plan:table` 10).
- `signUp` (`lib/auth/signup.ts`) and the demo request (`app/[locale]/demo/actions.ts`).
- The client IP comes from `lib/client-ip.ts`.

## Data

- `rate_limit_hit`: SECURITY DEFINER, `service_role` only; fixed-window counters in
  `public.rate_limits`.

## Tests

- Database: `supabase/tests/08_order_limits` (windows, independent keys, browsers can't call it).
- Unit: mocked in [`../../lib/auth/signup.test.ts`](../../lib/auth/signup.test.ts); registry rules in
  [`../shared.test.ts`](../shared.test.ts).
