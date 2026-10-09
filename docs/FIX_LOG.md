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

## P2-1 — append-only audit log; owners can't edit billing state (#13)

- Finding: M1 (Medium). Owners could delete or edit audit entries, set their own plan, status, trial
  end, order numbering, onboarding step and fiscal mode, and write subscriptions and usage fees.
- Status: **Ready, not applied to production.**
- Failing test first: `supabase/tests/17_owner_limits.test.sql` (commit `954d846`): 13/24 failed.
- Migration: `20261008000500_owner_limits.sql`.
  - `audit_log`, `subscriptions` and `usage_fees` are read-only to signed-in users.
  - `restaurants` UPDATE is limited to the 15 settings columns Ajustes edits.
- App: `saveLimits` and `decideSupport` write audit entries with the service role.
- Gates:
  - pgTAP 789/789 at the time; rollback cycle OK; unit, typecheck, lint, format OK.
  - E2E settings + order-limits: 5 passed, after fixing a strict-mode locator in `settings.spec.ts`
    that fails on a fresh database (pre-existing).
  - Access snapshot regenerated; its diff is exactly these access changes.
- Rollback: `supabase/rollbacks/20261008000500_owner_limits.down.sql`.
- Deploy: apply the migration together with the app; the old app writes audit rows as the owner.
- Backup / applied / verified / tag: _pending (production owner)._

## P2-2 — new functions and tables closed by default (#14)

- Finding: M4 (Medium). Every new function was executable by anon/authenticated, and every new table
  open to anon, unless its migration remembered to revoke. `report_summary` and
  `storage_restaurant_id` were executable by anon.
- Status: **Ready, not applied to production.**
- Failing test first: `supabase/tests/18_default_privileges.test.sql` (commit `a89531b`).
- Migration: `20261008000600_default_privileges.sql`.
  - Revokes the per-schema defaults, plus Postgres's global PUBLIC EXECUTE default for the migration
    role; a per-schema default can only add to the global one.
  - Revokes the two functions from anon.
  - **From now on every migration must `grant execute ... to authenticated, service_role` explicitly**
    (Phase 7 rule).
- Tests that create `pg_temp` helpers opt back in inside their own transaction.
- Gates: pgTAP 17 files 797/797, `db:check` OK, rollback cycle 6/6, types match.
- Rollback: `supabase/rollbacks/20261008000600_default_privileges.down.sql`.
- Deploy: database only, any order.
- Backup / applied / verified / tag: _pending (production owner)._

## P2-4 — links use the site URL, never the Origin header (#16)

- Finding: M6 (Medium).
- Status: **Ready, not applied to production** (app only, no migration).
- Failing test first: `tests/unit/no-origin-links.test.ts` (commit `deeab6e`). It flagged
  `lib/auth/actions.ts`, `lib/auth/signup.ts` and `empezar/actions.ts`.
- Fix: signup confirmation, magic link, password reset and the payments onboarding return URL use
  `NEXT_PUBLIC_SITE_URL`. Make sure Vercel sets it to the production URL.
- Gates: unit 231/231, typecheck, lint, format, E2E signup + auth 8 passed.

## P2-3 — exact account lookup by email (#15)

- Finding: L2 (Low). Adding an existing account to a team (Equipo, setup wizard) listed the first
  1000 accounts and searched them; an account past the first page was "not found".
