# Mezza remediation plan (DRAFT, not committed)

Source: read-only audit of `main` @ `f4e392d` (2026-10-08). Evidence for each finding is in the
audit summary; IDs below (H1, M2, ...) refer to it. Nothing in this plan has been applied.

## The protocol (every change unit follows it, no exceptions)

One **change unit** = one finding or one tightly related group. Each unit gets its own branch
`fix/<id>-<slug>`, its own PR, and its own tag.

| Step                      | What                                                                                                                                               | Done when                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1. Failing test first     | Write the test that proves the problem (pgTAP for DB/RLS, Vitest for logic, Playwright for flows).                                                 | The test is committed and **fails** on `main`. |
| 2. Baseline               | Run `pnpm check` (see Phase 1) on the branch before the fix; save output to the PR.                                                                | Baseline recorded, only the new test is red.   |
| 3. Implement              | Smallest change that turns the test green. Migrations are new files, never edits to old ones.                                                      | New test green.                                |
| 4. Gate A — regression    | `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm test:db && pnpm build && pnpm test:e2e:smoke`                               | All green, in CI, on the PR.                   |
| 5. Gate B — functionality | The unit's own tests + a manual walkthrough of the touched screens (390 / 768 / 1280 px, light + dark, es + en) recorded as a checklist in the PR. | Checklist ticked by a human.                   |
| 6. Gate C — security      | `supabase/tests/security/*` (access-control matrix + payment integrity + privilege snapshot) all green.                                            | Green in CI.                                   |
| 7. Rollback script        | `supabase/rollbacks/<migration>.down.sql`, **tested**: apply up → down → up on a local DB in CI.                                                   | Rollback job green.                            |
| 8. Production backup      | Confirm Supabase PITR/daily backup timestamp; take `supabase db dump` (schema + data) before applying.                                             | Backup id/time written in FIX_LOG.             |
| 9. Apply                  | Merge PR → CI "prod-rehearsal" job (see Environments) passes → production (`supabase db push` from CI, not a laptop).                              | Deployed.                                      |
| 10. Verify in production  | Run the unit's read-only verification query/script against production; check Vercel runtime errors for 30 min.                                     | Verified.                                      |
| 11. Record                | Append to `docs/FIX_LOG.md` (unit id, PR, migration, backup id, verification output, rollback path) and tag `fix-<id>-YYYYMMDD`.                   | Tag pushed.                                    |

A unit that fails any gate goes back to step 3. Nobody (human or agent) skips a gate or disables a test.

## Environments (decision 2026-10-08: one hosted database only)

The Supabase free tier allows two projects and both are taken (Mezza, Grumi), so there is **no
hosted staging database**. Pre-production verification therefore happens on throwaway databases:

- **Local**: `supabase start` (Docker) for development and Gates A–C.
- **CI prod-rehearsal** (every PR that adds a migration): a throwaway Supabase stack in GitHub
  Actions loads the latest production schema snapshot (`supabase/snapshots/prod-<date>.sql`, refreshed
  read-only before each release), applies the pending migrations, runs Gates A–C, then runs the
  rollback script and re-applies. This is the stand-in for staging.
- **Vercel previews** point at a local/CI database or run with demo data only. **A preview deployment
  must never use the production Supabase keys**, because a preview with prod keys is a second writer to
  the only database.
- **Production**: the only hosted DB. Every migration: fresh backup (PITR timestamp + `db dump`)
  → apply from CI → read-only verification → FIX_LOG. Migrations must be additive or reversible
  (expand/contract), since there is no staging copy to catch a bad one.
- If budget allows later: Supabase Pro (branching or a third project) replaces prod-rehearsal with
  a real staging project; nothing else in this plan changes.

---

## Decisions recorded (2026-10-08)

- Hotfix path: **Phase 0 hotfix now** for H1/H2 (and P0-3, P0-4), before the CI work.
- Feature freeze: **ATH Móvil / Stripe and other features frozen until Phase 2 is done**; bug and security fixes only.
- Environments: **one hosted Supabase DB** (no staging project); see Environments.
- Tracking: **one GitHub Issue per change unit** (H1, M2, ...) linked to its PR, plus `docs/FIX_LOG.md` and a git tag.

## Phase 0 — Emergency security (days 1–3)

Goal: close the in-tenant privilege holes proven on the local DB. Units are small, migration-only
where possible. Because Phase 1 gates don't exist yet, Phase 0 uses a reduced but mandatory gate:
the existing `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db` plus the new failing pgTAP
test and a tested rollback.

