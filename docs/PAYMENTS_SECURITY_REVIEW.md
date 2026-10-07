# Payments security review: @stratum-pr/payments, Grumi, Mezza

Reviewed 2026-10-07 by Claude (Claude Code) for Jovaniel Rodriguez. Read-only review; nothing here has been fixed yet.

The same file is kept in all three repos:
- `Stratum-PR/payment_methods` → `docs/PAYMENTS_SECURITY_REVIEW.md`
- `Stratum-PR/pet-hub` (Grumi) → `docs/PAYMENTS_SECURITY_REVIEW.md`
- `Stratum-PR/Mezza.pr` → `docs/PAYMENTS_SECURITY_REVIEW.md`

When an item is fixed, mark it in every copy (or move the canonical copy to `payment_methods` and leave pointers).

**Decision (2026-10-07):** both apps use Genesis's design: the private package `@stratum-pr/payments` (ATH Móvil + Stripe Connect) from `Stratum-PR/payment_methods`. Mezza adopts it instead of the public `athmovil` package it had planned.

**What was reviewed:**
- `payment_methods` at `ef51268` (package v0.2.0: `src/`, `simulator/`, `sql/001_payments.sql`, CI)
- Grumi `dev` at `4874946` ("Payments: ATH Móvil charging from checkout, Settings → Pagos, cloud test mode")
- Mezza's planned ATH Móvil adapter (`docs/ATH_MOVIL_PLAN.md`) and its Stripe expectations (`CONNECTORS.md`)

The package's tests weren't run for this review.

**Severity:**
- **High:** money can be lost or invented, or a secret can leak.
- **Medium:** records and money can drift apart, or a fix is needed before going live.
- **Low:** hardening.

## Summary

| ID | Severity | Where | Problem |
|---|---|---|---|
| G-1 | High | Grumi | Test mode records real "paid by ATH Móvil" sales with no money |
| P-1 | High | Package | Webhook subscription treats any HTTP 200 as success, so wrong ATH keys are accepted |
| P-2 | High | Package | Refunds can run twice (no idempotency) |
| M-1 | High | Mezza (planned) | Guests can send ATH push requests to any phone number |
| X-1 | High | Both | One Stripe platform key for both apps would expose both if either leaks |
| G-2 | Medium-high | Grumi | One ATH payment can be linked to several sales, or to a sale of a different amount |
| G-3 | Medium-high | Grumi | Amount and "paid" status come from the browser; any business member can write transactions |
| G-4 | Medium | Grumi | ATH private keys stored as plain text |
| G-5 | Medium | Grumi | Refunds made in the ATH Business app never reach Grumi |
| G-6 | Medium | Grumi | Turning ATH off keeps the keys; disconnecting doesn't unsubscribe the webhook |
| G-7 | Medium | Grumi | Support "log in as staff" sessions can change payment keys and mode |
| P-3 | Medium | Package | SQL template exposes the ATH `auth_token` to staff |
| P-4 | Medium | Package | No shared settle/finalize; each app writes the riskiest code itself |
| P-5 | Medium | Package | No helper to check a Stripe event belongs to the right business and amount; no event dedupe |
| P-6 | Medium | Package | Stripe Standard accounts: businesses can refund or lose disputes outside the app |
| P-7 | Medium | Package | Stripe payment links stay payable after the client pays another way |
| P-8 | Medium | Package | Hosted simulator will POST to any URL (outbound relay) |
| P-9 | Medium | Package | Copied (vendored) package files drift; security fixes may never reach an app |
| M-2 | Medium | Mezza (planned) | The guest's status-check route needs scoping and rate limits |
| M-3 | Medium | Mezza (planned) | The simulator/fake must be impossible to use in production |
| X-2 | Medium | Both | Registering the ATH webhook may replace a listener the business already uses |
| X-3 | Medium | Both | Simulator ≠ real ATH; unconfirmed behaviour until a live $1 test |
| X-4 | Medium | Both | Evertec hasn't said platforms may hold merchants' keys |
| G-8 | Low | Grumi | Webhook key travels in the query string and can't be rotated |
| G-9 | Low | Grumi | Mode or key changes strand payments that are in flight |
| G-10 | Low | Grumi | `verify_jwt = false` on both functions: one missed check exposes an action |
| G-11 | Low | Grumi | Staff can read `payments.last_error` (raw provider messages) |
| G-12 | Low | Grumi | No separate Docker test environment; tests ran against an in-memory database only |
| P-10 | Low | Package | CI token can publish packages from any branch's workflow |
| P-11 | Low | Package | Provider errors carry full responses (names, phones) into logs |
| P-12 | Low | Package | Stripe API version not pinned; account-creation idempotency expires after 24 h |
| P-13 | Low | Package | ATH create has no recovery when the request times out |

