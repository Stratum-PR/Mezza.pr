# Notifier connector

Contract and what the real email/SMS sender must do:
[CONNECTORS.md → notifier](../../../CONNECTORS.md#notifier). Only what is local is here.

## Files

- `types.ts`: `Notifier` (`email` with templates `staff_invite`, `demo_request`, `receipt`; optional
  `sms`).
- `index.ts`: `notifier()`, from `MEZZA_NOTIFIER` (`console` default, `resend_stub`). Server-only.
- `console.ts`: live. Logs the email with `console.info`; `sms` throws `ConnectorNotImplementedError`.
- `resend-stub.ts`: both methods throw `ConnectorNotImplementedError`.

## Callers

- Only the demo request form, `app/[locale]/demo/actions.ts` (`demo_request` template). Staff
  invites go through Supabase Auth (`lib/team/invite.ts`), not this connector.

## Data

- None.

## Tests

- E2E: `tests/e2e/site` (a demo request is saved and acknowledged). Registry rules in
  [`../shared.test.ts`](../shared.test.ts).
