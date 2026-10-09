# Billing connector

Contract and plans for Stripe subscriptions: [CONNECTORS.md → billing](../../../CONNECTORS.md#billing).
Only what is local is here.

## Files

- `types.ts`: `BillingProvider` (`current`, optional `startCheckout`).
- `index.ts`: `billing()`, from `MEZZA_BILLING` (`trial_only` default, `stripe_stub`). Server-only.
- `trial-only.ts`: live. Reads `plan`, `status`, `trial_ends_at` from `restaurants` with the
  service-role client; a `paused` restaurant reports `past_due`.
- `stripe-stub.ts`: same `current`; `startCheckout` throws `ConnectorNotImplementedError`.

## Callers

- The Plan page, `app/app/[restaurant]/plan/page.tsx` (owner only, `requireSection(slug, "plan")`).

## Data

- Reads `restaurants`. Writes nothing.

## Tests

- No tests specific to this folder beyond the registry rules in
  [`../shared.test.ts`](../shared.test.ts).