## Package (`payment_methods`), affects both apps

### P-1: Wrong ATH keys accepted as valid (High)
- **Where:** `src/athmovil/client.ts`, `subscribeWebhooks`.
- **Problem:** it only checks `res.ok`. ATH answers errors as `{ status: "error", … }`, which may come with HTTP 200. Grumi uses this call as its credentials check (`supabase/functions/payments/index.ts`, `settings_save_ath`).
- **What goes wrong:** wrong or typo'd keys are saved and the business is shown as "Real / connected". Every charge then fails in front of a customer, and the webhook was never registered.
- **Fix:**
  - Parse the envelope and fail on `status !== "success"`.
  - Add a real `checkCredentials()`: a `findPayment` on a made-up id should return "not found", not "invalid token". Confirm the exact codes in the live test.

### P-2: Refunds can run twice (High)
- **Where:** `refundStripePayment` (`src/stripe/checkout.ts`) and `AthMovilClient.refund`.
- **Problem:** the Stripe refund sends no `Idempotency-Key`, and ATH has no idempotency mechanism at all.
- **What goes wrong:** a retry after a timeout, a double click or a re-run job refunds the money twice. The money comes out of the business's account.
- **Fix:**
  - Stripe: require an idempotency key derived from our own refund row id.
  - ATH: apps must insert a refund row as `pending` first, call ATH once, never auto-retry, and check `totalRefundedAmount` through `findPayment` before any retry.
  - Document this rule in the README.

### P-3: SQL template exposes the ATH `auth_token` (Medium)
- **Where:** `sql/001_payments.sql`, `payments.provider_auth_token`. The template's comment tells the host app to add staff SELECT policies.
- **Problem:** RLS is row-level, so any staff member can query the column straight from the browser.
- **What goes wrong:** a leaked `auth_token` allows `authorize`, `findPayment` and `updatePhoneNumber` on that payment. Grumi avoided this with a separate `payment_secrets` table; an app copying the template wouldn't.
- **Fix:** change the template to Grumi's layout, with per-payment secrets in a service-only table.

### P-4: No shared settle/finalize (Medium)
- **Problem:** the package has no `settle()`. Grumi wrote its own `refresh()` with a lock (a conditional update to `authorizing`, with a 60 s stuck window). Mezza would write a second one.
- **What goes wrong:** finalizing is where money is lost or doubled. Two examples:
  - Treating `BTRA_0032` ("not confirm") after a parallel caller already completed the payment as a failure.
  - A lost `authorize` response leaving a charged customer marked unpaid.
- **Fix:** move the state machine into the package as `settle(client, payment, store)` with a small storage interface (lock, save). Port Grumi's logic, and have both apps call it.

### P-5: No Stripe event ownership, amount or dedupe checks (Medium)
- **Where:** `verifyStripeWebhook` checks the signature only (that part is correct: HMAC, timing-safe compare, 5-minute tolerance).
- **Problem:** nothing helps the app check:
  - that `event.account` equals the business's stored `stripe_account_id`;
  - that the amount and currency match our payment row;
  - that `livemode` matches the environment;
  - whether the event id was already handled.
- **What goes wrong:** one business's event marks another business's payment paid, a replayed event runs twice, or a test-mode event touches live data.
- **Fix:** add `handleCheckoutEvent(event, expected)`, which returns ok/mismatch, and document event-id dedupe (Mezza has `webhook_events`; Grumi needs one).

### P-6: Stripe Standard accounts let businesses act outside the app (Medium)
- **Where:** `createConnectedAccount` hard-codes `type: "standard"`.
- **Problem:** with Standard accounts the business owns the full Stripe Dashboard. It can refund, and disputes land on it, without our app knowing.
- **What goes wrong:** sales show "paid" in Grumi/Mezza after they were refunded or charged back. Reports and receipts are wrong, and Mezza's split-bill coverage goes wrong.
- **Mezza conflict:** `CONNECTORS.md` planned Express accounts with a platform fee. Decide the account type for both apps before the Stripe phase.
- **Fix:** subscribe to `charge.refunded`, `charge.dispute.*` and `account.updated` (charges disabled) on the Connect endpoint and mirror them. Make the account type a parameter.

