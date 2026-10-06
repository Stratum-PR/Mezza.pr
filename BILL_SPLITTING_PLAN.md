# Bill splitting: agreed first-release scope

Decision date: 2026-10-05, America/Puerto_Rico.
Status: product and implementation plan approved; functionality not implemented.

This document records the final choices from the planning discussion. It supersedes earlier proposals for guest allocation voting, five-minute separation, continuous ordering during settlement, multiple independent checks within a visit, and direct kitchen submission.

## Visit and admission

- Staff opens a visit when seating a party. One physical table has one active visit and one bill.
- The permanent QR always allows menu browsing. Ordering requires an open visit.
- Diners join without a visit code or per-phone approval, choose a name or editable appropriate nickname, and receive a visit-bound session.
- Show join notifications. Staff may revoke participant access; revocation does not delete charges.
- Names are display labels, never identity or authority. Duplicate names need distinguishing labels; misleading staff-role names must be prevented.
- Sessions expire four hours after joining; staff may extend or recover access. Recovery revokes the replaced session.
- All guest actions validate the original session, restaurant, table, participant, and visit. Closed-visit requests are rejected, never retargeted to a new live visit.
- Accepted limitation: a saved permanent QR can join an active visit. Expiry and removal do not reliably prevent entry from a fresh browser. Do not claim physical-presence verification.

## Named personal carts and ordering

- Each participant controls and submits their own cart. Other participants see named draft selections, clearly distinguished from submitted orders.
- Synchronize drafts through the server. Version checks reject stale edits across browser tabs rather than overwriting newer changes.
- Different diners ordering identical items is legitimate. No similarity warning.
- Each submission has a stable idempotency key retained across double taps, timeouts, and retries.
- Staff accepts submitted orders in Servicio before routing to the kitchen. Several submissions may be accepted together, preserving individual identities.
- Pending and rejected requests are not billable accepted orders. Rejections notify the diner with a reason.
- Validate availability, quantities, modifiers, prices, and permissions on the server. Accepted orders retain snapshots of names, prices, applicable tax rates, and calculated tax components.
- Submission actor, intended diner/item allocation, and eventual payer are separate concepts.
- Staff-entered orders may be attributed to a diner or shared recipients. Unassigned charges remain visible and must be resolved before split finalization.
- Restaurant-configurable quantity/value and submission limits apply across participant, visit, and restaurant, using a shared limiter across application instances. Add an ordering pause that preserves collection and receipt access.
- Thresholds require pilot tuning. Rate limiting does not guarantee collection or prevent all fake orders.

## Kitchen delivery and cancellation

- Distinguish stored request, staff acceptance, routing, and kitchen acknowledgment where available.
- Use stable ticket IDs. Show routing failures and uncertain delivery to staff.
- Where a printer cannot guarantee exactly-once delivery, staff checks uncertain delivery before retrying; reprints are labeled.
- A submitted-item cancellation is a staff-reviewed request. Charges remain until an authorized void.
- Coordinate cancellation, routing, and preparation transitions with authoritative state checks. Stale actions cannot resurrect a cancelled item.
- Resolve pending order acceptance and cancellation requests before finalizing checkout.

## Checkout and splits

- Staff locks the entire bill before allocating payment portions. No new orders enter the locked bill.
- Warn about unsent carts before locking, notifying affected diners. Drafts remain uncharged and cannot submit while locked.
- Locking and order acceptance/submission races have an atomic outcome: the accepted order is included, or the late operation is rejected.
- Staff supports even splitting and splitting by assigned items. Guests view their assigned portions; no guest claiming/rejecting, voting, timers, or automatic separation.
- Staff can allocate individual whole quantities from a multi-quantity order line.
- One shared dish may be assigned to one portion or divided equally among selected portions. Defer arbitrary percentages.
- Allocate each billable quantity/cost exactly once. All portions sum exactly to the bill's subtotal and each stored IVU component, with deterministic cent remainders.
- Preserve accepted order tax snapshots. Do not recalculate the original sale independently for each new portion.
- Staff manages diners without phones and resolves unassigned/disputed allocations.
- No automatic guarantor for another diner's balance.
- Before any reservation or payment, staff may invalidate the portions and unlock for more orders. Affected phone views refresh.
- Paid allocations are immutable. Do not reopen a partially paid bill for ordinary new orders.
- Additional orders after partial payment require completing/resolving the current visit and explicitly opening a new visit, or staff handling them outside this first-release workflow. Old guest sessions are revoked; old receipt access remains.

## Cash settlement and receipts

- First-release settlement uses actual cash confirmed by authorized staff. Card/ATH collection is deferred until real integrations exist.
- Require full settlement of each portion. Insufficient tender leaves the portion unpaid; do not record a partial payment in this release.
- Several diners may contribute cash to one portion, but confirmation happens only when combined tender covers it.
- Separate tendered cash, change, payment amount, and explicit tip. Excess tender is not automatically a tip.
- Cash requests are pending, not paid. Staff may cancel an abandoned pending request without removing the balance.
- One active reservation per portion. Payment creation, confirmation, and cancellation are atomic and idempotent. Payment confirmation and cancellation cannot both succeed.
- Staff may record one payment covering several unpaid portions. The payer receives one receipt listing all covered portions. Beneficiaries see their settled amount and payer display name, without payment credentials/details.
- Every payment links to its covered portions. Payment allocations cannot cross visits or restaurants.
- Guest session expiry does not cancel payment reconciliation or erase obligations.
- Private receipt access uses a separate, unguessable receipt-scoped token and expires seven days after visit closure; downloads remain available afterward.
- Defer SMS receipts. No automatic phone collection.

## Staff permissions and financial corrections

