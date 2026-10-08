# Fix log

One entry per change unit (protocol in `docs/REMEDIATION_PLAN.md`). An entry stays **Ready, not
applied** until someone with production access completes steps 8–11 (backup, apply, verify, tag).
Nothing in this file has been applied to the hosted database by an agent.

## P0-1 — money rows are read-only to signed-in roles (#4)

- Finding: H1 (High). Staff could rewrite or forge payments through the REST API.
- Status: **Ready, not applied to production.**
- Failing test first: `supabase/tests/12_payment_writes.test.sql` (commit `8eadeed`). Before the fix:
  22/49 checks failed, and the run aborted at `confirm_cash_payment` (missing).
- Migration: `supabase/migrations/20261008000100_money_writes.sql`.
  - Drops the staff and owner write policies on `payments`, `payment_allocations`, `refunds`,
    `write_offs` and `write_off_allocations`. Owners keep read access.
  - Revokes INSERT/UPDATE/DELETE/TRUNCATE on those tables from `authenticated`.
  - Adds `confirm_cash_payment(uuid)`: SECURITY DEFINER, cash only, audited as `confirm_cash`.
- App: `src/connectors/payments/cash.ts` confirms through the RPC. `confirmCash`'s follow-up query is
  limited to the caller's restaurant (L4).
- Old test changed: `01_tenancy_and_roles` asserted "server can confirm a cash payment" with a raw
  UPDATE; it now asserts the opposite. `tests.affected` counts a refused statement (no privilege)
  as 0 rows changed.
- Gate A (local, 2026-10-08):
  - typecheck OK, lint OK, prettier OK on changed TS files, unit 224/224, build OK.
  - pgTAP: full suite (11 files, 672 tests) green except 12 before its test-grant fix; 01 + 12 re-run
    green (447/447).
- Gate B (E2E, production build, local stack): checkout, guest, service-flow, split-edge-cases and
  staff-tools specs.
  - 11 passed, 12 skipped (demo-only), 1 failed: `checkout.spec.ts` "even split".
  - That test fails before any cash confirmation and passes 3/3 alone, so it is timing under parallel
    load. Pre-existing: the assertion at line 157 uses the default 5 s wait while phones poll every 4 s.
  - Manual walkthrough of the screens: still to do by a person.
- Gate C: the REST exploit was re-run as the seeded server (`mesero@`). The PATCH on a payment now
  returns `42501 permission denied`, and reads still work.
- Rollback: `supabase/rollbacks/20261008000100_money_writes.down.sql`. Tested locally:
  - down restored the old 4 policies, and test 12 failed exactly as on `main`; up applied cleanly,
    and test 12 passed.
  - The first up after down failed because the enum value survives a rollback. Fixed with
    `add value if not exists`.
- Deploy notes: deploy the app and the migration together. The old app's cash confirmation (a table
  UPDATE) fails against the new database, and the new app's RPC call fails against the old one.
  Apply the migration first, then promote the Vercel deployment right away.
- Backup / applied / verified / tag: _pending (production owner)._

## P0-2 — memberships are read-only to signed-in roles; PIN hashes hidden (#5)

- Finding: H2 (High). A manager could promote staff to manager, add any account, deactivate staff
  and read every PIN hash through the REST API.
- Status: **Ready, not applied to production.**
- Failing test first: `supabase/tests/13_membership_writes.test.sql` (commit `74b1078`). Before the
  fix: 19/41 checks failed.
- Migration: `supabase/migrations/20261008000200_membership_writes.sql`.
  - Drops the manager insert/update policies and the owner's write-all policy; adds an owner read
    policy.
  - Revokes INSERT/UPDATE/DELETE/TRUNCATE from `authenticated`.
  - Grants SELECT on every column except `pin_hash`.
- App: no change. Equipo and the wizard already write memberships with the service role after their
  own checks. Every signed-in read names its columns. A `select=*` on `memberships` as a signed-in
  user now fails by design.
- Gate A: no TypeScript change, and the generated types are unchanged. Full pgTAP suite: 12 files,
  714/714.
- Gate B (E2E, production build): auth, signup, settings (Equipo), staff-ui and manager-tools specs.
  22 passed, 22 skipped (demo-only). Manual walkthrough: still to do by a person.
- Gate C, REST re-test as the seeded manager (`gerente@`):
  - reading `pin_hash` returns `42501`;
  - promoting the server returns `42501`;
  - reading the team's roles still works.
- Rollback: `supabase/rollbacks/20261008000200_membership_writes.down.sql`. Tested: down (test 13
  fails 19/41 as on `main`), then up (passes).
- Deploy notes: database only; it can go before or after the app.
- Backup / applied / verified / tag: _pending (production owner)._

