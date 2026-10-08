# Payments security review: @stratum-pr/payments, Grumi, Mezza

> **Shared document.** Identical copies live in `Stratum-PR/Mezza.pr`, `Stratum-PR/pet-hub` (Grumi) and `Stratum-PR/payment_methods`, at the same path. Change all three together. Each platform implements its own section and the security items in `docs/PAYMENTS_SECURITY_REVIEW.md`.

- First review: 2026-10-07.
- Updated the same day after a second audit that checked every item against the code. Items marked **(new)** come from it.
- Reviewed by Claude (Claude Code) for Jovaniel Rodriguez. Read-only review: nothing here has been fixed yet, and no tests were run.

## Decisions (user, 2026-10-07)

- **ATH Móvil:** both apps use this package (`@stratum-pr/payments`, Genesis's design).
- **Stripe:** each app uses Stripe's official SDK, following the shared rules in `docs/STRIPE_PLAN.md` (shared by all three repos). **Neither app uses this package's Stripe code.**
  - Items P-5, P-6, P-7, P-12 and the Stripe half of P-2 only matter if that changes.
  - Genesis: remove the Stripe exports, or mark them unused in the README, so nobody wires them in by accident.
- **Grumi fixes:** Genesis makes them (her code). This file is the list.
- **Mezza fixes:** planned in the shared ATH and Stripe plans. No code until the user approves.

## Code reviewed

- `payment_methods` `dev` at `ef51268` (v0.2.0).
- Grumi `dev` at `5d64f55` (payments code from `4874946`).
- Mezza `main` at `fc39fbf`, plus the shared plans `docs/ATH_MOVIL_PLAN.md` and `docs/STRIPE_PLAN.md` (in Mezza on branch `docs/ath-movil-plan`).
- Grumi's own Stripe plan wasn't pushed; it was checked from a summary. Its phases now go in the Grumi section of the shared `docs/STRIPE_PLAN.md`.

## Rules every fix is measured against

1. Amounts come from the database; the browser never sends an amount to charge.
2. `settle()` is the only path to "paid":
   - it reads the payment from the provider using **our stored** account id and payment id, never ids from a webhook or the browser;
   - it checks status, amount to the cent, currency and our payment id in metadata.
3. Webhooks:
   - Stripe events are signature-checked; ATH events are unsigned and only a hint.
   - Events are deduped by `(provider, event_id)` and count as done only when `processed_at` is set; a failed handler is retried.
4. Idempotency keys come from our own ids.
5. A hold ends at the provider first: cancel there, then release.
6. No automatic refunds. Overpayments are recorded, flagged and resolved by staff within a deadline.
7. Refunds:
   - Order: role check → provider refund → our record with the provider's refund id (unique).
   - Webhooks backfill any refund missing on our side.
8. Provider secrets live server-side only, encrypted at rest. Card numbers are only typed into Stripe's own fields or pages.
9. **Money and billing rows are written by the server only.** No signed-in browser role writes payments, refunds, provider accounts, subscriptions, fees or billing columns.
10. **Reconcile daily:** our paid, refunded and disputed rows against the provider's records, per business.

**Severity:**

- **High:** money can be lost or invented, or a secret can leak.
- **Medium:** records and money can drift apart, or a fix is needed before going live.
- **Low:** hardening.

## Summary

| ID                  | Severity       | Where   | Problem                                                                                    | Status                                                         |
| ------------------- | -------------- | ------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| G-1                 | High           | Grumi   | Test mode records real "paid by ATH Móvil" sales with no money                             | Open (Genesis)                                                 |
| G-2                 | High           | Grumi   | One ATH payment can back several sales, or a sale of another amount                        | Open (Genesis)                                                 |
| G-3                 | High           | Grumi   | Amount and "paid" status come from the browser; any member writes transactions             | Open (Genesis)                                                 |
| G-4                 | High           | Grumi   | ATH keys and auth tokens stored as plain text                                              | Open (Genesis)                                                 |
| G-13 (new)          | High           | Grumi   | Any business member can edit the business, including subscription and Stripe columns       | Open (Genesis); Grumi's Stripe plan G1 locks billing columns   |
| M-5 (new)           | High           | Mezza   | Owners (and servers, for `payments`) can write money tables directly                       | Planned (ATH phase 1, Stripe phase 1)                          |
| M-6 (new)           | High           | Mezza   | Owners can change their own plan, status and trial                                         | Planned (Stripe phase 1)                                       |
| M-7 (new)           | High           | Mezza   | Card testing through public guest pages                                                    | Planned (Stripe phase 3)                                       |
| M-1                 | High           | Mezza   | Guests can send ATH push requests to any phone number                                      | Planned (ATH phase 3)                                          |
| P-1                 | High           | Package | Webhook subscription treats any HTTP 200 as success, so wrong ATH keys are accepted        | Open (Genesis)                                                 |
| P-2                 | High           | Package | ATH refunds can run twice (no idempotency)                                                 | Open (Genesis)                                                 |
| X-1                 | High           | Both    | One Stripe platform key for both apps                                                      | Resolved in the Stripe plan (one platform account per product) |
| G-5                 | Medium         | Grumi   | Refunds made in the ATH Business app never reach Grumi                                     | Open (Genesis)                                                 |
| G-6                 | Medium         | Grumi   | Turning ATH off keeps keys and the webhook                                                 | Open (Genesis)                                                 |
| G-7                 | Medium         | Grumi   | Support "log in as staff" sessions can change payment keys and mode                        | Open (Genesis)                                                 |
| G-14 (new)          | Medium         | Grumi   | The payments function ignores staff access tiers (contractors can charge)                  | Open (Genesis)                                                 |
| G-15 (new)          | Medium         | Grumi   | Raw card-number/CVV inputs still in `Payment.tsx`                                          | Open (Genesis)                                                 |
| G-19 (new)          | Medium         | Grumi   | Unverified: whether dev.grumi.pet and grumi.pet share one Supabase project and its secrets | Check (Genesis/user)                                           |
| G-20 (new)          | Medium         | Grumi   | The Stripe plan's per-business "Test mode" repeats G-1                                     | Listed in the shared Stripe plan's Grumi section               |
| M-2                 | Medium         | Mezza   | The guest's status-check route needs scoping and rate limits                               | Planned (ATH phase 3)                                          |
| M-3                 | Medium         | Mezza   | The simulator must be impossible to use in production                                      | Planned (ATH phase 3)                                          |
| M-8 (new)           | Medium         | Mezza   | No Content-Security-Policy on the pages that will hold Stripe's fields                     | Planned (Stripe phase 4)                                       |
| M-9 (new)           | Medium         | Mezza   | A provider error releases the hold without cancelling at the provider                      | Open (code)                                                    |
| M-11 (new)          | Medium         | Mezza   | The plan ran the live check on a public preview with live keys                             | Fixed in the Stripe plan                                       |
| X-2                 | Medium         | Both    | Registering the ATH webhook may replace a listener the business already uses               | Ask Evertec / live test                                        |
| X-3                 | Medium         | Both    | Simulator ≠ real ATH until a live $1 test                                                  | Before going live                                              |
| X-4                 | Medium         | Both    | Evertec hasn't said platforms may hold merchants' keys                                     | Ask Evertec                                                    |
| X-5 (new)           | Medium         | Both    | "Recorded once before handled" skips the provider's retry after a crash                    | In both shared plans                                           |
| X-6 (new)           | Medium         | Both    | `settle()` must use stored ids, never ids from the event                                   | In both shared plans                                           |
| X-7 (new)           | Medium         | Both    | No daily reconciliation                                                                    | In both shared plans                                           |
| X-8 (new)           | Medium         | Both    | Liabilities: overpayments with no deadline, fee on tips, no merchant terms                 | In the shared Stripe plan                                      |
| P-3                 | Medium         | Package | SQL template exposes the ATH `auth_token` to staff                                         | Open (Genesis)                                                 |
| P-4                 | Medium         | Package | No shared ATH settle/finalize                                                              | Open (Genesis)                                                 |
| P-8                 | Medium         | Package | Hosted simulator will POST to any URL                                                      | Open (Genesis)                                                 |
| P-9                 | Medium         | Package | Copied package files drift; security fixes may not reach apps                              | Open (Genesis)                                                 |
| G-8                 | Low            | Grumi   | Webhook key in the query string, can't be rotated                                          | Open (Genesis)                                                 |
| G-9                 | Low            | Grumi   | Mode or key changes strand in-flight payments                                              | Open (Genesis)                                                 |
| G-10                | Low            | Grumi   | `verify_jwt = false` on both functions                                                     | Open (Genesis)                                                 |
| G-11                | Low            | Grumi   | Staff can read `payments.last_error`                                                       | Open (Genesis)                                                 |
| G-12                | Low (required) | Grumi   | No separate Docker test environment                                                        | Open (Genesis)                                                 |
| G-16 (new)          | Low            | Grumi   | No rate limit on `ath_create`                                                              | Open (Genesis)                                                 |
| G-17 (new)          | Low            | Grumi   | Edge Functions echo back any Origin in CORS                                                | Open (Genesis)                                                 |
| G-18 (new)          | Low            | Grumi   | `appointment_id`/`customer_id` on payments aren't checked against the business             | Open (Genesis)                                                 |
| M-10 (new)          | Low            | Mezza   | A custom tip can be up to $1,000 on any bill                                               | Open (code)                                                    |
| P-10                | Low            | Package | CI token can publish from any branch's workflow                                            | Open (Genesis)                                                 |
| P-11                | Low            | Package | Provider errors carry personal data into logs                                              | Open (Genesis)                                                 |
| P-13                | Low            | Package | ATH create has no recovery when the request times out                                      | Open (Genesis)                                                 |
| P-5, P-6, P-7, P-12 | n/a            | Package | Stripe-only items                                                                          | Not used (decision above)                                      |

## Grumi (`pet-hub` `dev`): fix list for Genesis

### G-1: Test mode records real "paid" sales (High)

- **Evidence:**
  - The `payments` function accepts `mode: "simulator"` with no environment check (`supabase/functions/payments/index.ts:278, 289-323`).
  - The simulator page has no role guard (`src/pages/Index.tsx:563`).
  - The simulator's approve buttons only check that the user belongs to the business, not their role (`supabase/functions/athm-simulator/index.ts:106-107`).
  - Checkout saves the sale as `ath_movil`, paid (`src/pages/TransactionCreate.tsx:219, 223`).
  - `payments.mode` never reaches `transactions`, and `src/pages/Reports.tsx:40` reads every transaction.
- **Risk:** an employee keeps the cash and records an "ATH" payment they approved themselves on the simulated phone. It counts as revenue.
- **Fix:**
  - Allow test mode only when a server-side environment variable says the project isn't production, checked in both functions.
  - Until then, write `is_test` on the transaction and exclude it from reports and receipts.
  - The simulator page and its approve buttons require manager+.
  - Audit-log every mode change.

### G-2: One payment can back several sales (High)

- **Evidence:** `link_transaction` overwrites `transaction_id` and never compares amounts (`payments/index.ts:436-445`).
- **Fix:**
  - Update `.is('transaction_id', null)`.
  - Require `amount_paid_cents` = the transaction total (or its ATH part).
  - Add a unique index on `payments.transaction_id`.

### G-3: Amount and status come from the browser (High)

- **Evidence:**
  - `ath_create` takes `amountCents` from the request (`payments/index.ts:348-350`); the browser sends its own total (`TransactionCreate.tsx:570`) and saves the transaction afterwards.
  - The transactions policy is `FOR ALL` for any profile in the business (`supabase/migrations/20260330180000_transactions_rls_super_admin_manage.sql`).
- **Fix:** save the transaction as pending first, and have the server compute the charge from it. Block browser writes of `status = 'paid'` for card and ATH methods (trigger). Grumi's Stripe plan already moves this way; do the same for ATH.

### G-4: Plain-text secrets (High)

- **Evidence:** `supabase/migrations/20261007140000_payments.sql:25-26` (merchant keys) and `:73` (per-payment `auth_token`).
- **Fix:** Supabase Vault (or pgsodium); only the `payments` function decrypts. The private key can refund money out of the business's ATH account.

### G-13 (new): Any member can edit the business, billing included (High)

- **Evidence:** `supabase/migrations/20250120000000_create_multi_tenant_schema.sql:82-88`: any profile with that `business_id` can update the row, including `subscription_tier`, `subscription_status`, `stripe_*` and `trial_ends_at` (`:55-60`).
- **Check:** whether `client` profiles can have `business_id` set; if so, clients can too.
- **Fix:**
  - Limit updates to managers.
  - Add a trigger that rejects billing-column changes unless made by the service role (Grumi's Stripe plan G1).

### G-5 to G-12

Unchanged from the first review:

- **G-5:** refunds made in the ATH Business app never reach Grumi. Match refund webhooks by `referenceNumber`/`metadata2`, and add a manager refund action.
- **G-6:** "Off" keeps the keys and the webhook. Add "Desconectar", which deletes the keys and unsubscribes.
- **G-7:** support sessions can change payment settings. Block that during support sessions, and audit-log changes with the real actor.
- **G-8:** the webhook key is in the query string. Move it to the path and allow rotation.
- **G-9:** in-flight payments get stranded on a mode or key change. Store which credentials created each payment.
- **G-10:** `verify_jwt = false`. Add a test that every action without a token gets 401.
- **G-11:** `last_error` is readable by staff. Move it to the service-only table.
- **G-12:** separate Docker test environment. Grumi's own local Supabase stack (proposed ports 55420–55429) with the simulator on 55430.

### G-14 (new): Access tiers ignored (Medium)

- **Evidence:** `payments/index.ts:242-245` checks `profiles.role` (`super_admin`/`manager`/`employee`/`client`). The tiers in `employees.access_role` (`admin`/`manager`/`staff`/`contractor`, `20260325000000_staff_rename_access_role.sql:15-16`) are ignored.
  - Contractors (profile `employee`) can create and cancel charges.
  - An `admin`-tier employee can't change settings.
  - Not verified: whether deactivated staff keep `business_id`.
- **Fix:** check `employees.access_role` and active status. Charges need staff or above; settings need admin or manager.

### G-15 (new): Raw card form (Medium)

- **Evidence:** `src/pages/Payment.tsx:19-22, 124-155` has card number, expiry and CVV inputs, behind the `payments` feature flag (`Index.tsx:560-561`). Nothing is sent or logged today.
- **Fix:** delete the form. Card data only ever goes into Stripe's own pages.

### G-16 to G-20 (new)

- **G-16:** `ath_create` has no rate limit. Limit per user and per phone number.
- **G-17:** CORS echoes back any Origin (`payments/index.ts:49-59`, `athm-simulator/index.ts:15-25`). Allowlist Grumi's origins.
- **G-18:** `payments.appointment_id` is text with no foreign key, and `customer_id` is only format-checked (`payments.sql:49-50`, `payments/index.ts:356`). Check both belong to the business.
- **G-19:** check in Vercel and Supabase whether dev.grumi.pet uses the production project. If it does, test mode and live keys share one project and one set of function secrets.
- **G-20:** Grumi's Stripe plan proposes a per-business Stripe "Test mode" on the production project. Same hole as G-1: make it dev-only, or flag test transactions and exclude them.

### Also for Grumi

- X-5 to X-8 and the server-only-writes rule are in the shared plans that Grumi now uses directly.

## Mezza

### M-5 (new): Money tables writable by owners, managers and servers (High)

- **Evidence:**
  - `supabase/migrations/20261005000300_rls.sql:42-57` (`owner_all`) gives owners full read and write on every table with `restaurant_id`: `payments`, `refunds`, `payment_accounts`, `subscriptions`, `usage_fees`; also `payment_allocations` (`20261006190000_split_engine.sql:79`).
  - `:105-107` let servers and managers insert and update `payments`.
  - No guard trigger exists.
- **Risk:**
  - Marking a table "paid by card" while keeping the cash.
  - Inserting refunds without going through `record_refund`.
  - Lowering `usage_fees` (what Stratum bills from).
  - Changing `stripe_account_id`, `ath_keys_secret_id` or `provider_ref`, so server code refunds or settles against another business's account.
- **Fix (planned):** writes only through the service role or security-definer functions, plus a trigger guarding status, amounts, method and `provider_ref`, with database tests per role.

### M-6 (new): Owners can change their own plan, status and trial (High)

- **Evidence:** `rls.sql:130-132` (`restaurants_update_owner`) covers `plan`/`status`/`trial_ends_at`; `owner_all` covers `subscriptions`.
- **Fix (planned):** a trigger that allows these changes only from the service role.

### M-7 (new): Card testing (High)

- **Problem:** guest pages are public. Payment rate limits use only the device cookie and the table, not IP (`src/app/r/[restaurant]/t/[token]/actions.ts:224`). Once Stripe hands out the PaymentIntent, retries go straight to Stripe, outside our limits. With direct charges, Radar runs on each restaurant's account.
- **Fix (planned):**
  - At most 3 failed confirmations per PaymentIntent, then cancel it.
  - At most 5 declines per table and per IP per hour.
  - A challenge after the first decline.
  - Card only on tabs with orders.
  - An alert on decline spikes.

### M-8 (new): No Content-Security-Policy (Medium)

- **Evidence:** `next.config.ts`, `src/proxy.ts` and `vercel.json` set none.
- **Fix (planned):** a CSP on guest pages, allowing only self and Stripe's documented hosts.

### M-9 (new): A provider error releases the hold locally (Medium)

- **Evidence:** `actions.ts:268-271` calls `cancel_pending_payment` when `createPayment` throws, without cancelling at the provider. After a timeout, an ATH push may still be live, or a PaymentIntent may exist.
- **Fix:** look up the payment by our idempotency key or metadata, cancel it at the provider, then release.

### M-10 (new): Tip cap (Low)

- **Evidence:** a custom tip can be up to $1,000 on any bill (`actions.ts:173`, `20261006190000_split_engine.sql:325`), and the card fee applies to it.
- **Fix:** cap a custom tip at, for example, 100% of the subtotal.

### M-11 (new): Live keys on previews (Medium)

- **Fixed in the Stripe plan:** live keys exist only in Vercel Production; the live check runs on production behind the flag.

### Items carried over from the first review

- **M-1:** push spam to any phone number. Rate limits and one open request per person.
- **M-2:** the guest status-check route only touches the caller's own tab.
- **M-3:** the simulator URL comes only from server environment, and production refuses anything but ATH's own.
- **M-4:** keys in Vault, amounts from `create_tab_payment`, the shared `settle()`, webhook dedupe and the package token kept in secrets only.

## Package (`payment_methods`)

Unchanged from the first review. ATH items (P-1, P-2 ATH half, P-3, P-4, P-8 to P-11, P-13):

- **P-1:** `subscribeWebhooks` must parse ATH's envelope. Add a real `checkCredentials()`.
- **P-2:** ATH has no idempotency. Apps insert a pending refund row first, call once, never auto-retry, and check `totalRefundedAmount` before any retry.
- **P-3:** the SQL template must keep `auth_token` in a service-only table, as Grumi does.
- **P-4:** move Grumi's `refresh()` lock logic into a shared `settle()` that both apps call. Per rule 2 it uses the stored `ecommerceId` and checks total and `metadata2`.
- **P-8:** the hosted simulator should only POST to allowed hosts. The Node server must never be deployed.
- **P-9:** put a version marker in copied files, and have app CI fail when they're older than the minimum safe version. Use a fine-grained read token.
- **P-10:** split the publish job, using a protected environment, and give the test job read-only package access.
- **P-11:** strip personal data from error details.
- **P-13:** add a lookup by `metadata2`, so an app can cancel an orphaned request after a timeout.

## Both apps

- **X-1:** one Stripe platform account per product. Resolved in Mezza's Stripe plan.
- **X-2:** ATH webhook registration may replace an existing listener. Ask Evertec, and warn on the connect screen.
- **X-3:** keep real ATH off until a live $1 payment, a cancel, an expiry and a partial refund pass.
- **X-4:** ask Evertec whether a platform may hold merchants' keys.
- **X-5 (new):** events count as done only when `processed_at` is set; a failed handler returns an error so the provider retries.
- **X-6 (new):** `settle()` reads the provider with our stored ids only.
- **X-7 (new):** a daily job compares our paid, refunded and disputed rows with the provider's, per business, and flags differences. This would catch G-1 to G-3 and M-5, and lost webhooks.
- **X-8 (new):** liabilities:
  - open overpayments escalate after 7 days and stay listed until resolved;
  - decide whether the card fee applies to tips;
  - merchant terms each business accepts before connecting: Stripe's connected-account agreement, fees, disputes being theirs, Stratum's fee not returned on lost disputes, overpayment handling, refunds only from the app, and pausing on fraud signals.

## Done well (keep it this way)

- Unsigned ATH webhooks are only used to find the payment, then re-checked with `findPayment`.
- Grumi keeps the per-payment `auth_token` in a service-only table, returns only public columns, finalizes behind a conditional-update lock, stores only the phone's last 4 digits, and shows short error codes.
- Mezza computes the amount in `create_tab_payment` (the phone sends only the option and tip), keeps webhook dedupe in `webhook_events` with `processed_at`, and stores ATH keys as a Vault reference.
- The package has no runtime dependencies and uses integer cents everywhere.
