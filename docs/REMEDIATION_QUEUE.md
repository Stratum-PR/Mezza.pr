# Remediation queue

Work left in `docs/REMEDIATION_PLAN.md`, split into units that agents can do at the same time.
The coordinator (`.claude/skills/remediate/SKILL.md`) is the only one that edits this file.

Status: `todo` → `running` → `review` (worker done, gates green) → `merged` (on the remediation
branch) or `blocked` (reason in Notes).

**Owns** lists the paths a unit may change. Two units that are `running` at the same time must
not share a path. Shared files (`docs/FIX_LOG.md`, `DECISIONS.md`, `AGENTS.md`, `messages/*.json`,
`package.json`, `pnpm-lock.yaml`, `src/lib/db/types.ts`) are owned by the coordinator. A worker
that needs a change there describes it in its report, and the coordinator applies it at merge time.

| Wave | Unit | Plan item                                                                                   | Owns                                                                                                                                                                           | Migration slot   | Depends on | Status  |
| ---- | ---- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- | ---------- | ------- |
| 1    | P3-1 | Remove or wire up `src/connectors/staff-session/*` and `src/lib/db/browser.ts`              | `src/connectors/staff-session/**`, `src/lib/db/browser.ts`, `src/config/flags.ts`, `src/connectors/index.ts`                                                                   | none             |            | merged  |
| 1    | P3-4 | One tab-closing path (`close_tab` family) for Mesas, POS close, idle close                  | `supabase/migrations/<slot>_*`, `supabase/rollbacks/<slot>_*`, `supabase/tests/16_*`, `src/lib/staff/actions.ts`, `src/lib/staff/floor.ts`, `src/lib/guest/status.ts`          | `20261009000100` |            | merged  |
| 1    | P4-3 | ESLint `no-restricted-imports` for `@/lib/db/admin`                                         | `eslint.config.mjs`                                                                                                                                                            | none             |            | merged  |
| 1    | P5-1 | Indexes for unindexed foreign keys (`create index concurrently`)                            | `supabase/migrations/<slot>_*`, `supabase/rollbacks/<slot>_*`, `supabase/tests/17_*`                                                                                           | `20261009000200` |            | merged  |
| 2    | P3-2 | Remove unused exports (`knip`); add `knip` to `pnpm check`                                  | whole `src/**` (runs alone)                                                                                                                                                    | none             | wave 1     | merged  |
| 3    | P4-4 | `README.md` per feature folder                                                              | `src/lib/*/README.md`, `src/connectors/*/README.md`                                                                                                                            | none             | P3-2       | merged  |
| 3    | U-1  | Owner request: confirmation prompt before "Cerrado en el POS" (Servicio)                    | `src/components/staff/service-screen.tsx`, `tests/e2e/service-flow.spec.ts` (smoke test clicks the button: accept the prompt, add a cancel case); message keys via coordinator | none             | P3-2       | merged  |
| 3    | U-2  | Only a participant of the tab may cancel its even split (`guestCancelPlan`; owner decision) | `src/app/r/[restaurant]/t/[token]/actions.ts`, `tests/e2e/split-edge-cases.spec.ts`, new `src/lib/guest/*.test.ts` if needed                                                   | none             |            | merged  |
| 3    | P3-5 | `pnpm format` for unformatted docs                                                          | `docs/**` except FIX_LOG                                                                                                                                                       | none             | P3-2       | merged  |
| 4    | P7-2 | AGENTS.md architecture map; `.claude/settings.json` deny-list and lint hook                 | coordinator only                                                                                                                                                               | none             | waves 1–3  | running |

Not queued: P3-3 (one invite path, already done in P0-3), P4-1 and P4-2 (deferred until someone
works on those screens), Phase 6 and every production step (owner only).

## Done when

- **Agent work is done** when every row above is `merged`, CI is green on the latest commit of
  the remediation branch, and each merged unit has a `docs/FIX_LOG.md` entry.
- **The remediation is done** when, after that, every box in "Needs you" and in
  `docs/OWNER_STEPS.md` is ticked: PR into `main` merged (Phase 6), migrations applied to
  production, verified and tagged (protocol steps 8–11).

## Needs you

Anything an agent can't do or decide. The coordinator adds a line here as soon as it finds one,
and a unit waiting on it is `blocked`. Ordered by what unblocks the most work.

- [ ] Gate B manual walkthrough for each merged unit that changes a screen (390 / 768 / 1280 px,
      light + dark, es + en).
- [ ] Production steps for Phases 0–2: `docs/OWNER_STEPS.md`.
- [x] P3-4: approved both "Cerrado en el POS" changes (2026-10-09).
- [x] `guestCancelPlan`: owner chose "require a participant" (2026-10-09) → unit U-2.
- [ ] Run the full E2E suite once before release (`pnpm test:e2e`, local stack): CI's smoke job
      skips `split-edge-cases.spec.ts`, which holds the U-2 test.
- [ ] P5-1 in production: apply outside service hours, then check
      `select indexrelid::regclass from pg_index where not indisvalid;` returns 0 rows.

## Notes

- Found by P4-4 (docs vs code, no action yet): `CONNECTORS.md` says rate limit "noop" while the code
  defaults to `postgres`, and omits the `pay:*` and `plan:table` keys; the splitter connector and
  `defaultPrinterProtocol` (`MEZZA_PRINTER`) are unused; the fiscal connector's `recordSale` result is
  ignored and mock card/ATH payments skip it; menu import is `claude_stub` outside demo mode; realtime
  stub shows no "coming soon" state; notifier `staff_invite`/`receipt` templates are unused (invites go
  through Supabase Auth).

- P3-5: nothing to do. `pnpm format:check` was already clean on the whole repo at `fc94879`
  (earlier phases formatted the docs).
