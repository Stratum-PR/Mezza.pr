<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mezza

These rules apply to every agent (Claude Code, Codex, others). `CLAUDE.md` only imports this file, so keep project rules here.

- The product is **Mezza** (renamed from "Mesa"). The Spanish word "mesa" (table) stays in table labels: "Mesa 4", the "Mesas" screen, `/mesas`.
- Build brief: `MEZZA_PASS1.md`. Resume from the first unchecked task in `PLAN.md` (pass 2, bill splitting, is at the end). Log judgment calls in `DECISIONS.md`.
- Build in `PLAN.md` phase order. Phase gate: `pnpm check`, then commit `pass1(phase N): <summary>` (pass 2: `pass2(phase N): <summary>`).
- Brand follows the Stratum FSQMS landing page; tokens live in `src/app/globals.css`. Use tokens, not raw hex, and not Tailwind's `dark:` variant.
- Every UI string lives in both `messages/es.json` and `messages/en.json`; Spanish first. No hardcoded UI text, including staff screens.
- Navigation works at every size: sidebar/rail/drawer, never a scrolling top tab bar. Check 390, 768 and 1280 px, light and dark.
- Feature flags are in `src/config/flags.ts`; implementations go behind the connector registries in `src/connectors` (e.g. `TabSplitter`, `RateLimiter`, payments). Don't add parallel env-var flags or bypass a connector.
- Money is integer cents, computed on the server; the browser never sends an amount to charge. IVU uses `src/lib/money`.

## Changes and data access (learned in the 2026-10 remediation; history in `docs/FIX_LOG.md`)

- **Done means `pnpm check` is green** (typecheck, lint, format, unit, pgTAP, build), and CI is green on the PR. Never skip, disable or loosen a test to get there. If an old test asserted a hole, change it and say why in FIX_LOG.
- **Failing test first.** Commit the test that proves the problem (pgTAP for database access, Vitest for logic, Playwright for flows) before the fix; commit messages carry the GitHub issue number.
- **Money, memberships and tabs are written only through SECURITY DEFINER RPCs or server code using the service role** after its own role checks. That covers `payments`, `payment_allocations`, `refunds`, `write_offs`, `write_off_allocations`, `memberships`, `tabs`, `audit_log`, `subscriptions` and `usage_fees`. Signed-in users only read them. Never add an INSERT/UPDATE/DELETE policy or grant for `authenticated` on these tables. `audit_log` is append-only.
- **Nothing is executable or readable by default.** Every new function needs an explicit grant in its migration, e.g. `grant execute on function public.f(uuid) to authenticated, service_role;` (service role only for anything that reads `auth.users`). SECURITY DEFINER functions set `search_path = ''` and check the caller. Every new table enables RLS and grants only what it needs.
- **When access changes on purpose**, run `pnpm db:access-snapshot` and review the diff of `supabase/tests/16_access_snapshot.test.sql`: every added line is new access being approved.
- **Migrations are new files, never edits.** Each ships `supabase/rollbacks/<migration>.down.sql`, tested with `pnpm db:rollback-cycle` and then `pnpm test:db`. Run `pnpm db:types` after a migration. A migration that redefines an existing function shows the diff against the previous body in the PR.
- **Links in emails and redirects use `NEXT_PUBLIC_SITE_URL`**, never the request's `Origin` header (`tests/unit/no-origin-links.test.ts`).
- **Production is the owner's.** Agents never write to the hosted Supabase database or change GitHub, Supabase or Vercel settings. Merging to `main` deploys production. Each unit's FIX_LOG entry stays "Ready, not applied" until the owner backs up, applies and verifies it.

## Bill splitting (pass 2) — agreed rules, details in DECISIONS.md

- Guest orders go straight to the kitchen through `place_order`/`place_guest_order`. Never add staff approval of orders or staff-opened visits; abuse is handled by limits, rate limits and Servicio flags.
- One tab per table (Toast model). A participant is created on a phone's first order, identified by the hashed device cookie scoped to the tab. Name optional, otherwise "Invitado #n"; names unique per table, staff-like names blocked, #n always shown.
- Shared ("Para compartir") dishes are split into locked shares when ordered, among people who have ordered so far.
- Checkout: Mis platos, Pagar el balance, Pagar por otra persona, or one even-split plan per table. IVU per payment is the difference in cumulative IVU. Every payment records what it covered.
- The tab stays open after payments; it closes at $0 after 10 minutes with no orders, or when staff marks the table free.
- `feat/staff-bill-splitting` (Codex's staff-approval design) is reference only; don't merge or build on it.
