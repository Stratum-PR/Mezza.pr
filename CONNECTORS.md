# Connectors

Every risky integration sits behind a typed interface in `src/connectors/<name>/`:
`types.ts` (the interface), one file per implementation, and `index.ts` (the registry that picks
the implementation from the environment and rejects unknown values at startup).

Rules:

- Screens and server actions import only from `@/connectors/<name>`. ESLint (`no-restricted-imports`)
  and `tests/unit/client-boundaries.test.ts` enforce it.
- **Stubs** throw `ConnectorNotImplementedError`; the UI catches it (`isNotImplemented`) and shows
  "Disponible pronto / Coming soon", never a crash. Exception today: the realtime stub is never
  called (see realtime).
- **Mocks** load only when `MEZZA_DEMO_MODE=true` and `NODE_ENV !== 'production'`.
- Feature flags (`src/config/flags.ts`) decide what the UI shows; registries decide what runs. A flag
  turns on only after its connector's real implementation passes the tests listed below.

| Connector                  | Env var                                     | In use now                                       | Server/client |
| -------------------------- | ------------------------------------------- | ------------------------------------------------ | ------------- |
| payments (cash, card, ath) | `MEZZA_PAYMENTS_CARD`, `MEZZA_PAYMENTS_ATH` | cash (real), card/ATH `stub` (or `mock` in demo) | server        |
| fiscal                     | `MEZZA_FISCAL`                              | `sit_beside`                                     | server        |
| menu import                | `MEZZA_MENU_IMPORTER`                       | `fixture` in demo mode, else `claude_stub`       | server        |
| printing                   | — (`MEZZA_PRINTER` read by nothing yet)     | `browser` (protocol from the printer row)        | client        |
| orders                     | `MEZZA_ORDER_QUEUE`                         | `online`                                         | client        |
| realtime                   | `MEZZA_REALTIME`                            | `polling`                                        | client        |
| staff session              | — (not built; removed in P3-1)              | own account per person                           | server        |
| splitter                   | —                                           | `standard`; no screen calls it yet               | both          |
| notifier                   | `MEZZA_NOTIFIER`                            | `console`, demo requests only (SMS always stub)  | server        |
| billing                    | `MEZZA_BILLING`                             | `trial_only`                                     | server        |
| rate limit                 | `MEZZA_RATE_LIMIT`                          | `postgres` (default; production sets `noop`)     | server        |

Client-side registries can't read server env vars; the page passes the implementation name down.

## payments

- **Interface:** `PaymentProvider` (`status`, `startOnboarding?`, `createPayment`, `confirm?`, `refund`, `handleWebhook?`).
- **Now:** `cash` inserts a pending payment (idempotent on its key) and returns `staff_confirmation`;
  `confirm` marks it paid and calls `fiscal().recordSale` (result not used); `refund` calls
  `record_refund` as the signed-in manager (role-checked, audited). `mock` card/ATH insert a `paid`
  payment after ~1.5 s with `provider_ref = mock_…` and don't call `fiscal()`. Real card/ATH are
  stubs reporting `not_connected`. Every confirmed payment and refund (cash and mocks) calls `refreshRecentSales` (`src/lib/reports/refresh.ts`), which
  rebuilds the restaurant-local yesterday and today; `/api/cron/refresh-sales` is the safety net.
- **Real implementation must:** Stripe Connect Express onboarding per restaurant; PaymentIntents on
  the connected account with the platform fee; webhook signature checks and dedupe through
  `webhook_events`; ATH Móvil Business payments with keys in Vault; refunds through the provider API
  then `record_refund`.
- **Tests before `cardPayments` / `athPayments`:** webhook replay is idempotent; amounts equal
  subtotal + IVU + tip to the cent; a failed provider call leaves no `paid` row; refunds never exceed
  what was paid; onboarding status survives restarts.

## fiscal

- **Now:** `sit_beside` returns `requiresPosEntry: true` and the POS total (subtotal + IVU, no tip).
  Only cash confirmation calls it, and nothing reads the result: the staff floor
  (`src/lib/staff/floor.ts`) computes the POS total itself, mock card/ATH payments never call it,
  and staff tap "Cerrado en el POS" (`closeOnPos` → RPC `close_tab_on_pos`) to set
  `tabs.pos_closed_at`.
- **Real implementation must:** report each sale to a certified processor (YCS, Evertec) and store
  `fiscal_control_number`.
- **Tests before `fiscalProcessor`:** every paid tab gets a control number exactly once; retries don't
  double-report; the receipt shows the control number.

## menu import

- **Now:** outside demo mode (`mocksAllowed()` false, so always in production) the registry returns
  `claude_stub`, whatever `MEZZA_MENU_IMPORTER` says, and every import shows "coming soon". In demo
  mode `fixture` records the upload and, after ~2.5 s, returns Café Lucía's menu with two
  low-confidence prices and one missing price (exercises review). `needsReview()` would flag them
  but nothing calls it yet.
- **Real implementation must:** read PDFs/photos with the Claude API, extract sections, items, prices,
  modifiers, hotspots and a theme restricted to `src/config/menu-fonts.ts`.
