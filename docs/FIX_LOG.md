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