- Status: **Ready, not applied to production.**
- Failing tests first (commit `171ffb8`): `supabase/tests/19_user_lookup.test.sql` (the function
  didn't exist) and `src/lib/team/invite.test.ts` (5/7 failed once `listUsers` is off limits).
- Migration: `20261008000700_user_lookup.sql`. `auth_user_id_by_email(text)`: SECURITY DEFINER,
  exact match ignoring case and spaces, `service_role` only (anyone else could probe which emails
  have an account).
- App: `addMember` (`src/lib/team/invite.ts`) calls it. Fix commit `32ad912`.
- Gates:
  - `pnpm check` green: unit 232/232, pgTAP 18 files 807/807, build OK.
  - Rollback cycle (7 migrations) OK; after the down script test 19 fails, after up it passes.
  - Access snapshot regenerated: no change (anon and authenticated gain nothing).
  - Gate C, local REST: the RPC as anon returns `42501`; as the service role it answers.
  - E2E (production build, local stack): signup, settings (Equipo invite), auth and service-flow
    specs, 14 passed. The Equipo spec invites a new address, so the existing-account path is covered
    by the unit test and the REST check.
- Rollback: `supabase/rollbacks/20261008000700_user_lookup.down.sql` (deploy the previous app first).
- Deploy: apply the migration with or before the app; the new app calls the function.
- Backup / applied / verified / tag: _pending (production owner)._

## P2-5 — the restaurant is created after the email is confirmed (#17)

- Finding: M7 (Medium). Signup created the restaurant, slug and trial before the email was
  confirmed, so a typo or someone else's address got a restaurant.
- Status: **Ready, not applied to production.** Decisions (user, 2026-10-08) in `DECISIONS.md`
  under "Signup after email confirmation".
- Failing tests first (commit `9c2c910`):
  - `supabase/tests/20_pending_signups.test.sql`: the table didn't exist.
  - `src/lib/auth/signup.test.ts`: signup called `create_restaurant_with_owner` with no session.
  - `src/lib/auth/finish-signup.test.ts`: the module didn't exist.
- Migration: `20261008000800_pending_signups.sql`: `pending_signups` (one row per account, deleted
  with it), RLS on with no policies, `service_role` only.
- App (fix commit `7325bd4`):
  - `signUp` saves the details and returns "confirm your email". With confirmation off (local, E2E)
    Supabase returns a session and the restaurant is created right away, as before.
  - `finishSignup` (`src/lib/auth/finish-signup.ts`) checks `email_confirmed_at` with the admin API,
    claims the pending row with a delete (two calls can't create two restaurants), picks the slug,
    creates the restaurant, and puts the row back if that fails.
  - It runs in `/api/auth/callback` (then straight to the wizard) and on `/app` for a signed-in user
    with no restaurant (confirmed on another device, where the PKCE exchange fails).
- Old test changed: `00_schema` lists the tables without `restaurant_id`; `pending_signups` joins it.
- Gates:
  - `pnpm check` green: unit 239/239, pgTAP 19 files 820/820, build OK.
  - Rollback cycle (8 migrations) OK; after the down script test 20 fails, after up it passes.
  - Access snapshot regenerated: one line, `rls pending_signups on`.
  - E2E (production build, local stack): the same 4 specs, 14 passed; `signup.spec.ts` runs the
    confirmation-off path through `finishSignup`. The confirmation-on path (production) is covered by
    unit tests only, because local auth has confirmation off. Manual check on a preview with
    confirmation on (same device and a second device): still to do by a person.
- Rollback: `supabase/rollbacks/20261008000800_pending_signups.down.sql`. Deploy the previous app
  first. Signups still waiting for confirmation are lost; list them before rolling back.
- Deploy: apply the migration first, then promote the app (the new signup writes the table).
  Existing restaurants are unaffected.
- Backup / applied / verified / tag: _pending (production owner)._

## P3-1 — unused staff-session connector and browser DB client removed

- Finding: Phase 3 dead code (low).
- Status: **Merged into the remediation branch.** App only, no migration.
- Proof it was unused: no file outside `src/connectors/staff-session/` imports it, and nothing imports
  `src/lib/db/browser.ts`. `@supabase/ssr` stays (used by `lib/db/server.ts` and `proxy-session.ts`).
- Also: `MEZZA_STAFF_SESSION` removed from `.env.example`; `CONNECTORS.md` updated.
- Gate A: typecheck, lint, format, unit 239/239, build green locally; CI run 37963346732 green
  (incl. database tests).
- Rollback: `git revert` of the merge commit. Deploy notes: none.

## P4-3 — ESLint restricts the service-role client

- Finding: Phase 4 structure (low; defense in depth on top of `import "server-only"`).
- Status: **Merged into the remediation branch.** Lint config only.
- Failing test first: `tests/unit/admin-import-rule.test.ts` (10 cases; the 4 "rejects" cases fail on
  the old config). Probe files importing `@/lib/db/admin` from `src/components` and `src/app/r` failed
  `pnpm lint` with `no-restricted-imports`; existing code has 0 problems.
- Gate A: typecheck, lint, format, unit 249/249, build green locally; CI run 37963580055 green.
- Rollback: `git revert` of the merge commit. Deploy notes: none.

## P5-1 — indexes for the unindexed foreign keys

- Finding: Phase 5 performance (low). 56 foreign keys in `public` had no covering index (38 at audit
  time; later migrations added more).
- Status: **Merged into the remediation branch. Ready, not applied to production.**
- Failing test first: `supabase/tests/22_fk_indexes.test.sql` (commit `5f5ddc2`, red in CI run
  37963972350 listing the 56). A generic catalog check, so any future FK without an index fails it.
- Migration: `supabase/migrations/20261009000200_fk_indexes.sql`. 52 indexes (four composite
  `(restaurant_id, …)` indexes also cover the plain `restaurant_id` FK), `create index concurrently
if not exists`. Supabase CLI 2.119 runs those statements outside the migration transaction.
- Gate A–C: CI run 37964537591 green (pgTAP, rollback cycle, types diff, drift, smoke E2E).
- Rollback: `supabase/rollbacks/20261009000200_fk_indexes.down.sql` (drops concurrently), tested in
  that CI run.
- Deploy notes: indexes only, no app dependency. Apply outside service hours (each build waits for
  long transactions on its table). Afterwards `select indexrelid::regclass from pg_index where not
indisvalid;` must return 0 rows; drop any it lists and re-run.
- Follow-up (not done): `orders(tab_id)`, `payments(tab_id)` and `order_items(order_id)` now have a
  second, composite index on the same key; dropping the old ones is a later decision.
- Backup / applied / verified / tag: _pending (production owner)._

## P3-4 — one tab-closing path (Mesa libre, POS close, idle close)

- Finding: Phase 3 duplicate code (low). Three copies of the close. "Cerrado en el POS" left the
  tab's open service requests in Servicio and overwrote `closed_at` on a table already freed.
- Status: **Merged into the remediation branch. Ready, not applied to production.**
- Failing test first: `supabase/tests/21_one_tab_close.test.sql` (commits `ca1cf06`, `6b83071`;
  11/48 failing before the fix, CI run 37963629043). Renamed from `16_` at merge (number taken).
- Migration: `supabase/migrations/20261009000100_one_tab_close.sql`. New internal
  `close_tab_core(uuid, uuid, audit_action, jsonb)`: SECURITY DEFINER, execute granted to no role.
  `close_tab`, `close_tab_on_pos` and `close_idle_tabs` keep names, signatures, grants and checks and
  close through it. Idle close stays unaudited, as before.
- Behavior changes (owner approved 2026-10-09): POS close of a still-open tab marks its open
  requests handled; a table already freed keeps its first `closed_at`.
- App: no change. `src/lib/db/types.ts` gains the `close_tab_core` entry (generated shape).
- Gate A–C: CI run 37964214847 — pgTAP 868/868, rollback cycle, unit, build, smoke E2E green; the
  types step failed only for the missing entry, added at merge.
- Rollback: `supabase/rollbacks/20261009000100_one_tab_close.down.sql`, tested in that CI run.
- Deploy notes: no order dependency (RPC names and grants unchanged).
- Verification (suggested): the three functions' bodies call `public.close_tab_core(`;
  `has_function_privilege('authenticated','public.close_tab_core(uuid,uuid,public.audit_action,jsonb)','execute')`
  is false.
- Backup / applied / verified / tag: _pending (production owner)._

## P3-2 — unused exports removed; knip in `pnpm check` and CI

- Finding: Phase 3 dead code (low). knip 6.36.0 reported 23 unused exports and 27 unused exported
  types.
- Status: **Merged into the remediation branch.** Code only, no migration.
- Done: dead code deleted (`Chips`, `Tag`, `MENU_IMAGE_TYPES`, `isDemoMode`, `FlagName`, connectors
  `Role`, next-intl `redirect`/`getPathname`); symbols used only in their own file un-exported.
  Kept and tagged `@public`: `needsReview` (menu-import contract) and `defaultPrinterProtocol`
  (printing registry), both documented in `CONNECTORS.md`.
- Config: `knip.json`; `pnpm knip` runs in `pnpm check` (after lint) and as a CI step.
- Gate A: typecheck, lint, knip (0 findings), format, unit 249/249, build green; CI run 37971946157
  green (incl. database tests and smoke E2E).
- Rollback: `git revert` of the merge commit.
- Open: `MEZZA_PRINTER` is documented but nothing reads it at runtime, and `needsReview` isn't called
  by the import review. Decide later whether to wire up or drop.

## Handoff (2026-10-08) — where the next session starts

- **Production is 8 migrations behind the branch** (`20261008000100`–`000800`). Deploy order: take a
  backup, apply the migrations, promote the matching Vercel build right away, then re-take the
  snapshot (`supabase/snapshots/prod-<date>@<version>.sql`) so CI's drift check is current.
- **Drift:** the first real check (snapshot at `20261007000000`) found **no drift**.
- **Phase 2 is done in code** (P2-3 and P2-5 added 2026-10-08, second session). Phase 7's rules are in
  AGENTS.md.
- **Then:** Phase 6 (the PR into `main`; rulesets are on), Phase 3, Phase 4 (lint rule + READMEs) and
  Phase 5 (indexes). Phase 7's later items (architecture map, per-feature READMEs, agent deny-list
  and lint hook) wait for Phases 3–4.
- **Vercel settings found 2026-10-08 (read-only check; owner to change):**
  - **Previews use production.** Every variable targets Production and Preview, including
    `NEXT_PUBLIC_SUPABASE_URL` (the production project), `SUPABASE_SERVICE_ROLE_KEY`,
    `QR_TOKEN_SECRET` and `CRON_SECRET`; `MEZZA_DEMO_MODE=false`. So every PR preview (e.g. PR #18)
    is a second writer to the only database with the service role, against the Environments rule.
    PR #18's preview runs code that needs the 8 pending migrations, so signup, cash confirmation,
    POS close and adding an existing account fail there. Don't test on it.
    Fix: untick Preview on those variables (or point previews at a demo/throwaway database), make
    sure Deployment Protection covers previews, then redeploy or delete existing previews (they
    keep the values they were built with).
  - **Rate limits are off in production:** `MEZZA_RATE_LIMIT=noop` (the code's default is
    `postgres`). Signup, guest-order and other per-IP/per-phone limits don't apply. Set it to
    `postgres`, or record in `DECISIONS.md` why `noop` is intended.
- **Known issues:**
  - GitHub reports 1 moderate Dependabot alert on the default branch.
  - `checkout.spec.ts:157` ("even split") is timing-sensitive under parallel load.
  - In this cloud container the `09_split_engine` property test once stalled after a rollback cycle.
    This was not seen in CI; investigate if it ever happens there.
  - `pnpm db:drift` resets the local database without `seed.sql`. Run `supabase db reset` before
    `pnpm seed` afterwards.
  - On Windows, don't `source .env.local` in bash before E2E: it strips the backslashes from
    `SWC_NATIVE_BINDING_CACHE` and the build fails. Unset that variable after sourcing (Next.js reads
    `.env.local` itself).
- **Not done by an agent:** manual walkthroughs (Gate B) and every production step.
