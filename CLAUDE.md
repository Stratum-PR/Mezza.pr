@AGENTS.md

# Mezza

- The product is **Mezza** (renamed from "Mesa"). The Spanish word "mesa" (table) stays in table labels: "Mesa 4", the "Mesas" screen, `/mesas`.
- Build brief: `MEZZA_PASS1.md`. Resume from the first unchecked task in `PLAN.md`. Log judgment calls in `DECISIONS.md`.
- Phase gate: `pnpm typecheck && pnpm lint && pnpm test` (plus `pnpm test:db` from phase 2), then commit `pass1(phase N): <summary>`.
- Brand follows the Stratum FSQMS landing page; tokens live in `src/app/globals.css`. Use tokens, not raw hex, and not Tailwind's `dark:` variant.
- Every UI string lives in both `messages/es.json` and `messages/en.json`; Spanish first.
