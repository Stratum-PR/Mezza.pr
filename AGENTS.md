<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mezza

These rules apply to every agent (Claude Code, Codex, others). `CLAUDE.md` only imports this file, so keep project rules here.

- The product is **Mezza** (renamed from "Mesa"). The Spanish word "mesa" (table) stays in table labels: "Mesa 4", the "Mesas" screen, `/mesas`.
- Build brief: `MEZZA_PASS1.md`. Resume from the first unchecked task in `PLAN.md` (pass 2, bill splitting, is at the end). Log judgment calls in `DECISIONS.md`.
- Build in `PLAN.md` phase order. Phase gate: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db`, then commit `pass1(phase N): <summary>` (pass 2: `pass2(phase N): <summary>`).
- Brand follows the Stratum FSQMS landing page; tokens live in `src/app/globals.css`. Use tokens, not raw hex, and not Tailwind's `dark:` variant.
- Every UI string lives in both `messages/es.json` and `messages/en.json`; Spanish first. No hardcoded UI text, including staff screens.
- Navigation works at every size: sidebar/rail/drawer, never a scrolling top tab bar. Check 390, 768 and 1280 px, light and dark.
- Feature flags are in `src/config/flags.ts`; implementations go behind the connector registries in `src/connectors` (e.g. `TabSplitter`, `RateLimiter`, payments). Don't add parallel env-var flags or bypass a connector.
- Money is integer cents, computed on the server; the browser never sends an amount to charge. IVU uses `src/lib/money`.

## Bill splitting (pass 2) — agreed rules, details in DECISIONS.md

- Guest orders go straight to the kitchen through `place_order`/`place_guest_order`. Never add staff approval of orders or staff-opened visits; abuse is handled by limits, rate limits and Servicio flags.
- One tab per table (Toast model). A participant is created on a phone's first order, identified by the hashed device cookie scoped to the tab. Name optional, otherwise "Invitado #n"; names unique per table, staff-like names blocked, #n always shown.
- Shared ("Para compartir") dishes are split into locked shares when ordered, among people who have ordered so far.
- Checkout: Mis platos, Pagar el balance, Pagar por otra persona, or one even-split plan per table. IVU per payment is the difference in cumulative IVU. Every payment records what it covered.
- The tab stays open after payments; it closes at $0 after 10 minutes with no orders, or when staff marks the table free.
- `feat/staff-bill-splitting` (Codex's staff-approval design) is reference only; don't merge or build on it.