### P-7: Stripe payment links stay payable (Medium)
- **Where:** `createCheckoutPayment` sets an expiry of 30 min to 24 h (default 60 min). The link is shown as a QR or texted.
- **Problem:** if the client then pays cash or ATH, the link still works unless the app calls `expireCheckoutPayment`. Texted links can also be forwarded.
- **What goes wrong:** double payment, which staff must refund by hand (and P-2 applies).
- **Fix:**
  - Apps must expire the session whenever the sale is paid by another method or cancelled.
  - The completion handler must treat a second payment for an already-paid sale as an overpayment to flag, never as a new sale.
  - Use the shortest expiry that works.

### P-8: Hosted simulator posts to any URL (Medium)
- **Where:** `simulator/athmovil/core.mjs`, `subscribe` (accepts any `http(s)` `listenerURL`), then `postWebhook`.
- **Problem:** Grumi hosts this core as a public Edge Function (`athm-simulator`).
- **What goes wrong:** anyone holding a business's simulator keys can make Supabase's servers POST JSON to any address, including internal ones.
- **Fix:** when hosted, only allow listener URLs on the app's own functions host (configurable allowlist).
- **Also:** the Node server (`server.mjs`) has open CORS and no auth on approve/state/reset. That's fine on a laptop, but it must never be deployed; say so in the Dockerfile and README (the Dockerfile already notes it).

### P-9: Copied package files drift (Medium)
- **Where:** Grumi copies `dist/` into `supabase/functions/*/lib` with `scripts/sync-payment-libs.sh`; Mezza would install from GitHub Packages.
- **Problem:** copied files have no version marker, so a security fix in the package doesn't reach an app until someone re-runs the script and redeploys.
- **Fix:**
  - Write the package version and commit into a `VERSION` file in each copied `lib/`.
  - Have each app's CI fail when it's older than the minimum safe version listed here.
  - Keep a CHANGELOG with security notes.
- **Also:** the `read:packages` token on Vercel/CI can read every private package in the org. Use a fine-grained token, or the Actions `GITHUB_TOKEN`.

### P-10: CI publishing permissions (Low)
- **Where:** `.github/workflows/ci.yml` grants `packages: write` to every run, including pull requests.
- **Problem:** publishing is gated on tags, but a workflow edited on a branch runs with that permission.
- **Fix:** move publishing into a separate job with a protected environment and tag protection; give the test job `packages: read`.

### P-11: Provider errors carry personal data into logs (Low)
- **Problem:** `PaymentProviderError.details` holds the full provider response. ATH payloads include customer name, phone and email.
- **What goes wrong:** an app that logs whole errors (or stores them in `last_error`) keeps personal data in logs.
- **Fix:** strip personal fields from `details` by default; give logs only the code and message.

### P-12: Stripe API version and account creation (Low)
- **Problem 1:** `apiVersion` is optional, so responses can change shape when the platform's default version changes.
- **Problem 2:** the idempotency key `acct-create-<businessId>` only lasts 24 h at Stripe. A retry after that creates a second connected account.
- **Fix:**
  - Pin the API version.
  - Store the `acct_…` id before anything else, and check for it before creating an account.

### P-13: ATH create has no timeout recovery (Low)
- **Problem:** if `/payment` times out, a live request may exist (ATH has no idempotency key). Staff retry, and the client gets two pushes.
- **What goes wrong:** the second push can't charge on its own, because capture needs our `authorize` and we only finalize the payment we track. But it confuses the client.
- **Fix:** a `findByMetadata`/search helper, so an app can cancel the orphaned request before trying again.

## Grumi (`pet-hub`, `dev` at `4874946`)

### G-1: Test mode records real "paid" sales with no money (High)
- **Where:** Settings → Pagos lets any manager switch ATH Móvil to Test in production. Checkout then saves a normal transaction with `payment_method = 'ath_movil'`, status paid and an "ATH Móvil ref." note (`src/pages/TransactionCreate.tsx`, `buildPayload`). Any staff member can approve the "client's" charge on the simulated phone page.
- **Problem:** nothing on the transaction marks it as a test.
- **What goes wrong:** sales, revenue, receipts and appointment "billed" status count money that was never received. That's easy to do by accident, and easy to abuse: a groomer pockets cash and records an "ATH" payment approved on the simulator.
- **Fix (pick one, ideally both):**
  - Allow test mode only on non-production projects (an environment gate in both functions).
  - Write simulator payments with a test flag on the transaction, excluded from reports and receipts and visibly labelled.
  - Also audit-log every mode change.