| Unit | Finding                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0-1 | H1 staff rewrite payments | New `confirm_cash_payment(p_payment_id)` SECURITY DEFINER RPC (role check, `status='pending'` only, sets `paid_at`/`confirmed_by`, writes `audit_log`). Switch `connectors/payments/cash.ts` to it. Drop `payments_insert_manager_server` and `payments_update_manager_server`. Revoke table INSERT/UPDATE/DELETE on `payments`, `payment_allocations`, `refunds`, `write_offs*` from `authenticated` (owner included; owners go through RPCs). Update `01_tenancy_and_roles.test.sql:244-246`, which currently asserts the hole. |
| P0-2 | H2 manager escalation     | Replace `memberships_insert_manager` / `memberships_update_manager` with RPC-only membership changes (owner adds managers; manager adds server/kitchen only; nobody edits own row). Revoke direct INSERT/UPDATE on `memberships` from `authenticated`. Move `pin_hash` to a table with no SELECT policy (or a column-level REVOKE).                                                                                                                                                                                               |
| P0-3 | M2 sole-owner demotion    | Constraint trigger: every restaurant keeps ≥1 active owner. Make `wizardInvite` call the same server function as `inviteMember` (no upsert of existing owner).                                                                                                                                                                                                                                                                                                                                                                    |
| P0-4 | M3 direct tab writes      | Revoke UPDATE on `tabs.status/closed_at/pos_closed_*` from `authenticated`; add `close_tab_on_pos(p_tab_id)` RPC with audit; `closeOnPos` uses it.                                                                                                                                                                                                                                                                                                                                                                                |
| P0-5 | M6 / M7 hosted settings   | Owner checks (no code): Auth → Confirm email ON, Redirect URLs allowlist only `https://mezza.stratumpr.com/**` (+ preview pattern), min password 8, leaked-password protection ON. Record screenshots in FIX_LOG.                                                                                                                                                                                                                                                                                                                 |

## Phase 1 — Build the test gates (week 1)

1. **Production schema baseline**: owner runs `supabase db dump --schema-only` against production (read-only) → `supabase/snapshots/prod-<date>.sql`. CI diff job: apply migrations to an empty DB, dump, compare with snapshot; any difference = drift, reported.
2. **One-command check**: `pnpm check` = typecheck + lint + format:check + unit + db tests + build.
3. **CI** (`.github/workflows/ci.yml`) on every PR and push to `main`: Supabase CLI local stack (cache images; use a Docker Hub token or the GHCR mirror to avoid 429s), `pnpm check`, `pnpm test:e2e:smoke`, rollback job, privilege-snapshot job.
4. **Branch protection on `main`**: PR required, CI required, no direct pushes, linear history optional.
5. **Smoke E2E** (`tests/e2e/smoke/`, < 3 min): guest scans → orders → kitchen sees it → split → pay cash → staff confirms → tab closes; owner login; signup.
6. **Security suites** (`supabase/tests/security/`): (a) role × table × verb matrix generated from `pg_policies` + column grants, asserted against an approved snapshot; (b) payment integrity (no client-writable money columns; every paid payment has allocations summing to its amount); (c) privilege snapshot: every `public` function's EXECUTE grantees and every table's grants, compared with an approved list. This catches the "new migration forgot to revoke from anon" class (M4). Tests for not-yet-fixed issues are added as known failures with an issue link and must flip to passing in Phase 2.
7. Fix the Docker-free fallback: add `diag()` to `scripts/db-check/pgtap-shim.sql` (L5).

## Phase 2 — Security fixes (week 2)

| Unit | Finding                                                                                                                                                                                                                                               |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2-1 | M1 owner can delete `audit_log`/payments and edit billing fields: audit_log append-only (no UPDATE/DELETE for anyone but service role), billing columns (`plan`, `status`, `trial_ends_at`, `next_order_number`) revoked from `authenticated` UPDATE. |
| P2-2 | M4 default function privileges: `alter default privileges ... revoke execute on functions from public, anon, authenticated`, then explicit grants; revoke `report_summary` / `storage_restaurant_id` from anon.                                       |
| P2-3 | L4 `confirmCash` follow-up query scoped to `restaurant_id`.                                                                                                                                                                                           |
| P2-4 | M6 build email redirect URLs from `NEXT_PUBLIC_SITE_URL`, never the request `Origin` header (`empezar/actions.ts:196`, `lib/auth/signup.ts:34`).                                                                                                      |
| P2-5 | M7 create the restaurant after email confirmation (callback), not at signup.                                                                                                                                                                          |
| P2-6 | L2 replace `listUsers({perPage:1000})` lookups with an exact lookup (SQL function on `auth.users` by email, service role only).                                                                                                                       |

