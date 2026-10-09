# Owner steps: remediation Phases 0–2 (PR #18)

Your part of the remediation, in order. Each step says what "done" looks like and what to send back.
Details per change are in `docs/FIX_LOG.md`. Agents never run steps 1, 2, 4 or 5 (production and
settings are yours).

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

## 2. Decide rate limits in production (~2 min)

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

| Unit | As                      | Screen and what to try                                                                          | Expect                                         |
| ---- | ----------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| P0-1 | guest phone + `mesero@` | Mesa 4 QR (link printed by `pnpm seed`): order, pay cash; staff confirms the cash payment       | Payment shows as paid; table balance updates   |
| P0-2 | `gerente@`              | Equipo                                                                                          | Can see the team; cannot make anyone a manager |
| P0-3 | `dueno@`                | Equipo: invite your own email as server                                                         | Refused; you stay owner                        |
| P0-3 | new signup              | Setup wizard, invite step                                                                       | Invite sends; owner unchanged                  |
| P0-4 | `mesero@`               | Mesas → a table → "Cerrado en el POS"                                                           | Table closes                                   |
| P0-4 | `gerente@`              | Raise a table's QR limit                                                                        | Limit raised                                   |
| P2-1 | `dueno@`                | Ajustes: change limits, save                                                                    | Saves                                          |
| P2-3 | `dueno@`                | Equipo: invite `dueno@barratest.example` (an existing account) as server                        | "Added", appears in the list                   |
| P2-4 | logged out              | /es/entrar → magic link; /es/recuperar → reset. Links arrive in Mailpit, http://127.0.0.1:55324 | Links start with `http://localhost:3000`       |
| P2-5 | logged out              | /es/registro: sign up                                                                           | Lands on the setup wizard                      |

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

Done when: every row passes. Note anything odd (screenshot plus which width and theme).

## 4. Production deploy (~30 min, at a quiet time)

Between applying the migrations (c) and the new app going live (d), about 3–5 minutes, these fail in
production: confirming cash, "Cerrado en el POS", saving limits in Ajustes, adding an existing account
in Equipo. Pick a moment when no restaurant is serving.

**a. Pre-checks (read-only)**

```bash
pnpm exec supabase migration list --linked
```

Production (Remote) should end at `20261007000000`, with the 8 migrations `20261008000100`…`000800`
local only. In the Supabase dashboard → SQL Editor, run (read-only):

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

It lists the 8 migrations and asks to confirm. Then right away:

**d. Merge PR #18** on GitHub (CI green). Merging to `main` deploys production on Vercel; wait until the
deployment says **Ready**.

**e. Verify (read-only)**

- `pnpm exec supabase migration list --linked`: Remote now ends at `20261008000800`.
- SQL Editor:

```sql
select has_function_privilege('anon', 'public.report_summary(uuid, date, date)', 'execute') as anon_reports,  -- false
       has_function_privilege('authenticated', 'public.auth_user_id_by_email(text)', 'execute') as user_lookup, -- false
       (select count(*) from pending_signups) as pending;                                                         -- 0
```

- On https://mezza.stratumpr.com: log in as a real owner, then open Mesas, Equipo and Ajustes. Sign up a
  test restaurant with an email you own, confirm it, and check you reach the wizard. Afterwards delete
  that test account in the Supabase dashboard → Authentication.
- Vercel → mezza → Logs: no new errors for 30 minutes.

**f. New schema snapshot** (so CI's drift check is current):

```bash
pnpm exec supabase db dump --linked --schema public,storage -f supabase/snapshots/prod-2026-10-XX@20261008000800.sql
```

Leave the file uncommitted; the agent puts it in a PR.

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
- Snapshot: supabase/snapshots/prod-…@20261008000800.sql (uncommitted)
- Auth settings: [done, screenshots in …]
Update FIX_LOG (backup, applied, verified) for P0-1…P2-5, tag each unit, commit the snapshot through a
PR, then start Phase 3.
```

The agent then fills in each FIX_LOG entry, adds the tags, puts the snapshot in a PR, and closes issues
#4–#17 once you confirm. After that come Phase 3 (dead code, one tab-closing path), Phase 4 (the lint
rule and per-feature READMEs) and Phase 5 (indexes).
