# Orders connector

Contract and what the offline queue must do: [CONNECTORS.md → orders](../../../CONNECTORS.md#orders).
Only what is local is here.

## Files

- `types.ts`: `OrderDraft`, `SubmitResult`, `OrderQueue`, and `newClientOrderId()` (one UUID per
  order, reused on every retry).
- `index.ts`: `orderQueue(impl, placeOrder)`. Client-side registry: the page passes the name
  (`MEZZA_ORDER_QUEUE`, `online` unless set to `offline_stub`) and the server action.
- `online.ts`: live. Calls the action, retrying twice (400 ms, 800 ms) with the same `clientOrderId`.
- `offline-stub.ts`: `submit` and `flush` throw `ConnectorNotImplementedError`.

## Callers

- `components/guest/guest-app.tsx`: `orderQueue(queueImpl, draft => guestPlaceOrder(...))`; the impl
  comes from `app/r/[restaurant]/t/[token]/page.tsx`.
- `components/staff/take-order.tsx` uses only `newClientOrderId` and calls `staffPlaceOrder` directly.

## Data

- None here. The server action calls `place_guest_order` (guests) or `place_order` (staff), both
  SECURITY DEFINER and `service_role` only, idempotent on `client_order_id`.

## Tests

- Unit: [`online.test.ts`](online.test.ts) (same id on retry; gives up after the retries).
- Database: `supabase/tests/02_place_order` (idempotency), `07_participants`, `08_order_limits`.
- E2E: `tests/e2e/guest` (a double tap makes one order).