- **Tests before `aiImport`:** output validates against `MenuImportResult`; fonts only from the list;
  hotspots within 0–1; prices never invented (null when unreadable).

## printing

- **Now:** `browser` prints `renderTicketText()` through a hidden print-only frame. Epson ePOS and
  Star WebPRNT are stubs. The driver follows each printer row's `protocol` (kitchen board and cash
  receipt always use `browser`; the Ajustes test print uses the row's). `defaultPrinterProtocol()`
  reads `MEZZA_PRINTER`, but nothing calls it: the printer form defaults to `browser` itself.
- **Real implementation must:** send the same `renderTicketText` output to the printer IP; report
  failures to `print_jobs`.
- **Tests before `networkPrinting`:** golden ticket text at 32/42/48 columns; timeouts become `failed`
  print jobs; reprint is idempotent per job.

## orders

- **Now:** `online` calls the place-order server action, retrying with the same `clientOrderId`.
- **Real implementation must (offline):** queue on device (IndexedDB), service worker, flush on
  reconnect, `synced_at` on the server.
- **Tests before `offlineMode`:** queued orders flush exactly once; double taps still make one order;
  sold-out at flush time is reported to the guest.

## realtime

- **Now:** `polling` asks `/api/events?since=` (staff) or `/api/r/[restaurant]/t/[token]/events`
  (guests) every 4 s while visible, 30 s when hidden. With `MEZZA_REALTIME=supabase_stub` the
  screens skip subscribing instead of calling the stub, so they don't update live and show no
  "coming soon" state.
- **Real implementation must:** Supabase Realtime channels scoped by restaurant (staff) or tab
  (guests), with polling as fallback.
- **Tests before switching:** no cross-tenant events; reconnect resumes from the last event.

## staff session

- **Now:** no connector. Everyone signs in with their own account (`requireStaff()` in
  `src/lib/auth/staff.ts`). The unused `personal_account` / `pin_switch_stub` connector was removed in
  P3-1; PIN switching gets a new connector when it's built.
- **Real implementation must (PIN):** switch users on a shared device with a hashed PIN
  (`memberships.pin_hash`), lockout after failures, audit `pin_reset`.
- **Tests before `pinSwitch`:** wrong PINs lock out; a PIN never crosses restaurants.

## splitter

- **Now:** `standard`: `one` check, `even` (2–20 parts) and `items` (by person, with locked shares;
  the table's lines last), IVU per part by cumulative difference. No screen or action calls it; only
  its property test does. The live math is elsewhere: payments are computed by `create_tab_payment`
  in the database with the same rules, and checkout screens show `tab_checkout`'s numbers and
  `src/lib/guest/group-check.ts`.
- **Contract:** parts always sum exactly to the tab's subtotal and IVU totals, none negative
  (property tests for every mode).
- **Tests before `splitBill`:** the property test passes for every mode (done in pass 2 phase 3);
  `splitBill` is on since phase 4 with the checkout tests (`supabase/tests/10_guest_checkout.test.sql`,
  `tests/e2e/checkout.spec.ts`).
- **Tests before `sharedTab`** (people at a table and locked shares of shared dishes, pass 2 phase 1;
  doesn't use the splitter): `supabase/tests/07_participants.test.sql` and the group-check property
  test (`src/lib/guest/group-check.test.ts`). Payment stays one check until `splitBill`.

## notifier

- **Now:** `console` logs emails; SMS is always a stub. Only the demo request form calls it
  (`demo_request`). The `staff_invite` and `receipt` templates are declared but unused: staff
  invites go through Supabase Auth (`src/lib/team/invite.ts`) and receipts are only shown or printed.
  Supabase's local mail catcher receives auth email.
- **Real implementation must:** send templated, bilingual email (Resend) and SMS receipts with consent.
- **Tests before `smsReceipts`:** no SMS without `guests.consent_at`; templates exist in both languages.

## billing

- **Now:** `trial_only` reads `restaurants.trial_ends_at` and status.
- **Real implementation must:** Stripe subscriptions for Stratum plans and usage fees.

## rate limit

- **Now:** `postgres` is the code default (`.env.example` too): fixed-window counters in
  `public.rate_limits` through `rate_limit_hit`, shared by every app instance; fails closed. `noop`
  allows everything. Production currently sets `MEZZA_RATE_LIMIT=noop`, so every limit below is off
  there; switching it to `postgres` is an owner decision (`docs/OWNER_STEPS.md`).
- **Keys (per minute):** guest orders 5 per phone (device hash), 20 per table, 30 per IP; renames 10
  per phone; service requests 10 per table, 30 per IP; payments 10 per phone (`pay:phone`) and 30
  per table (`pay:table`); even-split plans, start and cancel, 10 per table (`plan:table`). Per hour:
  signup 10 and demo requests 5 per IP.
  The IP comes from `src/lib/client-ip.ts` (platform headers only, never raw `x-forwarded-for`).
- **Later:** `upstash_stub` if Postgres load from counters ever matters; same interface.
- **Tests:** `supabase/tests/08_order_limits.test.sql` (windows, independent keys, bounded keys,
  browsers can't call it).