### G-2: One ATH payment can back several sales (Medium-high)
- **Where:** `supabase/functions/payments/index.ts`, `link_transaction`.
- **Problem:** it overwrites `transaction_id` without checking it's empty, and never compares the payment amount with the transaction total. The ATH reference saved on the transaction is free text from the browser.
- **What goes wrong:** a $10 ATH payment can be linked to an $80 sale, or relinked to a second sale, so two sales show "paid by ATH" for one payment.
- **Fix:**
  - Update `where transaction_id is null`.
  - Require the transaction total (or its ATH part, for split tenders) to equal `amount_paid_cents`.
  - Make the link unique: one payment, one transaction.
  - Better: create the transaction on the server when the payment succeeds (see G-3).

### G-3: Amount and "paid" status come from the browser (Medium-high)
- **Where:** `ath_create` takes `amountCents` from the request. The transaction, including `status` and `payment_method`, is written by the browser through the `"Users can manage transactions from their business"` policy (`FOR ALL`, scoped only by `profiles.business_id`).
- **Problem:** staff, or anything running in a staff browser, can charge any amount and record any status. The policy checks the business, not the role.
- **Check:** if `client`-role profiles ever have `business_id` set, clients can write transactions directly. Verify this.
- **Fix:**
  - Compute the charge from the appointment and line items on the server.
  - Have the `payments` function create or mark the transaction paid itself.
  - Restrict transaction writes to staff roles, and block browser writes of `status = 'paid'` for ATH and card methods.

### G-4: ATH private keys stored as plain text (Medium)
- **Where:** `business_payment_secrets.athmovil_private_token` (and the public token).
- **Problem:** the private key can refund money out of the business's ATH account. Today it's protected only by RLS and the service role, so a leaked service key, a database backup, or a support SQL session exposes every business's key.
- **Fix:** store it in Supabase Vault (or encrypt it with a key held outside the database). Only the `payments` function decrypts it.

