# ATH Móvil plan (agreed 2026-10-07)

ATH Móvil payments for Mezza first, then Grumi (`Stratum-PR/pet-hub`), built on one shared, public TypeScript package. This plan covers the package, the Mezza adapter (pass 3) and the Grumi adapter. Nothing is built yet.

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
3. **`settle()` is the only path to "paid"**, and running it again is harmless. Three things call it: the waiting phone polling every few seconds, the webhook and a cron sweeper. Whichever comes first wins.
4. **Never retry `/payment` blindly.** There's no idempotency key, so a timeout on create may mean a live payment exists. Look it up by `metadata2` (our payment id) through `findPayment` or search, or cancel it, before trying again.
5. **Tokens belong to each business.** Each business has its own public + private token and its own webhook subscription. Tokens are passed into every call and stored encrypted per business, never in env vars.
6. **The customer's phone number is used for the request and not stored.**

## Separate Docker test environments (required, user request 2026-10-07)

Each repo tests in its own Docker environment, so the package, Mezza and Grumi never share a database, ports or containers on the same machine. Each one runs with one command, and continuous integration runs the same setup.

| Repo | Docker environment | Ports |
|---|---|---|
| `athmovil` (package) | `docker compose` with a Node 20, a Node 22 and a Deno service running the test suite and a smoke test against the build; no database | none published |
| Mezza | Supabase stack `project_id = "mezza"` (exists) | 55320–55329; fake ATH over HTTP on 55330 |
| Grumi | Its own local Supabase stack, separate from the hosted project and from Mezza: its own local `project_id` and port range | proposed 55420–55429; fake ATH on 55430 |

- **The fake ATH server also runs over HTTP** (`npx athmovil fake --port …`, package P4). Grumi's Edge Functions run inside Supabase's edge-runtime container, so a test can't hand them a fake `fetch`. Instead they get the fake's base URL (`http://host.docker.internal:55430`) through a function secret. Mezza's E2E uses the same mode.
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

## Package: `athmovil` (public, npm)

Working name; check npm availability at phase P1. Public GitHub repo under `Stratum-PR`, MIT license.

**Contains:** the ATH protocol only. **Doesn't contain:** database code, UI, env reading, token storage, i18n strings.

Runs on Node 20+ (Mezza, Next.js on Vercel) and Deno (Grumi, Supabase Edge Functions): plain ESM, `fetch` only, no runtime dependencies.

### P1: Repo
- [ ] `PLAN.md` copied from this plan (package phases + "Separate Docker test environments")
- [ ] Docker test environment first: `docker compose` services for Node 20, Node 22 and Deno; `pnpm test:docker` runs all three; CI runs the same file
- [ ] Repo, TypeScript strict, tsup ESM build with types, Vitest, ESLint
- [ ] CI: tests on Node 20/22 and a Deno smoke test (`deno run` importing the build)
- [ ] npm publishing with provenance from GitHub Actions on tags; CHANGELOG

### P2: Client
- [ ] `createAthClient({ publicToken, privateToken?, fetch?, baseUrl? })`, so tokens are passed per business and `fetch` is injectable for the fake server
- [ ] Amounts in integer cents on our side; converted to dollars with 2 decimals only in requests; responses converted back. Rejects totals outside $1.00–$1,500.00 before calling
- [ ] `createPayment`, `findPayment`, `authorize`, `cancel`, `updatePhoneNumber`, `refund`, `registerWebhook`
- [ ] Typed results and errors: Evertec codes mapped to a small union (`invalid_token`, `expired`, `not_found`, `limit`, `invalid_phone`, `network`, `unknown`) that keeps the raw code. Apps translate them
- [ ] Request timeouts; reads are retried with backoff, `createPayment` never is (rule 4)

### P3: Settle, webhooks, credentials
- [ ] `settle(client, ecommerceId, authToken)` → `{ state: "pending" | "paid" | "cancelled", payment }`: `CONFIRM` → authorize; `COMPLETED` → paid; `CANCEL` → cancelled; safe to run concurrently (a second `authorize` on a completed payment reads as paid)
- [ ] `parseWebhook(body)`: validates the shape and returns `{ ecommerceId, event, … , verified: false }`
- [ ] `checkCredentials(client)`: the harmless-call check from the token section
- [ ] `findByMetadata` (or search) for recovering a create that timed out

