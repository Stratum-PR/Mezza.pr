# Stripe plan (agreed 2026-10-07)

> **Shared document.** Identical copies live in `Stratum-PR/Mezza.pr`, `Stratum-PR/pet-hub` (Grumi) and `Stratum-PR/payment_methods`, at the same path. Change all three together. Each platform implements its own section and the security items in `docs/PAYMENTS_SECURITY_REVIEW.md`.

Stripe for Mezza (pass 4) and Grumi (`Stratum-PR/pet-hub`). Two separate builds on Stripe's official SDK, one set of shared rules. Nothing is built yet.

Stripe has two jobs in each app, planned separately:

1. **Card payments:** a restaurant charges its guests through Stripe Connect, one connected account per restaurant.
2. **Billing:** Mezza charges restaurants for their plan (Stripe Billing subscriptions).

This one file covers both apps: the shared rules and environments, Mezza's phases and Grumi's section. Grumi's detailed phases are added to the Grumi section of this same file, in all three copies.

Sources: [Accounts v2 for SaaS platforms](https://docs.stripe.com/connect/accounts-v2/saas-platform-payments-billing), [v2 responsibilities and dashboards](https://docs.stripe.com/connect/accounts-v2/connected-account-configuration), [integration recommendations](https://docs.stripe.com/connect/integration-recommendations), [controller properties (v1 fallback)](https://docs.stripe.com/connect/migrate-to-controller-properties), [Connect pricing](https://stripe.com/connect/pricing), [Puerto Rico availability](https://support.stripe.com/questions/stripe-availability-for-outlying-territories-of-supported-countries), [Stripe in Supabase Edge Functions](https://supabase.com/docs/guides/functions/examples/stripe-webhooks).

## Decisions (user, 2026-10-07)

- **No shared Stripe package.** Stripe's official SDK already runs on Node (Mezza) and Deno (Grumi's Edge Functions). A package would wrap a handful of SDK calls, while everything that matters (who computes the amount, holds, refunds, reports) lives in each app's database. What's shared is the rules below, copied into both plans. The ATH package is different because ATH has no SDK.
- **One Stripe platform account per product** (Mezza, Grumi), under one Stripe organization owned by Stratum PR. Each product gets its own name on onboarding and invoices, its own webhooks and sandbox, and its own risk review. This costs nothing extra: with Stripe billing businesses directly for its fees, Connect charges no account, payout or dashboard fees.
- **Stripe is liable for losses; each restaurant pays Stripe's fees; Express Dashboard.** Direct charges on the restaurant's account. Stratum isn't liable for chargebacks or negative balances. Restaurants see payouts and answer disputes in the Express Dashboard. Refunds there are turned off, so refunds stay in Mezza.
- **Mezza's 0.5% card fee is a per-payment application fee**, deducted by Stripe from each card payment. `usage_fees` becomes a report rather than an invoice.
- **Accounts v2** (Stripe's recommendation for new platforms). One Account per restaurant can be a merchant (takes card payments) and a customer (pays the subscription). If phase 0 finds a blocker, fall back to Accounts v1 with controller properties (merchant account plus a separate Customer); the rules don't change.

Defaults taken (change any by saying so):

- The application fee is charged on the full card amount (subtotal + IVU + tip). That matches `usage_fees.card_volume_cents` and `pricing.ts` ("card volume"). It's refunded proportionally (`refund_application_fee`) when a payment is refunded.
- Guests pay in Mezza's own page with Stripe's Payment Element and Express Checkout Element (Apple Pay, Google Pay), not a redirect to hosted Checkout.
- No Stripe Tax: IVU stays in `src/lib/money` and `create_tab_payment`. USD only.
- No card readers (Terminal) for now.

## Stripe rules (shared with Grumi, word for word)

1. **The amount comes from the database.** The server creates every PaymentIntent and Checkout Session from amounts stored by server code. The browser only ever receives a `client_secret` or a Checkout URL, never sends an amount.
2. **`settle()` is the only path to "paid", and running it again is harmless.** It retrieves the PaymentIntent (or Checkout Session) from Stripe using **our stored** connected-account id and PaymentIntent (or Session) id, never ids taken from a webhook payload or the browser, checks status `succeeded`, the amount received equals our row to the cent, currency `usd`, and `metadata.payment_id` matches. Three things call it: the payer's return or polling, the webhook and a sweeper. Whichever comes first wins.
3. **Webhooks are verified and deduped.** Every event's signature is checked on the raw body (`constructEvent` on Node, `constructEventAsync` with the SubtleCrypto provider on Deno) and stored by `(provider, event_id)`. It counts as done only when its handler finishes and sets `processed_at`; a handler that fails returns an error so Stripe retries it, and the retry runs again. An event that already has `processed_at` does nothing. Events only trigger `settle()` or a reconcile, never write "paid" from the payload alone.
4. **Idempotency keys come from our ids.** Creating a PaymentIntent uses our payment's idempotency key; refunds use our refund's id. A retry after a timeout returns the same Stripe object instead of charging twice.
5. **A hold ends at Stripe first.** When a pending card payment expires or the payer switches method, cancel the PaymentIntent (or expire the Checkout Session) before releasing what it held. If Stripe says it already succeeded, record it as paid.
6. **No automatic refunds.** Money that arrives for something already paid (for example, a cancel that lost the race) is recorded as received, shown as an overpayment and flagged. Staff decide and refund.
7. **Refunds: check, then Stripe, then us.** Check the staff role and the refundable amount; refund at Stripe (on the business's account, idempotent); then record it with Stripe's refund id (unique). A `charge.refunded` webhook records any Stripe refund missing on our side, so a crash between the two steps self-heals.
8. **Disputes are recorded and flagged**, never silently netted. The business answers them in the Express Dashboard.
9. **Keys live in server environment variables only** (restricted keys where possible): the platform secret key, webhook signing secrets and the publishable key. A business's Stripe account id is not a secret. Never collect card numbers in our own inputs; only Stripe's Elements or hosted pages touch them.
10. **Money rows are written by the server only.** No signed-in browser role can insert or update payments, refunds, payment accounts, subscriptions, usage fees or billing columns. Staff actions go through server functions that check the role.
11. **Reconcile daily.** A job compares our paid payments, refunds and disputes per business with Stripe's charges, refunds and disputes for the day, and flags any difference (a "paid" row with no charge, a charge with no row, an amount that differs).
12. **One SDK line.** Both apps pin the same `stripe` major version and the same `apiVersion`, and bump them together.

## How a restaurant connects (Ajustes → Pagos → Tarjeta)

1. Owner taps "Conectar Stripe". The server creates the restaurant's v2 Account once (merchant configuration with card payments, `dashboard: express`, `fees_collector: stripe`, `losses_collector: stripe`, country US, which covers Puerto Rico) and stores its id in `payment_accounts`. If the restaurant already has an Account as a billing customer, the merchant configuration is added to that one.
2. The server creates an account link and sends the owner to Stripe-hosted onboarding (identity, bank account). Stripe keeps collecting any later requirements itself.
3. On return, and on every account event, the server re-reads the Account and stores status: `pending` (requirements due), `connected` (card payments active), `unavailable` (restricted). It also registers the guest domain as a payment-method domain on that account, so Apple Pay works with direct charges.
4. `status()` reads the stored state, and `availableMethods` already shows card only when connected. The owner can open their Express Dashboard (login link) from Ajustes.

## Separate Docker test environments (required)

Each repo tests in its own environment, so Mezza and Grumi never share a database, ports, containers or Stripe sandbox. Each runs with one command, and CI runs the same setup.

| | Mezza | Grumi |
|---|---|---|
| Supabase | `project_id = "mezza"`, 55320–55329 (exists) | its own local stack, 55420–55429 |
| Stripe | Mezza's own sandbox (test mode) | Grumi's own sandbox (test mode) |
| Webhooks | `stripe/stripe-cli` container running `stripe listen` → `http://host.docker.internal:<app port>/api/webhooks/stripe/…` (E2E: 3100 prod build, 3000 dev) | `stripe/stripe-cli` container → `http://host.docker.internal:55421/functions/v1/stripe-webhook` |
| Offline unit tests | `stripe-mock` on 55331 | `stripe-mock` on 55431 |
| ATH fake (from the ATH plan) | 55330 | 55430 |

- The Stripe CLI only makes outgoing connections, so it publishes no ports. It prints the sandbox's webhook signing secret, which the test run passes to the app.
- Integration and E2E tests use real Stripe test mode: the test cards for success, decline, 3-D Secure and dispute, test connected accounts onboarded with Stripe's test data, and `stripe trigger` for events. Unit tests run offline against `stripe-mock` or an injected HTTP client.
- CI needs one restricted sandbox key per repo, as a secret. Test data is seeded per run; no live keys anywhere in these environments.
- There's no shared code, so nothing needs testing on both runtimes: Mezza's code runs on Node, and Grumi's runs inside Supabase's edge runtime in Grumi's own environment.

## Phase 0: Sandbox spike (no real money)

A throwaway script against a new Mezza sandbox. Record answers in this file.

- [ ] Create the Stratum Stripe organization and the Mezza platform account; enable Connect; complete the platform profile for "software platform, direct charges"
- [ ] v2 Account with merchant + customer configurations, `dashboard: express`, `fees_collector: stripe`, `losses_collector: stripe`, US with a Puerto Rico address; onboarding through an account link
- [ ] Turn off refunds in the Express Dashboard settings; confirm disputes can be answered there
- [ ] Direct charge: PaymentIntent on the account with an application fee; check who paid which fee; refund with `refund_application_fee`
- [ ] Subscription billed to the same Account (`customer_account`), with a trial ending on a given date; Customer Portal
- [ ] Which webhook endpoints are needed: snapshot events for payments (Connect endpoint), billing events (platform endpoint), and v2 account events (thin events / event destination); the Stripe CLI forwards each
- [ ] Payment-method domain registration on a connected account; Apple Pay in the Payment Element on a phone over the LAN
- [ ] SDK: current `stripe` major on Node and the v2 namespace; pin `apiVersion`

If any v2 item fails, use Accounts v1 with controller properties for that part and note it here.

## Mezza: pass 4

Fits the existing connector: `PaymentProvider` for `card` in `src/connectors/payments` (`startOnboarding`, `PaymentNext` with `client_secret`, `handleWebhook` already exist), `MEZZA_PAYMENTS_CARD=stripe`, flag `cardPayments`; billing in `src/connectors/billing`, `MEZZA_BILLING=stripe`. Every pass 2 rule stays: amounts come from `create_tab_payment`, every payment records what it covered, IVU per payment is the difference in cumulative IVU, tip is a percent of the pre-tax subtotal, one pending payment per phone.

### Phase 1: Data
- [ ] Migration: `payment_accounts` gets the account's state (charges enabled, requirements due, dashboard, connected_at, last checked); `payments` gets `application_fee_cents` and the PaymentIntent id in `provider_ref` (indexed); `refunds` gets `provider_refund_id` (unique); a `payment_disputes` table (payment, Stripe dispute id, amount, status, reason, opened/closed), listed apart in Reportes like write-offs
- [ ] `subscriptions` gets the Stripe subscription id, price, status and period end; `restaurants.status` follows it
- [ ] **Holds:** the 15-minute expiry in `create_tab_payment` and `close_idle_tabs` skips pending card payments that have a PaymentIntent. Those end only through `settle()` (rule 5), which cancels at Stripe and then releases. Without this, the database could free lines while the card payment still succeeds.
- [ ] Webhook dedupe through `webhook_events` (provider `stripe`), done only when `processed_at` is set (rule 3); RLS: none of the new columns readable by guests; database tests
- [ ] **Money tables written by the server only (rule 10).** Today `owner_all` (20261005000300_rls.sql) gives owners INSERT/UPDATE/DELETE on every table with `restaurant_id`, including `payments`, `refunds`, `payment_accounts`, `subscriptions`, `usage_fees` and `payment_allocations`, and `payments_insert/update_manager_server` let servers and managers write payments. Replace with: SELECT for staff as today; writes only by the service role or `security definer` functions. Cash keeps working through server code (`cash.ts` already confirms on the server). A trigger rejects any change to `status`, amounts, `method` or `provider_ref` on card/ATH payments unless made by the service role
- [ ] **Billing columns locked:** a trigger on `restaurants` rejects changes to `status`, `plan` and `trial_ends_at` (and the same on `subscriptions`) unless made by the service role; `restaurants_update_owner` keeps the rest editable
- [ ] Database tests: an owner, manager and server each fail to mark a card payment paid, change its amount or `provider_ref`, insert a refund, change `payment_accounts.stripe_account_id`, or change plan, status or trial

### Phase 2: Connecting a restaurant
- [ ] Ajustes → Pagos → Tarjeta (owner only): connect, resume onboarding, status, what Stripe still needs, "Abrir panel de Stripe" (Express Dashboard login link); audited
- [ ] Account events and the onboarding return refresh the stored status; payment-method domain registered on connect
- [ ] Strings in `es.json` and `en.json`; 390/768/1280, light and dark

### Phase 3: Provider and server routes
- [ ] `createPayment`: the pending payment from `create_tab_payment` → PaymentIntent on the restaurant's account (amount = subtotal + IVU + tip; `application_fee_amount` = 0.5% half-up via `src/lib/money`; metadata: payment id, restaurant, tab; idempotency key = the payment's) → `{ kind: "client_secret" }`
- [ ] `settle(paymentId)` per rule 2; on success it reuses cash's "mark paid" path (extract it from `cash.ts` so cash, mocks and Stripe share it: fiscal `recordSale`, `refreshRecentSales`)
- [ ] Routes: the settle route the phone calls on return or while waiting; `/api/webhooks/stripe/connect` (payment, refund and dispute events of connected accounts); `/api/webhooks/stripe/platform` (billing, plus v2 account events as phase 0 decides); a sweeper for pending card payments, run as screens load (like `close_idle_tabs`) and from the cron
- [ ] Declined card: the same PaymentIntent is retried. Switching method or backing out: cancel the PaymentIntent, then `cancel_pending_payment`. A PaymentIntent that succeeds after its hold ended is recorded as received, and the overpayment is flagged (rule 6)
- [ ] Payment creation stays rate limited per phone and table (existing `pay:` keys), plus per IP (the device cookie can be cleared)
- [ ] **Card testing:** at most 3 failed confirmations per PaymentIntent (counted from `payment_intent.payment_failed`; then the PaymentIntent is cancelled and the phone must start over), at most 5 card declines per table and per IP per hour; a challenge (Cloudflare Turnstile or similar) after the first decline; card offered only when the tab has orders; an alert to the owner and Stratum on a decline spike. Radar on direct charges runs on each restaurant's account, so these limits are ours

### Phase 4: Guest screens
- [ ] Card on the pay screen: Express Checkout Element (Apple Pay, Google Pay) above the Payment Element, loaded with the restaurant's account id; amount shown from the server; Stripe's locale follows the guest's language
- [ ] 3-D Secure and the return URL land back on the table, which calls settle; then the receipt, as today
- [ ] Declined → try again or another method; the table's live balance shows "Pago en proceso" while a card payment is pending (exists)
- [ ] Strings in both languages; 390/768/1280, light and dark
- [ ] Content-Security-Policy on guest pages (none today: `next.config.ts`, `src/proxy.ts` and `vercel.json` set no CSP): `script-src` and `frame-src` limited to self and Stripe's documented hosts, so an injected script can't skim the payment page

### Phase 5: Staff, refunds and disputes
- [ ] Refunds and voids of card-paid lines follow rule 7: a pre-check of role and refundable amount, then Stripe, then `record_refund` with the Stripe refund id. A webhook-side variant, server-only and idempotent on `provider_refund_id`, records refunds that arrive only by webhook
- [ ] Overpayments flagged in Servicio and the table detail; a manager refunds them or keeps them with a reason (shared with the ATH plan's phase 5; whichever ships first builds it). An open overpayment older than 7 days is escalated to the owner and Stratum, and listed in Reportes until resolved
- [ ] Disputes: Servicio and Ajustes flag them with a link to the Express Dashboard; Reportes lists them apart
- [ ] Payments list and table detail show card payments with brand and last 4

### Phase 6: Billing (Stratum plans)
- [ ] `billing` connector `stripe`: Stripe Products and Prices per pricing model, by lookup key, from `src/config/pricing.ts`; model A's monthly base is the subscription, its card percentage is the application fee
- [ ] Plan page "Elegir plan": Checkout in subscription mode for the restaurant's Account (customer configuration), `trial_end` = `restaurants.trial_ends_at`; "Gestionar" opens the Customer Portal (card, invoices, cancel)
- [ ] Webhooks (`customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`) update `subscriptions` and `restaurants.status` (`trial`, `active`, `paused` while past due, `cancelled`); `current()` reads them
- [ ] Model C's ATH percentage can't be an application fee (ATH isn't Stripe): if model C is ever active, it goes on the monthly invoice from `usage_fees`

### Phase 7: Verification
- [ ] CONNECTORS.md tests in the Docker environment: webhook replay is idempotent; amounts equal subtotal + IVU + tip to the cent; a failed provider call leaves no `paid` row; refunds never exceed what was paid; onboarding status survives restarts. Add: the application fee to the cent, a hold that ends while Stripe succeeds (overpayment flag), and a refund recorded only by webhook
- [ ] E2E with test cards and the Stripe CLI (prod build on 3100): one guest pays by card; two phones pay at once (card + cash); 3-D Secure; decline then success; switch method; refund after a void; a dispute shows up
- [ ] Billing E2E: trial → subscribe → `invoice.payment_failed` → paused → paid → active; the Customer Portal opens
- [ ] Live keys exist only in Vercel's Production environment; previews and local use sandbox keys. The live check runs on production behind the flag (or a protected, non-public deployment), never on a public preview URL with live keys: connect one real restaurant (or a Stratum test business), a $1 card payment, a refund
- [ ] Turn on `cardPayments` and `MEZZA_BILLING=stripe` (merging to main deploys production, so ask first); update README, CONNECTORS.md, DECISIONS.md

## Grumi

Expected to be built by Genesis. Grumi's detailed phases go in this section. In short: the same rules; card payments through hosted Checkout shown as a QR code or link at the counter (clients pay on their own phone, Apple Pay included); built on Grumi's existing `payments` table, `payments` Edge Function and Settings → Pagos page (one row per card or ATH charge, so split tenders record what each paid); Edge Functions that read totals from the database; plan subscriptions for existing businesses; no platform fee on payments. Grumi uses its own Stripe platform account and sandbox.

Grumi's security items for Stripe (from `docs/PAYMENTS_SECURITY_REVIEW.md`):
- [ ] Rules 1–12 above, including server-only money writes (rule 10) and daily reconciliation (rule 11)
- [ ] G-20: any Stripe "Test mode" only outside production, or test transactions flagged and excluded from sales
- [ ] G-3 and G-13 first: the server computes the charge from a pending transaction, and billing columns on `businesses` are locked
- [ ] G-15: delete the raw card form in `src/pages/Payment.tsx`; card data only in Stripe's hosted pages
- [ ] G-19: confirm dev.grumi.pet doesn't share the production project's secrets; live keys only in production
- [ ] Merchant terms and overpayment deadline (Liabilities and terms below)

## Liabilities and terms (decide before phase 7)

- **Application fee on tips:** the default charges 0.5% on subtotal + IVU + tip. Decide whether tips are excluded (servers' money); `usage_fees.card_volume_cents` and `pricing.ts` change with it.
- **Terms with restaurants** (Stratum's merchant terms, accepted in Ajustes before connecting): Stripe's connected-account agreement; restaurants pay Stripe's fees; disputes and chargebacks are theirs; Stratum's application fee isn't returned on lost disputes; how long overpayments are held and who decides; refunds only from Mezza; Stratum may pause card payments on fraud signals.
- **Records:** keep payment, refund and dispute rows (and webhook events) for the period Puerto Rico tax rules require; never store card data.

## Later

- In-person card readers (Stripe Terminal). Tap to Pay needs a native app; a smart reader works from the web. Puerto Rico availability to be confirmed.
- Saved cards for repeat guests, deposits or no-show fees, Connect embedded components inside Ajustes.

## Questions for Stripe (send when phase 0 starts)

1. Any Puerto Rico limitation for Accounts v2 merchant accounts, Express Dashboard, Apple Pay or (later) Terminal?
2. Can one organization hold two Connect platforms (Mezza, Grumi), and can a business ever connect to both with one Account?
3. With `fees_collector: stripe`, are there any Connect fees at all for Express Dashboard access, and does Stratum qualify for the partner revenue share?
