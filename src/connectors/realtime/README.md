# Realtime connector

Contract and what Supabase Realtime must do:
[CONNECTORS.md → realtime](../../../CONNECTORS.md#realtime). Only what is local is here.

## Files

- `types.ts`: `RealtimeChannel.subscribe(scope, types, onEvent)` (returns unsubscribe), `MezzaEvent`,
  `MezzaEventType`.
- `index.ts`: `realtimeChannel(impl, endpoint?)`. Client-side registry; pages pass the name from
  `MEZZA_REALTIME` (`polling` unless set to `supabase_stub`).
- `polling.ts`: live. Fetches `endpoint?since=&restaurant=&types=` every 4 s while visible, 30 s when
  hidden, and at once when the page becomes visible; advances `since` by event time.
- `supabase-stub.ts`: throws `ConnectorNotImplementedError`.

## Callers

- Staff: `components/staff/live.tsx` (`useLiveRefresh`, used by the service screen, the kitchen
  board and, through `live-refresh.tsx`, Mesas, a table and Inicio) polls `/api/events`, which scopes events by the signed-in user's RLS.
  The `restaurant` parameter it sends is the slug.
- Guests: `components/guest/guest-app.tsx` polls `/api/r/[restaurant]/t/[token]/events`, which first
  resolves the QR token (`lib/guest/resolve.ts`).
- With `supabase_stub`, both components skip subscribing instead of calling the stub.

## Data

- None here; the two event routes derive events from `updated_at` columns.

## Tests

- No unit test for this folder. Live updates are exercised by the E2E specs that wait on another
  screen, e.g. `tests/e2e/service-flow`, `shared-tab`, `checkout`.
