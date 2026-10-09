# Remediation queue

Work left in `docs/REMEDIATION_PLAN.md`, split into units that agents can do at the same time.
The coordinator (`.claude/skills/remediate/SKILL.md`) is the only one that edits this file.

Status: `todo` → `running` → `review` (worker done, gates green) → `merged` (on the remediation
branch) or `blocked` (reason in Notes).

**Owns** lists the paths a unit may change. Two units that are `running` at the same time must
not share a path. Shared files (`docs/FIX_LOG.md`, `DECISIONS.md`, `AGENTS.md`, `messages/*.json`,
`package.json`, `pnpm-lock.yaml`, `src/lib/db/types.ts`) are owned by the coordinator. A worker
that needs a change there describes it in its report, and the coordinator applies it at merge time.

| Wave | Unit | Plan item                                                                      | Owns                                                                                                                                                                  | Migration slot   | Depends on | Status |
| ---- | ---- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ---------- | ------ |
| 1    | P3-1 | Remove or wire up `src/connectors/staff-session/*` and `src/lib/db/browser.ts` | `src/connectors/staff-session/**`, `src/lib/db/browser.ts`, `src/config/flags.ts`, `src/connectors/index.ts`                                                          | none             |            | todo   |
| 1    | P3-4 | One tab-closing path (`close_tab` family) for Mesas, POS close, idle close     | `supabase/migrations/<slot>_*`, `supabase/rollbacks/<slot>_*`, `supabase/tests/16_*`, `src/lib/staff/actions.ts`, `src/lib/staff/floor.ts`, `src/lib/guest/status.ts` | `20261009000100` |            | todo   |
| 1    | P4-3 | ESLint `no-restricted-imports` for `@/lib/db/admin`                            | `eslint.config.mjs`                                                                                                                                                   | none             |            | todo   |
| 1    | P5-1 | Indexes for unindexed foreign keys (`create index concurrently`)               | `supabase/migrations/<slot>_*`, `supabase/rollbacks/<slot>_*`, `supabase/tests/17_*`                                                                                  | `20261009000200` |            | todo   |
| 2    | P3-2 | Remove unused exports (`knip`); add `knip` to `pnpm check`                     | whole `src/**` (runs alone)                                                                                                                                           | none             | wave 1     | todo   |
| 3    | P4-4 | `README.md` per feature folder                                                 | `src/lib/*/README.md`, `src/connectors/*/README.md`                                                                                                                   | none             | P3-2       | todo   |
| 3    | P3-5 | `pnpm format` for unformatted docs                                             | `docs/**` except FIX_LOG                                                                                                                                              | none             | P3-2       | todo   |
| 4    | P7-2 | AGENTS.md architecture map; `.claude/settings.json` deny-list and lint hook    | coordinator only                                                                                                                                                      | none             | waves 1–3  | todo   |

Not queued: P3-3 (one invite path, already done in P0-3), P4-1 and P4-2 (deferred until someone
works on those screens), Phase 6 and every production step (owner only).

## Notes
