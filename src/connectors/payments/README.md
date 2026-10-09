# Payments connector

Contract, current behavior and the tests required before card/ATH go live:
[CONNECTORS.md → payments](../../../CONNECTORS.md#payments). Only what is local is here.

## Files

- `types.ts`: `PaymentProvider`, `CreatePaymentInput`, `PaymentMethod`.
- `index.ts`: `payments()` (cash is always `cashProvider`; card and ATH follow `MEZZA_PAYMENTS_CARD`
  and `MEZZA_PAYMENTS_ATH`, `stub` by default, `mock` only with demo mode) and `availableMethods(ctx)`
  (connected card/ATH first, cash always last). Server-only.
- `cash.ts`: live for cash. `mock.ts`: demo card/ATH. `stub.ts`: real card/ATH (status
  `not_connected`, everything else throws `ConnectorNotImplementedError`).
- `store.ts`: `insertPayment` (service-role client) and `recordRefund` (user client, RPC
  `record_refund`), shared by cash and mock.

## Callers

- Guest `guestPay` / `guestPaymentMethods` (`app/r/[restaurant]/t/[token]/actions.ts`): after
  `create_tab_payment` has created the pending payment and its amounts, `createPayment` finds it by
  idempotency key (mock marks it paid).
- Staff `confirmCash` and `refundPayment` (`lib/staff/actions.ts`).
- Settings and the setup wizard read `status` / `startOnboarding` (`app/app/[restaurant]/ajustes`,
  `empezar`).

## Data

- Writes `payments` (insert or pending → paid) with the service role.
- RPCs: `confirm_cash_payment` (SECURITY DEFINER, `authenticated`; owner/manager/server; writes
  `payments`, `audit_log`) and `record_refund` (SECURITY DEFINER, `authenticated`; owner/manager;
  writes `refunds`, `payments`, `audit_log`).
- After a confirmed payment or refund: `refreshRecentSales` (`lib/reports/refresh.ts`); cash confirm
  also calls `fiscal().recordSale`.

## Tests

- Database: `supabase/tests/09_split_engine`, `10_guest_checkout`, `12_payment_writes`.
- E2E: `tests/e2e/checkout`, `split-edge-cases`, `service-flow`, `manager-tools`.
- Registry rules: [`../shared.test.ts`](../shared.test.ts).
