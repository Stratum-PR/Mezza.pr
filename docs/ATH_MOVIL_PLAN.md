# ATH Móvil plan (agreed 2026-10-07, revised the same day)

> **Shared document.** Identical copies live in `Stratum-PR/Mezza.pr`, `Stratum-PR/pet-hub` (Grumi) and `Stratum-PR/payment_methods`, at the same path. Change all three together. Each platform implements its own section and the security items in `docs/PAYMENTS_SECURITY_REVIEW.md`.

ATH Móvil payments for Mezza through the shared private package `@stratum-pr/payments` (`Stratum-PR/payment_methods`, Genesis's design). The package also contains Stripe code, but neither app uses it: Stripe is built on Stripe's official SDK in each app (`docs/STRIPE_PLAN.md`). Grumi (`Stratum-PR/pet-hub`) already charges ATH Móvil with it on `dev`. This plan covers what the package still needs and the Mezza adapter (pass 3). Nothing is built in Mezza yet.

**Revised 2026-10-07 (user decision):** the earlier idea of a separate public `athmovil` package is dropped; Mezza adopts `@stratum-pr/payments`. Before building, read [PAYMENTS_SECURITY_REVIEW.md](PAYMENTS_SECURITY_REVIEW.md): the package items (P-1 to P-13) and Mezza's (M-1 to M-4) are part of this plan.

Sources: [ATHM-Payment-Button-API](https://github.com/evertec/ATHM-Payment-Button-API) (REST), [athmovil-webhooks](https://github.com/evertec/athmovil-webhooks), [athmovil-javascript-api](https://github.com/evertec/athmovil-javascript-api) (browser button, not used), [ath.business/botondepago](https://ath.business/en/botondepago).

## What ATH Móvil gives us

- `POST /payment` (server, public token): total, the **customer's** ATH phone number, timeout 120–600 s, optional subtotal/tax/items, `metadata1`/`metadata2` (40 chars each). Returns `ecommerceId` and an `auth_token` (JWT). The customer gets a push in the ATH Móvil app.
- Status: `OPEN` → `CONFIRM` (customer approved) → `COMPLETED`, or `CANCEL` (expired or cancelled).
- `POST /authorization` (with `auth_token`): **the merchant must call this after `CONFIRM`** to take the money. Without it the customer approved but nothing was charged.
- `POST /business/findPayment`, `POST /business/cancel`, `PUT /business/updatePhoneNumber`.
- `POST /refund` (public + private token, `referenceNumber`, amount; partial allowed).
- Webhooks: `POST https://www.athmovil.com/transactions/webhook/post` with both tokens, a `listenerURL` and event toggles (`ecommercePaymentReceivedEvent`, `ecommercePaymentCancelledEvent`, `ecommercePaymentExpiredEvent`, `refundSentEvent`, …). **Payloads aren't signed** and retries aren't documented.
- Limits: $1.00–$1,500.00 per payment. No tip field (the tip is part of the total). No idempotency key on `/payment`.
- **No sandbox.** Testing uses a real ATH Business account, real money and a refund.

## Design rules (both apps)

1. **Server-side REST only.** The JS button sets `total` in the browser, which breaks Mezza's rule that the browser never sends an amount to charge. The server creates the payment and the app shows its own waiting screen.
2. **A webhook is a hint.** Any webhook only triggers `settle()`, which reads the real status from `findPayment`. The listener URL carries a per-business random secret, since ATH doesn't sign webhooks.
3. **`settle()` is the only path to "paid"**, and running it again is harmless. Three things call it: the waiting phone polling every few seconds, the webhook and a cron sweeper. Whichever comes first wins. It calls `findPayment` with **our stored** `ecommerceId` and the business's stored keys, never ids from the webhook body, and checks status, total to the cent and `metadata2` = our payment id.
4. **Never retry `/payment` blindly.** There's no idempotency key, so a timeout on create may mean a live payment exists. Look it up by `metadata2` (our payment id) through `findPayment` or search, or cancel it, before trying again.
5. **Tokens belong to each business.** Each business has its own public + private token and its own webhook subscription. Tokens are passed into every call and stored encrypted per business, never in env vars.
6. **The customer's phone number is used for the request and not stored.**
7. **Money rows are written by the server only.** No signed-in browser role can insert or update payments, refunds, payment accounts or ATH keys; staff actions go through server code that checks the role (same as the Stripe plan's rule 10).
8. **Reconcile daily.** Compare our paid ATH payments and refunds with ATH's records (`findPayment` / the transaction report) and flag differences.

## Separate Docker test environments (required, user request 2026-10-07)

Each repo tests in its own Docker environment, so the package, Mezza and Grumi never share a database, ports or containers on the same machine. Each one runs with one command, and continuous integration runs the same setup.

| Repo | Docker environment | Ports |
|---|---|---|
| `payment_methods` (package `@stratum-pr/payments`) | `docker compose` with a Node 20, a Node 22 and a Deno service running the test suite and a smoke test against the build, plus a Supabase edge-runtime service (the version the Supabase CLI uses) running a sample Edge Function that imports the build and completes a payment against the fake over HTTP; no database | none published |
| Mezza | Supabase stack `project_id = "mezza"` (exists) | 55320–55329; fake ATH over HTTP on 55330 |
| Grumi | Its own local Supabase stack, separate from the hosted project and from Mezza: its own local `project_id` and port range | proposed 55420–55429; fake ATH on 55430 |

- **The package's ATH Móvil simulator also runs over HTTP** (`simulator/athmovil`, its own port per app). Grumi's Edge Functions run inside Supabase's edge-runtime container, so a test can't hand them a fake `fetch`. Instead they get the fake's base URL (`http://host.docker.internal:55430`) through a function secret. Mezza's E2E uses the same mode.
- **Grumi caution:** `supabase/config.toml` holds the hosted project ref as `project_id`, and it uses the default ports. Before changing either, confirm that linking and deploys use `supabase link` (`supabase/.temp/project-ref`), not `project_id`.
- **Test data is separate from dev data:** each test environment seeds its own test businesses and resets between runs. Nothing in these environments ever uses real ATH tokens.

**When either repo starts:** copy this section and that repo's phases into its own plan file (the package's `PLAN.md`, Grumi's docs), with the Docker test environment as the first task.

## Holding each business's tokens and webhooks (current understanding)

1. The owner opens the **ATH Business app → Settings** and copies the public token and private token. The docs confirm the public token's location. Phase 0 confirms the private token's.
2. The owner pastes both into Mezza → Ajustes → Pagos → ATH Móvil.
3. Mezza checks them with a harmless call, for example `findPayment` on an id that doesn't exist: a "not found" error means the token is valid, `token.invalid…` means it isn't. Phase 0 confirms which errors come back.
4. Mezza stores them encrypted (Supabase Vault) and calls the webhook subscription service with them and `https://<domain>/api/webhooks/ath/<restaurant-id>/<secret>`.
5. Status becomes "connected" and ATH shows on guest checkout (`athPayments` flag).

The docs don't say whether subscribing again overwrites another listener the business already uses, whether there is an unsubscribe, or whether Evertec allows a platform to hold merchants' tokens. Phase 0 and the Evertec questions below cover these.

## Phase 0: Live spike (needs the user's ATH Business account)

**Moved later (2026-10-07):** the account isn't available now, so the package and Mezza phases 1–5 are built first against a fake server based on the documented responses. Phase 0 runs as soon as the account is back, before Mezza phase 6; anything it contradicts is fixed in the package (and its fake) first.

A throwaway local script (tokens in an untracked `.env`). Real payments of $1–$2, refunded afterwards. Record answers in the package's `docs/FINDINGS.md`.

- [ ] Where the private token is in ATH Business; whether tokens can be regenerated and what that breaks
- [ ] Full REST flow from a server: create → approve on the phone → `findPayment` shows `CONFIRM` → `authorization` → `COMPLETED`
- [ ] What happens if `authorization` is never called after `CONFIRM` (does it expire, is money held?); how long `auth_token` lasts
- [ ] Customer cancels in the app; timeout expires; we cancel while `OPEN`
- [ ] `updatePhoneNumber` while `OPEN` (the guest mistyped their number)
- [ ] Phone number format accepted (10 digits, with/without dashes); error for a number without ATH Móvil
- [ ] Error codes for a wrong public token, a wrong private token and an unknown `ecommerceId` (for the credential check)
- [ ] Partial and full refund; refund response fields; the refund webhook
- [ ] Webhook subscription: response body, whether a second subscription overwrites the first, real payload of each event (save samples for the fake server)
- [ ] Whether the subtotal, tax and items show on the customer's receipt in the app (decides what we send)

## Questions for Evertec (send in parallel with phase 0)

Through the support form on ath.business/botondepago (answers within 4 business days) or a certified integration partner:

1. Can a platform (Mezza, Grumi) store each merchant's public + private tokens and call the API for them? Is there a partner/platform program or an OAuth-style connection instead?
2. Can a business have more than one webhook listener? Does subscribing again replace the old one? How do we unsubscribe?
3. Are webhooks signed, sent from fixed IPs, or retried? On what schedule?
4. Is there an idempotency mechanism for `/payment`?
5. Is a test environment planned, or can a business get test accounts?
6. Fees for e-commerce payments, and whether platforms can add a fee (Mezza only takes a fee on card, so this is informational).

## Package: `@stratum-pr/payments` (adopted)

Private repo `Stratum-PR/payment_methods`, published to GitHub Packages (`@stratum-pr` scope). Zero runtime dependencies; runs on Node and Deno; integer cents. It already has the ATH Móvil client (create, find, authorize, cancel, phone update, refund, webhook subscription and parsing), Stripe Connect (Standard accounts, Checkout links, refunds, webhook signatures) and an ATH Móvil simulator (Node server and a store-agnostic core).

What it needs before Mezza depends on it (agree each with Genesis; most also protect Grumi):

### P1: Test environment
- [ ] Docker test environment: Node 20, Node 22, Deno and Supabase's edge runtime services; one command runs all four; CI runs the same on every pull request and before every release
- [ ] Edge-runtime check: a sample Edge Function imports the build and runs create → approve → settle → refund against the simulator over HTTP
- [ ] Simulator port configurable (Mezza 55330, Grumi 55430), not fixed at 4010

### P2: Fixes from the security review
- [ ] P-1 webhook subscription checks ATH's envelope; a real `checkCredentials()`
- [ ] P-2 refund idempotency (Stripe key; ATH rules documented)
- [ ] P-3 SQL template keeps `auth_token` in a service-only table
- [ ] P-8 hosted simulator only posts to allowed hosts; P-10 publish job split; P-11 no personal data in error details; P-12 Stripe API version pinned

### P3: Shared logic Mezza needs
- [ ] P-4 `settle()` in the package (port Grumi's `refresh()` lock logic), used by both apps
- [ ] P-5 Stripe event checks (account, amount, livemode) and dedupe guidance
- [ ] Typed error union mapped from Evertec codes (move Grumi's `errorCode()` up)
- [ ] P-13 lookup by `metadata2` to recover a create that timed out
- [ ] Simulator test controls for Mezza's required tests: fail or time out the next call, replay a webhook, advance the clock

### P4: Release
- [ ] A version with the above; CHANGELOG with security notes; P-9 version marker in copied files

## Mezza: pass 3

Installs `@stratum-pr/payments` from GitHub Packages (read-only token only in Vercel/CI secrets). Fits the existing connector: `PaymentProvider` for `ath` in `src/connectors/payments` (`PaymentNext` already has `external_app`; `handleWebhook` and `startOnboarding` exist), `MEZZA_PAYMENTS_ATH=athmovil`, flag `athPayments`. Every payment rule from pass 2 stays: amounts come from `create_tab_payment`, payments record what they covered, IVU is cumulative, lapsed pending payments release their lines.

### Phase 1: Data
- [ ] Migration: per-restaurant ATH account (Vault secret ids for both tokens, webhook secret, status, connected_at, last check); ATH fields on `payments` (`ecommerce_id`, encrypted `auth_token`, `reference_number` in `provider_ref`, `expires_at`), indexed by `ecommerce_id`
- [ ] Dedupe webhooks through the existing `webhook_events`, done only when `processed_at` is set (a failed handler is retried, not skipped)
- [ ] Money tables written by the server only (rule 7): same RLS change as the Stripe plan's phase 1 (`owner_all` and `payments_insert/update_manager_server` today let owners, managers and servers write payments, refunds and `payment_accounts.ath_keys_secret_id`); a trigger rejects changes to status, amounts, `method` or `provider_ref` on ATH payments unless made by the service role. Whichever pass ships first builds it
- [ ] RLS: tokens never readable by any client role; database tests

### Phase 2: Connecting a restaurant
- [ ] Ajustes → Pagos → ATH Móvil (owner only): where to find the tokens in ATH Business, two fields, "Conectar"; check → store → subscribe webhook → "Conectado"; "Desconectar"; audited
- [ ] `status()` reads the stored state; `availableMethods` already shows ATH only when connected
- [ ] Strings in `es.json` and `en.json`; checked at 390/768/1280, light and dark

### Phase 3: Provider and server routes
- [ ] `createPayment`: the pending payment from `create_tab_payment` → ATH `createPayment` (total = amount + IVU + tip; subtotal and tax filled in; `metadata1` = restaurant/table, `metadata2` = payment id) → `external_app`
- [ ] Amounts outside $1.00–$1,500.00 can't use ATH: the phone says why and offers the other methods
- [ ] Settle route the phone polls; `/api/webhooks/ath/[restaurant]/[secret]`; a cron sweeper for `OPEN`/`CONFIRM` payments; all go through `settle()`, then the existing "mark paid" path (`refreshRecentSales`, fiscal)
- [ ] A pending ATH payment keeps its lines until ATH itself says `CANCEL` (Mezza's hold outlasts ATH's timeout, and `settle()` confirms the end), then Mezza releases them; Mezza cancels at ATH when the guest backs out
- [ ] Nothing is refunded automatically (user decision). If money still arrives for lines someone else already paid (for example, a failed cancel), the payment is recorded as received, the table shows the overpayment and Servicio flags it; a manager decides and refunds from the payments list (phase 5)
- [ ] Push-spam limits (review M-1): per device, phone number, table and IP through `RateLimiter`; one open ATH request per person; limited number changes
- [ ] The guest status route only touches the caller's own tab (M-2); the simulator URL comes only from server env and production refuses anything but ATH's own (M-3)

### Phase 4: Guest screens
- [ ] ATH Móvil on the pay screen: phone number field (remembered on that phone only, if the guest agrees), then "Abre ATH Móvil y confirma el pago" with the amount and a countdown
- [ ] Wrong number (`updatePhoneNumber`), cancel, expired → try again or another method; a done screen with the receipt as today
- [ ] The table's live balance shows "Pago en proceso" while ATH is open (already exists for pending payments)
- [ ] Strings in both languages; 390/768/1280, light and dark

### Phase 5: Staff and refunds
- [ ] Overpayments flagged in Servicio and the table detail; a manager refunds them (or keeps them, for example as tip, with a reason), audited; open more than 7 days → escalated to the owner and Stratum and listed in Reportes until resolved
- [ ] Refunds and voids of ATH-paid lines call ATH `refund` first, then `record_refund`; a failed ATH refund leaves nothing recorded and tells staff
- [ ] Payments list and table detail show ATH payments with their reference number; Reportes already colours ATH

### Phase 6: Verification
- [ ] `CONNECTORS.md` tests against the fake server: webhook replay idempotent, amounts equal subtotal + IVU + tip to the cent, a failed provider call leaves no `paid` row, refunds never exceed what was paid, connection status survives restarts
- [ ] E2E with the fake ATH over HTTP (port 55330, beside the `mezza` Supabase stack): one guest pays, two phones pay at once, expiry, cancel, refund after a void
- [ ] Live test with the user's ATH Business account on a preview deploy: $1 payment, a split, a refund
- [ ] Turn on `athPayments` (merging to main deploys production, so ask first); update README, CONNECTORS.md, DECISIONS.md

## Grumi

Already built on `@stratum-pr/payments` by Genesis (`dev`, commit `4874946`): Settings → Pagos, ATH Móvil from checkout, and a test mode with a hosted simulator. How it works today: `docs/PAYMENTS.md` in pet-hub.

Before real ATH Móvil for businesses, Grumi follows the rules above and fixes its items in `docs/PAYMENTS_SECURITY_REVIEW.md`. In order of severity:
- [ ] G-1: test mode only outside production (or flag and exclude test sales); simulator page and approvals for managers only
- [ ] G-2, G-3: the server computes the charge from a pending transaction; a payment links to one transaction only, with the amount checked
- [ ] G-4: ATH keys and auth tokens encrypted (Vault)
- [ ] G-13: only managers update the business; billing columns locked
- [ ] G-5 to G-11 and G-14 to G-18 (refund tracking, disconnect, support sessions, webhook key, access tiers, remove the raw card form, rate limits, CORS, ownership checks)
- [ ] G-12: Grumi's own Docker test environment (ports 55420–55429, simulator on 55430)
- [ ] Rules 7 and 8 above (server-only money writes, daily reconciliation), and webhook events done only when `processed_at` is set
