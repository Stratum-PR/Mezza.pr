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
- `pnpm check` includes `knip` (config in `knip.json`). Don't export what nothing imports; a deliberate unused export (a connector contract helper) gets a `/** @public <reason> */` tag.
- Brand follows the Stratum FSQMS landing page; tokens live in `src/app/globals.css`. Use tokens, not raw hex, and not Tailwind's `dark:` variant.
- Every UI string lives in both `messages/es.json` and `messages/en.json`; Spanish first. No hardcoded UI text, including staff screens.
- Navigation works at every size: sidebar/rail/drawer, never a scrolling top tab bar. Check 390, 768 and 1280 px, light and dark.
- Feature flags are in `src/config/flags.ts`; implementations go behind the connector registries in `src/connectors` (e.g. `TabSplitter`, `RateLimiter`, payments). Don't add parallel env-var flags or bypass a connector.
- Money is integer cents, computed on the server; the browser never sends an amount to charge. IVU uses `src/lib/money`.

## Changes and data access (learned in the 2026-10 remediation; history in `docs/FIX_LOG.md`)

- **Done means `pnpm check` is green** (typecheck, lint, format, unit, pgTAP, build), and CI is green on the PR. Never skip, disable or loosen a test to get there. If an old test asserted a hole, change it and say why in FIX_LOG.
- **Failing test first.** Commit the test that proves the problem (pgTAP for database access, Vitest for logic, Playwright for flows) before the fix; commit messages carry the GitHub issue number.
- **Money, memberships and tabs are written only through SECURITY DEFINER RPCs or server code using the service role** after its own role checks. That covers `payments`, `payment_allocations`, `refunds`, `write_offs`, `write_off_allocations`, `memberships`, `tabs`, `audit_log`, `subscriptions` and `usage_fees`. Signed-in users only read them. Never add an INSERT/UPDATE/DELETE policy or grant for `authenticated` on these tables. `audit_log` is append-only.
- **Nothing is executable or readable by default.** Every new function needs an explicit grant in its migration, e.g. `grant execute on function public.f(uuid) to authenticated, service_role;` (service role only for anything that reads `auth.users`). SECURITY DEFINER functions set `search_path = ''` and check the caller. Every new table enables RLS and grants only what it needs. A grant, revoke or policy change fails `supabase/tests/16_access_snapshot.test.sql` until you regenerate it with `pnpm db:access-snapshot`; commit the regenerated file so the access change shows in review.
- **When access changes on purpose**, run `pnpm db:access-snapshot` and review the diff of `supabase/tests/16_access_snapshot.test.sql`: every added line is new access being approved.
- **Migrations are new files, never edits.** Each ships `supabase/rollbacks/<migration>.down.sql`, tested with `pnpm db:rollback-cycle` and then `pnpm test:db`. Run `pnpm db:types` after a migration. A migration that redefines an existing function shows the diff against the previous body in the PR.
- **Links in emails and redirects use `NEXT_PUBLIC_SITE_URL`**, never the request's `Origin` header (`tests/unit/no-origin-links.test.ts`).
- **Production is the owner's.** Agents never write to the hosted Supabase database or change GitHub, Supabase or Vercel settings. Merging to `main` deploys production. Each unit's FIX_LOG entry stays "Ready, not applied" until the owner backs up, applies and verifies it.

## Architecture map

Code is grouped by feature. Read the feature's README before changing it.

- `src/app`: routes, server pages and server actions (`actions.ts`, `route.ts`). Guest pages under `r/[restaurant]/t/[token]`, staff under `app/[restaurant]`, Stratum admin under `admin`, the public site under `[locale]`.
- `src/components/<feature>`: UI. They write only through server actions and never import the service-role client (a server component may read with the user's RLS client, `@/lib/db/server`).
- `src/lib/<feature>`: server logic, queries and pure helpers (money, splitting math, tickets).
- `src/connectors/<c>`: one registry per risky integration (`index.ts` picks the implementation); import only `@/connectors/<c>`. Contracts and current state: `CONNECTORS.md`.
- `supabase/migrations` (schema, RLS, RPCs) with `supabase/rollbacks` and pgTAP tests in `supabase/tests`; E2E in `tests/e2e`, unit tests next to the code or in `tests/unit`.
- **Service-role client** (`@/lib/db/admin`, bypasses RLS): only from `src/lib/**`, `src/connectors/**` and, in `src/app/**`, `actions.ts`, `route.ts` and server `page.tsx`/`layout.tsx`, always after the caller's role is checked. ESLint `no-restricted-imports` enforces it (`eslint.config.mjs`); `tests/unit/client-boundaries.test.ts` covers client pages.
- Feature READMEs: lib [`auth`](src/lib/auth/README.md), [`guest`](src/lib/guest/README.md), [`menu`](src/lib/menu/README.md), [`money`](src/lib/money/README.md), [`qr`](src/lib/qr/README.md), [`reports`](src/lib/reports/README.md), [`staff`](src/lib/staff/README.md), [`team`](src/lib/team/README.md); connectors [`billing`](src/connectors/billing/README.md), [`fiscal`](src/connectors/fiscal/README.md), [`menu-import`](src/connectors/menu-import/README.md), [`notifier`](src/connectors/notifier/README.md), [`orders`](src/connectors/orders/README.md), [`payments`](src/connectors/payments/README.md), [`printing`](src/connectors/printing/README.md), [`rate-limit`](src/connectors/rate-limit/README.md), [`realtime`](src/connectors/realtime/README.md), [`splitter`](src/connectors/splitter/README.md). Update the README in the same change when flows, tables, RPCs or tests move.
- Agent guardrails (Claude Code, `.claude/settings.json`): `supabase db push`, `pnpm seed:cloud` and pushes to `main` are denied; ESLint runs on every edited JS/TS file. Other agents follow the same rules by hand.

## Bill splitting (pass 2) — agreed rules, details in DECISIONS.md

- Guest orders go straight to the kitchen through `place_order`/`place_guest_order`. Never add staff approval of orders or staff-opened visits; abuse is handled by limits, rate limits and Servicio flags.
- One tab per table (Toast model). A participant is created on a phone's first order, identified by the hashed device cookie scoped to the tab. Name optional, otherwise "Invitado #n"; names unique per table, staff-like names blocked, #n always shown.
- Shared ("Para compartir") dishes are split into locked shares when ordered, among people who have ordered so far.
- Checkout: Mis platos, Pagar el balance, Pagar por otra persona, or one even-split plan per table. IVU per payment is the difference in cumulative IVU. Every payment records what it covered.
- The tab stays open after payments; it closes at $0 after 10 minutes with no orders, or when staff marks the table free.
- `feat/staff-bill-splitting` (Codex's staff-approval design) is reference only; don't merge or build on it.
