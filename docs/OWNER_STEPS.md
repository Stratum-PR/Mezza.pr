# Owner steps: remediation Phases 0–7 (PR #18)

Your part of the remediation, in order. Each step says what "done" looks like and what to send back.
Details per change are in `docs/FIX_LOG.md`. Agents never run steps 1, 2, 4 or 5 (production and
settings are yours). Updated 2026-10-09: the branch now also holds Phases 3–5 and 7 and the owner
requests U-1 to U-3, so production is **10 migrations** behind (`20261008000100`…`000800`,
`20261009000100`, `20261009000200`).

**Note:** `.claude/settings.json` now blocks `supabase db push`, `seed:cloud` and pushes to `main` for
Claude Code. Run step 4's commands in your own terminal, not through an agent.

**Before you start**

- Supabase CLI logged in and linked to the Mezza project: `pnpm exec supabase projects list` shows
  `Mezza.pr` (ref `zzgoikafkabxcrgrvfiy`) with a ● next to it.
- So the agent can use GitHub next time: run `gh auth login` in a **regular PowerShell window outside the
  Claude app**, and wait for "✓ Logged in as …". In the app's terminal it exits at the browser step.

---

## 1. Close the preview hole (Vercel, ~10 min, do first)

Today every PR preview uses the production database with the service-role key.

1. Vercel → mezza → Settings → Environment Variables. For each of these, edit it and **untick Preview**
   (keep Production):
   `SUPABASE_SERVICE_ROLE_KEY`, `QR_TOKEN_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   Previews will then fail to build or run without a database. That's expected until previews get a
   demo or throwaway database (see the remediation plan, "Environments").
2. Settings → Deployment Protection: **Vercel Authentication** on for previews (Standard Protection).
3. Deployments → the PR #18 preview → ⋯ → **Delete** (existing deployments keep the old keys).

Done when: no variable carrying a production key or secret lists Preview, and the PR #18 preview is gone.

## 2. Decide rate limits in production (~2 min) — recommended: `postgres`

`MEZZA_RATE_LIMIT=noop` in Production turns off every rate limit (signups, guest orders, …).

- To turn them on: edit it to `postgres` (Production only). It takes effect on the next deploy (step 4).
- To keep `noop` on purpose: tell the agent why, and it gets recorded in `DECISIONS.md`.

## 3. Manual walkthrough (Gate B), on your computer, not on a preview (~45 min)

Run the branch locally against a local database:

```bash
git checkout claude/mezza-audit-remediation-948xr4
git pull
pnpm exec supabase start
pnpm exec supabase db reset
pnpm seed
pnpm dev
```

`pnpm seed` prints the local logins and password. Open http://localhost:3000. For every screen below,
check widths **390, 768 and 1280 px**, **light and dark**, **es and en** (browser dev tools → device
toolbar for widths). Tick it off here or in the PR.

| Unit  | As                      | Screen and what to try                                                                          | Expect                                                   |
| ----- | ----------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| P0-1  | guest phone + `mesero@` | Mesa 4 QR (link printed by `pnpm seed`): order, pay cash; staff confirms the cash payment       | Payment shows as paid; table balance updates             |
| P0-2  | `gerente@`              | Equipo                                                                                          | Can see the team; cannot make anyone a manager           |
| P0-3  | `dueno@`                | Equipo: invite your own email as server                                                         | Refused; you stay owner                                  |
| P0-3  | new signup              | Setup wizard, invite step                                                                       | Invite sends; owner unchanged                            |
| P0-4  | `mesero@`               | Mesas → a table → "Cerrado en el POS"                                                           | Table closes                                             |
| P0-4  | `gerente@`              | Raise a table's QR limit                                                                        | Limit raised                                             |
| P2-1  | `dueno@`                | Ajustes: change limits, save                                                                    | Saves                                                    |
| P2-3  | `dueno@`                | Equipo: invite `dueno@barratest.example` (an existing account) as server                        | "Added", appears in the list                             |
| P2-4  | logged out              | /es/entrar → magic link; /es/recuperar → reset. Links arrive in Mailpit, http://127.0.0.1:55324 | Links start with `http://localhost:3000`                 |
| P2-5  | logged out              | /es/registro: sign up                                                                           | Lands on the setup wizard                                |
| P3-4  | `mesero@`               | Servicio: a table with an open waiter request → "Cerrado en el POS"                             | Table closes and its request leaves Servicio             |
| P3-4  | `mesero@`               | Mesas → a paid table → "Mesa libre"                                                             | Table frees; same as before                              |
| U-1   | `mesero@`               | Servicio → "Cerrado en el POS" → Cancel, then again → OK                                        | Cancel: still listed. OK: table closes                   |
| U-2/3 | two phones, one table   | Phone A orders, "Dividir en 2". Phone B scans the same QR, doesn't order, opens Pagar           | B sees the plan, no "Cancelar la división"; A can cancel |