## P0-3 — every restaurant keeps an active owner; one invite path (#6)

- Finding: M2 (Medium). The setup wizard's invite upserted the membership, so an owner who typed
  their own email as staff was demoted, leaving 0 owners. Equipo's invite guarded against this, but
  the two implementations had drifted. Equipo also let a manager demote another manager by
  re-inviting their email.
- Status: **Ready, not applied to production.**
- Failing tests first (commit `ac8028f`):
  - `supabase/tests/14_keep_an_owner.test.sql`: 4/9 failed before the fix.
  - `src/lib/team/invite.test.ts`: the module didn't exist yet.
- Migration: `supabase/migrations/20261008000300_keep_an_owner.sql`. A deferred constraint trigger
  refuses any change that leaves a restaurant without an active owner.
  - Ownership transfer in one transaction works.
  - Deleting the restaurant works.
  - Deleting the only owner's auth account is refused (hand over or delete the restaurant first).
- App: new `src/lib/team/invite.ts` `addMember()`, used by both Equipo (`inviteMember`) and the
  wizard (`wizardInvite`):
  - never changes an owner's membership;
  - only the owner adds or changes managers;
  - the invite link uses `NEXT_PUBLIC_SITE_URL`, not the request `Origin`. This fixes M6 for these
    two paths; signup and the payments onboarding link still use `Origin` (Phase 2).
- Gate A: typecheck OK, lint OK, unit 230/230 (+6), pgTAP 13 files 723/723, build OK.
- Gate B (E2E, production build): signup (includes the wizard's invite step) and settings (Equipo
  invite and deactivate). 6 passed, 6 skipped (demo-only). Manual walkthrough: still to do by a
  person.
- Gate C: test 14 plus test 13 (no direct membership writes) green.
- Rollback: `supabase/rollbacks/20261008000300_keep_an_owner.down.sql`. Tested: down (test 14 fails
  4/9), then up (passes). The app change does not depend on the migration.
- Deploy notes: before applying, check production has no restaurant without an active owner:
  `select r.id from restaurants r where not exists (select 1 from memberships m where m.restaurant_id = r.id and m.role = 'owner' and m.active);`
  It should return 0 rows. The trigger only checks future changes, but any restaurant listed would
  block its own staff edits.
- Backup / applied / verified / tag: _pending (production owner)._

## P0-4 — tabs are read-only to signed-in roles; audited POS close (#7)

- Finding: M3 (Medium). Staff could close any tab (skipping `close_tab`'s settled check and audit),
  raise a table's QR cap (`qr_limit_extra_cents`) without `raise_tab_limit`, or delete tabs, through
  the REST API. "Cerrado en el POS" was a raw, unaudited UPDATE.
- Status: **Ready, not applied to production.**
- Failing test first: `supabase/tests/15_tab_writes.test.sql` (commit `133d99a`); before the fix
  owner, manager and server could write tabs, and `close_tab_on_pos` did not exist.
- Migration: `supabase/migrations/20261008000400_tab_writes.sql`.
  - Drops the staff and owner write policies on `tabs`; adds an owner read policy.
  - Revokes INSERT/UPDATE/DELETE/TRUNCATE from `authenticated`.
  - Adds `close_tab_on_pos(uuid)`: SECURITY DEFINER, audited as `pos_close`. It updates the same
    columns as before and keeps the first POS time.
- App: `closeOnPos` (`src/lib/staff/actions.ts`) calls the RPC. Fix commit `c16ea2a`.
- Gate A: typecheck OK, lint OK, unit 230/230, pgTAP 14 files 763/763, build OK.
- Gate B (E2E, production build): service-flow (the POS close), staff-tools, manager-tools,
  order-limits (raise limit), shared-tab and checkout.
  - All passed except one `manager-tools` refund run inside the parallel batch. It passed 2/2 alone,
    and the same refund through the API works, so it is test data shared between parallel runs, not
    this change.
  - Manual walkthrough: still to do by a person.
- Gate C: the REST re-test as the seeded server (`mesero@`), PATCH `tabs` status/limit, returns
  `42501`; reading tabs still works.
- Rollback: `supabase/rollbacks/20261008000400_tab_writes.down.sql`. Tested: down (test 15 fails),
  then up (passes).
- Observation, unchanged on purpose: a POS close on a tab that `close_tab` already closed moves
  `closed_at` to the POS time, exactly as before. Review in Phase 2 whether reports should keep the
  original close time.
- Deploy notes: like P0-1, deploy the app and the migration together. Apply the migration, then
  promote the Vercel deployment right away.
- Backup / applied / verified / tag: _pending (production owner)._
