# Staff (`src/lib/staff`)

## What it does

Server actions and loaders for the staff floor: Servicio, Mesas, a single table and Cocina. Orders move
through the kitchen, cash gets confirmed, and managers void, refund and write off. Every money or tab
change goes through a database function that checks the caller's role.

## Entry points

- `floor.ts`: `loadFloor(db, restaurant)`, the live floor. Called by the `servicio`, `mesas` and
  `cocina` pages under `app/app/[restaurant]/`, and by `lib/reports/today.ts` (Inicio).
- `table-detail.ts`: `loadTableDetail`, for `app/app/[restaurant]/mesas/[table]/page.tsx`.
- `actions.ts` (server actions): `advanceOrder`, `toggleSoldOut`, `handleRequest`, `confirmCash`,
  `cancelPendingPayment`, `raiseTabLimit`, `closeOnPos`, `staffPlaceOrder`, `voidLine`,
  `refundPayment`, `logPrintJob`, `registerDevice`. Used by `components/staff/*` (service screen,
  kitchen board, take-order, table detail, live).
- `table-actions.ts` (server actions for Mesas → a table): `moveLine`, `reshareLine`, `staffCharge`,
  `staffStartPlan`, `staffCancelPlan`, `writeOff`, `closeTab`. Used by `components/staff/table-detail.tsx`.

## Data

- Loaders read with the signed-in user's client (RLS applies): `dining_tables`, `tabs`,
  `service_requests`, `orders`, `order_items`, `order_item_shares`, `payments`, `refunds`,
  `tab_participants`, `payment_allocations`, `write_offs`, `split_plan_units`; RPCs `close_idle_tabs`
  and `tab_checkout`.
- RPCs called as the signed-in user (SECURITY DEFINER, granted to `authenticated`, role checked
  inside): `set_order_status` (owner/manager/server/kitchen), `set_item_availability`
  (owner/manager/kitchen), `confirm_cash_payment`, `raise_tab_limit`, `close_tab`, `close_tab_on_pos`,
  `attribute_staff_order`, `move_order_item`, `set_item_shares` (owner/manager/server), `void_line`,
  `write_off`, `record_refund` (owner/manager).
- RPCs called with the service-role client after `requireSection` (and `ownTab` for tab ids):
  `place_order`, `create_tab_payment`, `start_split_plan`, `cancel_split_plan`,
  `cancel_pending_payment` (all service-role only).
- Direct writes: `service_requests` (handled), `print_jobs`, `devices` with the user client;
  `service_requests` with the service role after a cash confirmation.

## Rules

- Every action starts with `requireStaff` or `requireSection` (`lib/auth/staff.ts`).
- Void, refund and write-off are managers and owners only, with a reason (3–300 characters).
- Staff choose what to charge; `create_tab_payment` computes the amount in cents.
- Service-role calls pass the restaurant id from the signed-in context, never from the browser.

## Tests

- Database: `supabase/tests/02_place_order`, `07_participants`, `08_order_limits`, `09_split_engine`,
  `11_staff_tools`, `12_payment_writes`, `15_tab_writes`, `21_one_tab_close`.
- E2E: `tests/e2e/service-flow`, `staff-ui`, `staff-tools`, `manager-tools`, `kitchen-print`,
  `order-limits`, `checkout`.
