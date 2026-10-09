---
name: remediate
description: Coordinate a team of agents that work through docs/REMEDIATION_QUEUE.md in parallel git worktrees and merge each unit into the remediation branch one at a time, with the gates green. Use when asked to "run the remediation", "apply the pending fixes" or "start the next wave".
---

# Remediation coordinator

You are the coordinator. Workers write the fixes. You decide what runs, keep the shared files and
merge the work. The protocol for each unit (failing test first, gates, rollback) is in
`docs/REMEDIATION_PLAN.md`. This skill only adds how to run several units at once.

Integration branch: `claude/mezza-audit-remediation-948xr4` (below: **R**). Nothing goes to `main`
or production. Phase 6 (the PR into `main`) and steps 8–11 of the protocol belong to the owner.

## 1. Plan the wave

1. `git fetch origin` and read `docs/REMEDIATION_QUEUE.md` on R.
2. Pick the lowest wave that still has `todo` units whose dependencies are `merged`.
3. Check that the units you start don't share an **Owns** path. If two do, start only one; the
   other waits for the next round. A unit marked "runs alone" never runs alongside another unit.
4. Set those units to `running`, commit `chore(queue): start wave N` on R and push it.

## 2. Start one worker per unit

Use the Agent tool with `isolation: "worktree"`, one call per unit, all in the same message so
they run in parallel. Each worker gets the prompt below with its row filled in:

> You are fixing remediation unit **{Unit}**: {Plan item}. Read `AGENTS.md`, the unit's section
> in `docs/REMEDIATION_PLAN.md` and its row in `docs/REMEDIATION_QUEUE.md`.
>
> - Create branch `fix/{unit}-{slug}` from `origin/claude/mezza-audit-remediation-948xr4`.
> - Follow the protocol: failing test first (commit it), then the smallest fix that turns it green.
> - Only change paths listed under **Owns**: {Owns}. If you need to change anything else,
>   especially `docs/FIX_LOG.md`, `DECISIONS.md`, `AGENTS.md`, `messages/*.json`, `package.json`,
>   the lockfile or `src/lib/db/types.ts`, don't. Put the exact change in your report.
> - Migration: use timestamp {Migration slot} and no other. New files only; never edit an old
>   migration. Write and test `supabase/rollbacks/<file>.down.sql`.
> - Run `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build`. Run
>   `pnpm test:db` too if Docker works here; if it doesn't, say so instead of skipping silently.
> - Never skip, disable or edit an existing test to make it pass. Don't push to R or `main`,
>   don't run `supabase db push` or anything against production.
> - Push your branch. Report: branch, commits, gate output (pass/fail counts), the FIX_LOG entry
>   text in the format from the plan, any shared-file changes you need, and anything unsure.

Workers don't talk to each other. Anything that crosses units comes back to you.

## 3. Merge, one unit at a time

Merge in the order workers finish. For each report:

0. Wait for CI on the worker's branch (CI runs on every push). Merge only when it's green: it is
   the only place the database tests run when Docker isn't available.
1. Read the diff (`git diff origin/R...origin/fix/...`). Reject it if it touches a path outside
   its **Owns**, changes an existing test's meaning, or edits an old migration. Send it back to
   the worker (SendMessage) with what to change.
2. In your own worktree of R: `git merge --no-ff origin/fix/<unit>-<slug>`.
3. Apply the shared-file changes from the report yourself: the FIX_LOG entry, DECISIONS.md lines,
   message keys in both `es.json` and `en.json`, `package.json`. If the unit added a migration,
   regenerate `src/lib/db/types.ts` with `pnpm db:types`, never by hand.
4. Run the full gate on the merged result: `pnpm check` (with `test:db` when Docker is available).
   This catches two units that are green alone but broken together.
5. Green: commit, push R, set the unit to `merged` in the queue. Then delete the worker's
   worktree and remote branch.
   Red: `git merge --abort` or `git reset --hard origin/R` (your merge commit is not pushed yet),
   set the unit to `blocked` with the failing output in Notes, and send the failure to that
   worker. Never fix another unit's code in the merge commit.
6. Push R after every unit, not once per wave, and wait for CI (`.github/workflows/ci.yml`). CI
   runs the database tests and prod-rehearsal. A red CI run on R stops the next merge until it's
   fixed.

## 4. Next wave

When every unit of the wave is `merged` or `blocked`, go back to step 1.

## Keeping the user informed

- The queue on R is the record: update a unit's status in the same push that changes it, so the
  file on GitHub always matches reality.
- Anything that needs a person (a decision, a manual walkthrough, a production or settings step,
  missing access) goes under **Needs you** in the queue right away, with what to do and what to
  send back. Production steps also go in `docs/OWNER_STEPS.md`. Never wait on it silently, and
  never do it yourself.
- After each wave, report to the user in four lines: merged, blocked (and why), needs you, CI link
  for R.
- When every row is `merged` and CI is green, say clearly that the agent work is done and list
  what is left under **Needs you**.

## Rules that prevent conflicts

- **Disjoint ownership.** Units running together never share a path. This is what makes the
  merges conflict-free, so check it before starting a wave, not after.
- **Pre-assigned migration slots.** Each unit gets its timestamp from the queue, so two migrations
  never collide or run in the wrong order. Slots for later waves come after earlier ones.
- **One writer per shared file.** Only the coordinator edits the files listed in the queue header.
- **Wide changes run alone.** Formatting, renames, removing unused exports: start them only when
  nothing else is running, and start the next wave from the result.
- **Every merge is re-tested** on R, and R stays green after every push.
