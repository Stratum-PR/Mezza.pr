# Guest (`src/lib/guest`)

## What it does

Server helpers for the guest's phone at a table: resolve a printed QR token to its table, find or open
the table's one live tab, identify the phone by a hashed device cookie, and build what the phone shows
(orders, people, totals, checkout). Also pure helpers for names and the per-person check.

## Entry points

- `resolve.ts`: `resolveTable` (token → restaurant and table), `liveTab`, `ensureTab`. Called by the
  guest page [`app/r/[restaurant]/t/[token]/page.tsx`](../../app/r/[restaurant]/t/[token]/page.tsx),
  its server actions [`actions.ts`](../../app/r/[restaurant]/t/[token]/actions.ts) and the guest
  events route `app/api/r/[restaurant]/t/[token]/events/route.ts`.
- `status.ts`: `guestStatus`, behind the `guestStatus` and `guestReceipt` server actions.
- `device.ts`: `deviceHash` (reads) and `ensureDeviceHash` (server actions; sets the cookie if
  missing). `device-cookie.ts` holds the cookie name and options, shared with `src/proxy.ts`.
- `names.ts`: `cleanName`, `participantLabel`. `group-check.ts`: `groupCheck`. Both pure; also used
  by `components/guest/guest-app.tsx` and the staff table screen.

The guest server actions (`guestPlaceOrder`, `guestRename`, `guestRequest`, `guestPay`,
`guestCancelPayment`, `guestStartPlan`, `guestCancelPlan`, `guestReceipt`) live in the route's
`actions.ts`, not here.

## Data

- Reads `dining_tables` (by `qr_token_hash`) with `restaurants`, `tabs`, `orders`, `order_items`,
  `order_item_shares`, `service_requests`, `payments`, `tab_participants`. `ensureTab` inserts into
  `tabs`; the guest actions insert `service_requests`.
- RPCs from this folder: `close_idle_tabs` (SECURITY DEFINER; authenticated staff or service role) and
  `tab_checkout` (SECURITY INVOKER; authenticated, service role).
- RPCs from the guest actions, all SECURITY DEFINER and executable only by `service_role`:
  `place_guest_order`, `rename_participant`, `ensure_participant`, `create_tab_payment`,
  `cancel_pending_payment`, `start_split_plan`, `cancel_split_plan`, `rate_limit_hit` (through the
  rate-limit connector).

## Rules

- Guests have no session, so every guest read and write uses the service-role client, and only after
  `resolveTable` matched `sha256(token)` to the table.
- Only the device cookie's sha256 is stored (`tab_participants.device_hash`), scoped to the tab.
- Names are optional labels, never identity: staff-like words and "Invitado"/"guest" are blocked, and
  `#n` always shows.
- The phone sends an option (mine, person, balance, plan), never an amount; `create_tab_payment`
  computes the money. Totals here are integer cents with IVU from `@/lib/money`.
- `groupCheck` groups always add up to the table subtotal.

## Tests

- Unit: [`names.test.ts`](names.test.ts), [`group-check.test.ts`](group-check.test.ts) (property test).
- Database: `supabase/tests/07_participants`, `08_order_limits`, `09_split_engine`,
  `10_guest_checkout`, `15_tab_writes`, `21_one_tab_close`.
- E2E: `tests/e2e/guest`, `guest-polish`, `shared-tab`, `checkout`, `split-edge-cases`,
  `order-limits`.