**P2-5 with email confirmation on (production's setting).** Local auth has it off, so turn it on
temporarily:

1. In `supabase/config.toml`, under `[auth.email]`, set `enable_confirmations = true`, then run
   `pnpm exec supabase stop` and `pnpm exec supabase start`.
2. Same device: sign up at /es/registro → "check your email" → open the email in Mailpit **in the same
   browser** → lands on the setup wizard for the new restaurant.
3. Another device: sign up again with a new email → open the Mailpit link in a **different browser**
   (or a private window) → it shows the link error (expected: the code only works in the browser that
   signed up). Back in the first browser, sign in at /es/entrar → lands on the setup wizard.
4. Before each confirmation, check no restaurant exists yet: local Studio, http://127.0.0.1:55323 → SQL
   editor → `select name, slug from restaurants order by created_at desc limit 3;` doesn't list the new
   name, and `select * from pending_signups;` shows the waiting signup. After confirming it's the
   other way round.
5. Put `enable_confirmations = false` back, and restart Supabase. Don't commit the change.

**Full E2E suite** (CI only runs the smoke specs; the split and checkout specs haven't run since
these changes). With the local stack still up:

```bash
pnpm build
pnpm test:e2e
```

Expect all green (demo-only tests skip). `checkout.spec.ts` "even split" is known to be timing-sensitive
under parallel load: if only that one fails, re-run it alone (`pnpm test:e2e tests/e2e/checkout.spec.ts`).

Done when: every row passes and the E2E suite is green. Note anything odd (screenshot plus which width
and theme).

## 4. Production deploy (~30 min, at a quiet time)

Between applying the migrations (c) and the new app going live (d), about 3–5 minutes, these fail in
production: confirming cash, "Cerrado en el POS", saving limits in Ajustes, adding an existing account
in Equipo. Pick a moment when no restaurant is serving: the index migration (`20261009000200`) also
builds 52 indexes and each one waits for long transactions on its table.

**a. Pre-checks (read-only)**

```bash
pnpm exec supabase migration list --linked
```

Production (Remote) should end at `20261007000000`, with the 10 migrations `20261008000100`…`000800`,
`20261009000100` and `20261009000200` local only. In the Supabase dashboard → SQL Editor, run (read-only):

```sql
select r.id from restaurants r
where not exists (select 1 from memberships m
  where m.restaurant_id = r.id and m.role = 'owner' and m.active);
```

It must return **0 rows**. If not, stop and send the result to the agent.

**b. Backup**

- Dashboard → Database → Backups: write down the latest backup (or PITR) time.
- Dump to a folder **outside the repo** (it contains customer data):

```bash
pnpm exec supabase db dump --linked -f "C:\Users\Jovaniel\mezza-backups\prod-2026-10-XX-schema.sql"
```

```bash
pnpm exec supabase db dump --linked --data-only -f "C:\Users\Jovaniel\mezza-backups\prod-2026-10-XX-data.sql"
```

**c. Apply the migrations**

The plan says "from CI", but there's no deploy job yet, so for now it runs from your computer:

```bash
pnpm exec supabase db push --linked
```

It lists the 10 migrations and asks to confirm. The index migration runs its `create index
concurrently` statements one by one outside a transaction; that's expected. If it stops partway, see
"If something goes wrong" below before re-running. Then right away:

**d. Merge PR #18** on GitHub (CI green). Merging to `main` deploys production on Vercel; wait until the
deployment says **Ready**.

**e. Verify (read-only)**

- `pnpm exec supabase migration list --linked`: Remote now ends at `20261009000200`.
- SQL Editor:

```sql
select has_function_privilege('anon', 'public.report_summary(uuid, date, date)', 'execute') as anon_reports,  -- false
       has_function_privilege('authenticated', 'public.auth_user_id_by_email(text)', 'execute') as user_lookup, -- false
       (select count(*) from pending_signups) as pending;                                                         -- 0
```

```sql
-- P5-1: no half-built indexes (expect 0 rows)
select indexrelid::regclass from pg_index where not indisvalid;
-- P3-4: the three closes share one function (expect 3), nobody signed in may call it (expect false)
select count(*) from pg_proc
 where proname in ('close_tab', 'close_tab_on_pos', 'close_idle_tabs')
   and prosrc like '%public.close_tab_core(%';
select has_function_privilege('authenticated',
  'public.close_tab_core(uuid, uuid, public.audit_action, jsonb)', 'execute');
```

- On https://mezza.stratumpr.com: log in as a real owner, then open Mesas, Servicio, Equipo and
  Ajustes. Sign up a
  test restaurant with an email you own, confirm it, and check you reach the wizard. Afterwards delete
  that test account in the Supabase dashboard → Authentication.
- Vercel → mezza → Logs: no new errors for 30 minutes.

**f. New schema snapshot** (so CI's drift check is current):

```bash
pnpm exec supabase db dump --linked --schema public,storage -f supabase/snapshots/prod-2026-10-XX@20261009000200.sql
```

Leave the file uncommitted; the agent puts it in a PR.

**g. If something goes wrong**

- **App broken, database fine:** Vercel → Deployments → the previous production deployment →
  Instant Rollback. Only safe _before_ (c): after the migrations, the old app can't confirm cash or
  close on the POS (P0-1, P0-4), so prefer fixing forward or rolling both back.
- **Index migration stopped partway:** run the "no half-built indexes" query from (e), drop each index
  it lists (`drop index concurrently <name>;`), then run `pnpm exec supabase db push --linked` again
  (the migration uses `if not exists`).
- **Roll the database back:** each migration has a tested script in `supabase/rollbacks/`. Run them
  **newest first**, only down to the one you need, with `psql` (the index rollback can't run inside a
  transaction, so not the SQL Editor):

  ```bash
  psql "<production connection string>" -v ON_ERROR_STOP=1 -f supabase/rollbacks/20261009000200_fk_indexes.down.sql
  ```

  Each script also removes its row from `supabase_migrations.schema_migrations`. Then roll Vercel back
  to the matching deployment. Last resort: restore the backup from (b).

## 5. Hosted Auth settings (P0-5, issue #8, ~5 min)

Supabase dashboard → Authentication:

- Sign In / Providers → Email: **Confirm email ON**, minimum password length **8**, **leaked password
  protection ON**.
- URL Configuration: Site URL `https://mezza.stratumpr.com`; Redirect URLs **only**
  `https://mezza.stratumpr.com/**` (remove `localhost` or `*.vercel.app` entries unless you want them).

Take screenshots for the FIX_LOG.

---

## Then continue with the agent

Open a session on this repo and paste:

```
Continue the Mezza remediation. Production steps are done:
- Vercel: preview keys removed [yes/no], protection [on/off], MEZZA_RATE_LIMIT = [postgres/noop because …]
- Gate B: [all passed / notes: …]
- Backup: [dashboard backup time], dumps: [file names]
- Migrations applied at [time]; PR #18 merged at [time]; Vercel deployment [URL]
- Verification: [query results], logs [clean / errors: …]
- Snapshot: supabase/snapshots/prod-…@20261009000200.sql (uncommitted)
- Auth settings: [done, screenshots in …]
Update FIX_LOG (backup, applied, verified) for every unit (P0-1…P2-5, P3-x, P4-x, P5-1, P7-2,
U-1…U-3), tag each unit, commit the snapshot through a PR, and delete the merged fix/* branches.
```

The agent then fills in each FIX_LOG entry, adds the tags, puts the snapshot in a PR, and closes issues
#4–#17 once you confirm. Still open after that (not scheduled): the fiscal connector's result is
ignored and mock card/ATH skip it — fix before card or ATH go live (see `CONNECTORS.md`).