- Servers: accept orders, allocate items/portions, confirm cash, assist participant recovery, and perform authorized routine voids under existing restaurant policy.
- Managers/owners: contested-allocation overrides, refunds, and write-offs. Require reasons and audit records.
- Before payment, a void updates billable charges and invalidates affected unpaid portions. Resolve any active reservations before recalculation.
- After payment, a manager records a linked refund and sale adjustment; do not silently reopen balances or charge someone else.
- An abandoned balance stays due until someone explicitly covers it or a manager records a write-off. A write-off is not cash collected.
- Reports distinguish sales, collected money, tips, refunds, voids, and write-offs.
- Use server-calculated integer-cent amounts and same-visit/restaurant database constraints. Guest/browser inputs never authorize money movements.

## Closure

- POS closure is refused until every portion is paid or explicitly resolved and no unresolved payment attempt or pending billable operation remains.
- Closure and guest mutations are coordinated atomically.
- Explicitly reject remaining unaccepted order requests; end unsent drafts.
- Revoke visit sessions and invitations immediately. Show only a payer's private receipt afterward; nonpayers see a visit-ended message.
- Do not reopen a closed visit automatically. Next party gets a new visit ID and no old drafts, orders, participants, or access.

## Implementation sequence and release verification

1. Visit-bound participant sessions, staff opening/closure, recovery, and access checks.
2. Server-backed named carts, versioning, submission idempotency, shared limits, and staff acceptance.
3. Bill locking, allocation records, quantity/shared-item splitting, and exact-cent calculations.
4. Whole-portion cash reservations/confirmation, payer-to-portion allocations, and protected receipts.
5. Void/refund/write-off adjustments, reporting, audit permissions, and closure guards.
6. Multi-phone and multi-staff verification, including concurrent submissions, stale edits, lock races, cancellation races, duplicate confirmation, insufficient cash, abandoned requests, session expiry, partial settlement, refunds, and next-party isolation.

No accepted charge may disappear through reassignment, removal, timeout, closure, or retries. Every charge has an auditable unpaid, reserved, paid, voided, refunded, or written-off disposition; reservation is not collection.

Operational settings still to tune: value/quantity limits, submission frequency, participant caps, kitchen acknowledgment capabilities, and restaurant void permissions. These do not authorize deploying an unverified implementation.

## Implementation status (2026-10-06)

Implemented behind `MEZZA_SPLIT_BILL=false`: staff opening and closure; four-hour HttpOnly guest sessions; same-identity recovery using one-use, ten-minute staff tickets; named server-backed carts and optimistic version checks; submission idempotency; staff acceptance before kitchen routing; guest cancellation requests; participant removal and join notifications; restaurant ordering pause; exact-cent even and per-unit/shared-item allocation; atomic whole-portion cash confirmation; explicit tips/change; multiple covered portions per payer; private receipts and text downloads; manager write-offs; existing linked manager refunds; reports distinguishing write-offs; locked-charge and closure guards; and blocking legacy QR-only reads/writes of managed bills.

Cash confirmation is one database transaction when staff has the full physical tender. This implementation creates no guest-initiated cash payment reservation or pending payment row. The portion stays unpaid until staff confirms cash. This avoids abandoned cash requests and confirmation/cancellation races in the cash-only release. Online collection and its reservation state machine remain deferred.

Current limits: 20 units per cart line, 100 units and $1,000 per saved cart, 500 accepted/pending/requested units per visit, 50 cart lines, 40 participants, 20 pending review/cancellation requests and 20 settlement portions. Shared Postgres counters fail closed and apply table/IP join limits, session mutation limits and table read limits. These are initial operational defaults, not fraud guarantees. A removed participant's pending submissions are rejected; accepted charges stay due. Recovery retains identity and charges, but discards an unsent draft.

The permanent QR remains an invitation to any open visit. Someone with the saved link can deliberately join again using a new session. Expiry/closure prevents old session access and stale mutations; it does not prove physical presence. Staff review and rate limits protect kitchen dispatch. This accepted limitation remains explicit.

Unit/property tests and PGlite migration/RPC tests pass. TypeScript, ESLint and the production build pass with synthetic environment values. Browser and real Supabase integration/concurrency verification are release gates. The cloud browser cannot access the workspace's loopback preview, the local browser test cannot launch because Chromium is not installed, and Docker is unavailable here. No production migration or flag change has been made.

### Release sequence

1. Merge the Original-menu prerequisite (PR #1) before merging this feature's stacked draft PR.
2. Apply the staged migration to an isolated Supabase staging project and regenerate checked-in public database types. The workflow tables stay in `mezza_private`; never expose that schema through the Data API.
3. Set `MEZZA_SPLIT_BILL=true` in staging only. Start with no legacy live visits. Staff must open a visit from Servicio before guests or staff take orders.
4. Run the browser fixture locally: `pnpm exec playwright install chromium`, then `pnpm test:bills:browser`. It uses synthetic Auth/PostgREST responses and real PGlite RPCs; it is not proof of real Supabase Auth/REST/RLS integration.
5. Verify real two-phone/two-staff flows, Auth/REST grants, kitchen progress, concurrent acceptance versus freezing, duplicate cash confirmation, partial-payment closure refusal, refunds/write-offs, receipt privacy/expiry and next-party isolation. Check no legacy events endpoint exposes managed payment IDs.
6. After review, apply the migration and enable the production flag in a separate authorized rollout. Do not disable the flag while managed visits remain live. To roll back, pause ordering, finish/resolved balances and close those visits before reverting the flag. Preserve the ledger tables and migration.

SMS, real card/ATH collection, autonomous ordering without staff review, guest-directed allocation and new ordering after partial payment remain outside this release.