### P4: Fake ATH server
- [ ] An in-memory implementation behind the same `fetch` (`createFakeAth()`), built from the response examples in Evertec's docs; each guessed behaviour is marked and replaced with real responses after phase 0
- [ ] HTTP mode (`npx athmovil fake --port …`) with a small control API, for apps whose server code runs in another process or container (Grumi's Edge Functions, Mezza's E2E)
- [ ] Controls for tests: `approve(id)`, `decline(id)`, `expire(id)`, advance the clock, make the next call fail or time out, deliver or replay webhooks to a callback
- [ ] Package tests run entirely against it: full flow, expiry, cancel, partial refunds, refunds never exceeding the total, settle racing itself, webhook replay

### P5: Release 0.1.0
- [ ] README (flow diagram, Node and Deno examples, the six design rules), `docs/FINDINGS.md`
- [ ] Publish `0.1.0`; Mezza depends on it from here

## Mezza: pass 3

Fits the existing connector: `PaymentProvider` for `ath` in `src/connectors/payments` (`PaymentNext` already has `external_app`; `handleWebhook` and `startOnboarding` exist), `MEZZA_PAYMENTS_ATH=athmovil`, flag `athPayments`. Every payment rule from pass 2 stays: amounts come from `create_tab_payment`, payments record what they covered, IVU is cumulative, lapsed pending payments release their lines.

### Phase 1: Data
- [ ] Migration: per-restaurant ATH account (Vault secret ids for both tokens, webhook secret, status, connected_at, last check); ATH fields on `payments` (`ecommerce_id`, encrypted `auth_token`, `reference_number` in `provider_ref`, `expires_at`), indexed by `ecommerce_id`
- [ ] Dedupe webhooks through the existing `webhook_events`
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
- [ ] Rate limit payment creation per phone (`RateLimiter`)

### Phase 4: Guest screens
- [ ] ATH Móvil on the pay screen: phone number field (remembered on that phone only, if the guest agrees), then "Abre ATH Móvil y confirma el pago" with the amount and a countdown
- [ ] Wrong number (`updatePhoneNumber`), cancel, expired → try again or another method; a done screen with the receipt as today
- [ ] The table's live balance shows "Pago en proceso" while ATH is open (already exists for pending payments)
- [ ] Strings in both languages; 390/768/1280, light and dark

### Phase 5: Staff and refunds
- [ ] Overpayments flagged in Servicio and the table detail; a manager refunds them (or keeps them, for example as tip, with a reason), audited
- [ ] Refunds and voids of ATH-paid lines call ATH `refund` first, then `record_refund`; a failed ATH refund leaves nothing recorded and tells staff
- [ ] Payments list and table detail show ATH payments with their reference number; Reportes already colours ATH

### Phase 6: Verification
- [ ] `CONNECTORS.md` tests against the fake server: webhook replay idempotent, amounts equal subtotal + IVU + tip to the cent, a failed provider call leaves no `paid` row, refunds never exceed what was paid, connection status survives restarts
- [ ] E2E with the fake ATH over HTTP (port 55330, beside the `mezza` Supabase stack): one guest pays, two phones pay at once, expiry, cancel, refund after a void
- [ ] Live test with the user's ATH Business account on a preview deploy: $1 payment, a split, a refund
- [ ] Turn on `athPayments` (merging to main deploys production, so ask first); update README, CONNECTORS.md, DECISIONS.md

## Grumi: after Mezza ships

Expected to be built by Genesis, starting from this section and "Separate Docker test environments".

Grumi is a Vite + React app on Vercel; its server code is Supabase Edge Functions (Deno). `transactions` already stores cents and allows `payment_method = 'ath_movil'`; `src/pages/Payment.tsx` fakes ATH today. Transactions are written from the browser, so ATH needs the total read from the database by an Edge Function.

- [ ] G0 Plan and test environment first: copy the Grumi phases and "Separate Docker test environments" into Grumi's docs; set up its own local Supabase stack (own local project id, ports 55420–55429, test seed with test businesses) and the fake ATH on 55430, reachable from the edge-runtime container; one command runs the ATH tests
- [ ] G1 Data: per-business ATH account (Vault), ATH fields on `transactions` (or a `transaction_payments` table if a transaction can be paid in parts), RLS
- [ ] G2 Edge Functions (import the package with `npm:`): connect (check + store + subscribe), start payment (reads the transaction's total), settle, webhook, refund; a scheduled sweeper
- [ ] G3 Business settings: the ATH Móvil card next to Stripe (replacing "coming soon")
- [ ] G4 Checkout: the client's phone number → waiting screen → paid; replace the fake in `Payment.tsx`; the client portal can reuse it to pay ahead
- [ ] G5 Tests with the fake server, then a live $1 test