## Phase 3 — Dead code and duplicate cleanup

- Remove or wire up `src/connectors/staff-session/*` (4 files, unused; flag `pinSwitch` false) and `src/lib/db/browser.ts`.
- Remove 23 unused exports reported by `knip`; add `knip` to `pnpm check`.
- One invite implementation (`lib/team/invite.ts`) used by both wizard and Equipo (M2).
- One tab-closing path (`close_tab` family) used by Mesas, POS close and idle close.
- `pnpm format` for the 3 unformatted docs.

## Phase 4 — Targeted structure fixes (slimmed down, decision 2026-10-08)

The full `src/features/` move was dropped. The code is already grouped by feature inside each layer
(`components/staff` + `lib/staff`, `lib/menu`, `lib/reports`, ...). Cross-feature imports are mostly
shared UI and money helpers, and no component imports the service-role client. Moving every file
would touch the whole codebase and conflict with every open branch, for little regression benefit.

**Now:**

| Unit | Change                                                                                                                                                                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P4-3 | ESLint `no-restricted-imports`: `@/lib/db/admin` only from `src/lib/**`, `src/connectors/**`, `src/app/**/actions.ts`, route handlers and server pages; never from `src/components/**`. |
| P4-4 | `README.md` per feature folder (`lib/guest`, `lib/staff`, `lib/menu`, `lib/reports`, `lib/qr`, `connectors/*`): flows, tables, RPCs, tests. Input for Phase 7.                          |

**Deferred (do it the next time someone works on that screen, as its own change unit, before the feature change):**

| Unit | Change                                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P4-1 | Split `src/components/guest/guest-app.tsx` (979 lines) along its screens (menu, my order, checkout, receipt). No behavior change; E2E guest + checkout specs green before and after. |
| P4-2 | Split `src/components/staff/table-detail.tsx` (771 lines) the same way (lines, payments, staff tools).                                                                               |

## Phase 5 — Schema: indexes only (decision 2026-10-08)

**Later (after Phases 2, 6 and 7):** indexes for the 38 unindexed foreign keys, starting with
`service_requests(tab_id)`, `cart_items(tab_id)`, `print_jobs(order_id)`, `payments(participant_id)`
and `order_items(participant_id)`. Use `create index concurrently`; it's a single step with no
backfill.

**Skipped for now:**

- Generating migrations from canonical function sources (`supabase/functions-src`). The risk it
  addressed, a later migration rewriting a whole function and dropping earlier logic (M5), is
  covered instead by the Phase 1 access snapshot (who may call what) and a Phase 7 review rule
  (diff a redefined function against its previous body in the PR).
- Moving `pin_hash` out of `memberships`: not needed. P0-2 already hides it from every signed-in
  role with a column-level grant.

## Phase 6 — Branch promotion

`feature → PR → main (CI incl. prod-rehearsal on the production schema snapshot) → production (manual approval, backup, tagged)`. No hosted staging (single-database decision above). Delete merged branches `docs/*`, `feat/split-bill`, `fix/original-menu-upload`. Close PR #2 / `feat/staff-bill-splitting` as reference-only (per AGENTS.md).

## Phase 7 — Write CLAUDE.md + AGENTS.md last

After Phases 0–6, rewrite AGENTS.md (CLAUDE.md keeps importing it) with what is then true:

- `pnpm check` is the definition of done; CI must be green; never skip or edit a test to pass.
- Data rules: money tables are written only by SECURITY DEFINER RPCs; every new function revokes from `public, anon` and grants explicitly; every new table ships RLS + a security-matrix entry; new migrations never edit old ones; a migration that redefines an existing function shows the diff against the previous body in the PR description (M5).
- Architecture map (layers grouped by feature: `app/`, `components/<f>`, `lib/<f>`, connector registries; where the service-role client may be used, enforced by P4-3).
- Per-feature docs: the `README.md` files from P4-4 (`src/lib/<feature>/README.md`, `src/connectors/<c>/README.md`).
- Agent safety: `.claude/settings.json` deny-list (`supabase db push`, `seed:cloud`, `git push origin main`), a PostToolUse hook that runs `pnpm lint` on edited files.

---

## docs/FIX_LOG.md format (created in Phase 0)

```
## fix-<id>-YYYYMMDD — <title>
- Finding: <id>, severity
- PR: #n   Tag: fix-<id>-YYYYMMDD   Migration: <file>
- Failing test: <path>   Gate A/B/C: green (CI run link)
- Backup: <PITR timestamp / dump file>
- Applied: staging <time>, production <time>
- Verification: <query + result>
- Rollback: <script path>, tested in CI run <link>
```