### G-5: Refunds outside Grumi aren't tracked (Medium)
- **Where:** Grumi has no refund action; `docs/PAYMENTS.md` says to refund from the ATH Business app.
- **Problem:** the `refundSentEvent` webhook is ignored, because `parseAthWebhook` returns no `ecommerceId` for refunds.
- **What goes wrong:** refunded sales stay "paid", and reports overstate revenue.
- **Fix:** match refund webhooks by `referenceNumber`/`metadata2` and re-check with `findPayment` (`totalRefundedAmount`). Add a manager refund action in Grumi that writes `transaction_refunds` (with P-2's rules).

### G-6: Turning ATH off keeps keys and the webhook (Medium)
- **Where:** `settings_save_ath` with `mode: "off"` only changes the mode.
- **Problem:** the private key stays stored and ATH keeps sending events to Grumi.
- **What goes wrong:** a business that leaves still has its refund-capable key in our database. Re-enabling silently reuses old keys.
- **Fix:**
  - Add a "Desconectar" that deletes the keys and unsubscribes (or re-points) the webhook.
  - Delete payment secrets when a business is deleted or offboarded.

### G-7: Support sessions can change payment settings (Medium)
- **Where:** `support-begin-user-session` lets a super admin sign in as a staff member.
- **Problem:** in that session they can switch ATH mode, replace keys, or turn on test mode.
- **What goes wrong:** a compromised super admin, or a careless support session, can redirect payments or enable fake test sales (G-1).
- **Fix:** block payment-setting changes during support sessions (or require the real owner), and audit-log every change with the real actor.

### G-8: Webhook key in the query string (Low)
- **Where:** `?webhook=<key>`.
- **Problem:** query strings can end up in function logs and proxies, and there's no way to rotate the key.
- **Fix:** move the key to the path, avoid logging full URLs, and add a "rotate" that re-subscribes.

### G-9: In-flight payments get stranded (Low)
- **Where:** `refresh()` returns early when the business's current mode differs from the payment's mode, and it always uses the current keys.
- **What goes wrong:** switching mode or replacing keys while a client is approving leaves that payment pending forever (the client was not charged, but staff see "pending").
- **Fix:** keep which credentials created each payment (an account id or token fingerprint), and finish or cancel in-flight payments before switching.

### G-10: JWT checked only in code (Low)
- **Where:** both `payments` and `athm-simulator` run with `verify_jwt = false`.
- **Problem:** the checks are correct today, but one future action added above the auth block, or one missed role check, would be public.
- **Fix:** add a test that calls every action without a token and expects 401. Keep the webhook branch the only unauthenticated path.

### G-11: Staff can read raw provider errors (Low)
- **Where:** the `payments` SELECT policy covers all columns, including `last_error` (raw provider messages).
- **Fix:** move `last_error` to the service-only table, or expose a view without it.

### G-12: No separate Docker test environment (Low, but required)
- **Problem:**
  - `supabase/config.toml` still uses the hosted project ref as `project_id` and the default ports.
  - The commit says it was verified with "a 32-scenario run of both functions against an in-memory DB".
  - Nothing runs in its own Supabase Docker stack.
- **Fix:** do this before more payment work. Give Grumi its own local stack (proposed ports 55420–55429; Mezza uses 55320–55329) with a test seed. Run the simulator from the package on its own port (proposed 55430) and test both functions there.

## Mezza (planned adapter, nothing built yet)

### M-1: Push spam to any phone number (High)
- **Problem:** in Mezza the guest types the phone number on a public QR page.
- **What goes wrong:** anyone at a table, or anyone with a saved QR link, can trigger ATH requests to strangers' phones. That means harassment, and probably trouble with Evertec.
- **Fix:**
  - Rate-limit through `RateLimiter`: per device, per phone number, per table and per IP.
  - Allow only one open ATH request per participant.
  - Limit how often a number can be changed (`updatePhoneNumber`).
  - Log hashed numbers for abuse review.

### M-2: Guest status-check route (Medium)
- **Problem:** the route the waiting phone polls has no login.
- **Fix:** it may only check payments belonging to the caller's own tab and device cookie. Rate-limit it, and only ever call the shared `settle()` (P-4).

### M-3: Simulator/fake in production (Medium)
- **Problem:** Mezza's E2E tests will point the package at the simulator.
- **Fix:** take the base URL only from server environment, never from a database row or request. In production, refuse anything but ATH's official URL, the same way `mocksAllowed()` blocks mocks today. No test mode in production (see G-1).

### M-4: Things Mezza must keep from its plan when adopting the package (Medium)
- **Keys:** stored in Vault, not plain columns (G-4).
- **Amounts:** come only from `create_tab_payment`; the browser never sends one (G-3).
- **Overpayments:** a late payment for lines someone else already paid is recorded, flagged and refunded by a manager, never refunded automatically.
- **Finalizing:** goes through the shared `settle()` (P-4).
- **Webhooks:** dedupe through `webhook_events`.
- **Package access:** the GitHub Packages token for installs lives only in Vercel/CI secrets (P-9).

## Both apps

### X-1: Shared Stripe platform account (High)
- **Problem:** if Mezza and Grumi share one Stripe platform account and secret key, a leak in either app can create charges or refunds, or read data, for both products' businesses.
- **Fix:** one Stripe platform account per product, or at least restricted keys per app, separate webhook endpoints and secrets per app, and key rotation documented.

### X-2: ATH webhook registration may replace an existing listener (Medium)
- **Problem:** Evertec doesn't document whether subscribing replaces an existing listener. A business that already uses ATH webhooks (another platform, WooCommerce) might silently lose them when it connects to Grumi or Mezza.
- **Fix:** ask Evertec. Until then, warn the business on the connect screen, and confirm the behaviour in the live $1 test.

### X-3: Simulator fidelity (Medium)
- **Problem:** the simulator follows Evertec's docs, but these are unconfirmed until real payments run:
  - error codes and envelope shapes;
  - what happens when `authorize` is never called;
  - how long `auth_token` lasts;
  - refund behaviour and the webhook payloads.
- **Fix:** keep the real mode off in both apps until a live $1 payment, a cancel, an expiry and a partial refund pass. Then update the simulator from the real responses.

### X-4: Holding merchants' keys (Medium)
- **Problem:** Evertec's docs don't say whether a platform may store a merchant's private key and act for it.
- **What goes wrong:** possible terms violation and account suspension.
- **Fix:** ask Evertec through the botón de pago support form or a certified partner before going live with real businesses. The open questions are listed in Mezza's `docs/ATH_MOVIL_PLAN.md`.

## Done well (keep it this way)

- Unsigned ATH webhooks are only used to find the payment, then re-checked with `findPayment` (package README and Grumi's function).
- Grumi keeps the ATH `auth_token` in a separate service-only table and returns only a public subset of columns.
- Grumi finalizes behind a conditional-update lock and recovers payments that were paid but never saved.
- Grumi stores only the last 4 digits of the client's phone and shows short error codes to the browser.
- Stripe webhook verification is correct (raw body, HMAC-SHA256, timing-safe compare, 5-minute tolerance).
- The package uses no runtime dependencies (a small supply-chain surface) and stores amounts as integer cents everywhere.
