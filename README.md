# Mezza

QR table ordering and payments for sit-down restaurants in Puerto Rico, by Stratum PR. Guests scan
the code on their table, order from the restaurant's own menu in Spanish or English, follow their
order, call the server and pay. Staff run service, tables and the kitchen; owners edit the menu,
print QR codes and see sales, IVU and menu performance.

The build brief is `MEZZA_PASS1.md`; progress is in `PLAN.md`; every judgment call is in
`DECISIONS.md`; integrations are described in `CONNECTORS.md`.

## Requirements

- Node 20.9+ and pnpm 10
- Docker Desktop, running (local Supabase)
- Windows: if `pnpm dev` or `pnpm typecheck` fails with `ERR_SWC_NATIVE_CACHE`, add
  `SWC_NATIVE_BINDING_CACHE=C:\Users\<you>\.cache\swc-native` to `.env.local` (and to the shell for
  `pnpm typecheck`); newer `@swc/core` refuses cache folders other accounts can write to.

## Setup from a fresh clone

```bash
pnpm install
pnpm exec playwright install chromium
cp .env.example .env.local
pnpm exec supabase start -x realtime,edge-runtime,logflare,vector,supavisor,imgproxy
```

`supabase start` prints the local API URL, anon key and service role key. Put them in `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), then set:

- `QR_TOKEN_SECRET`: 32+ random characters. Changing it later invalidates every printed QR code.
- `CRON_SECRET`: 16+ random characters (guards `/api/cron/refresh-sales`).
- For a local demo with card and ATH Móvil working end to end: `MEZZA_PAYMENTS_CARD=mock` and
  `MEZZA_PAYMENTS_ATH=mock` (mocks only run while `MEZZA_DEMO_MODE=true` and not in production).

Then load the data and start the app:

```bash
pnpm exec supabase db reset   # migrations + supabase/seed.sql
pnpm seed                     # logins, tables + QR tokens, printed menu, photos, 90 days of history
pnpm dev                      # http://localhost:3000
```

| Where             | Path                                   |
| ----------------- | -------------------------------------- |
| Website (ES / EN) | `/es`, `/en`                           |
| Staff and owners  | `/app` (sign in at `/es/entrar`)       |
| Guest at a table  | `/r/<restaurant>/t/<token>` (QR codes) |
| Stratum admin     | `/admin`                               |

### Isolated local stack

Mezza's Supabase never shares containers, volumes or ports with other local projects: project id
`mezza` (containers `supabase_*_mezza`) on ports 55320–55329 (API 55321, database 55322, Studio
55323, mail 55324). Invitation and password emails land in the local mail viewer at
http://127.0.0.1:55324. `pnpm exec supabase stop` stops only Mezza's stack.

### Local logins

Every seeded login uses the local-only password `mezza-local-2026`.

| Email                     | Role                   | Lands on |
| ------------------------- | ---------------------- | -------- |
| dueno@cafelucia.example   | Café Lucía owner       | Inicio   |
| gerente@cafelucia.example | Café Lucía manager     | Inicio   |
| mesero@cafelucia.example  | Café Lucía server      | Servicio |
| cocina@cafelucia.example  | Café Lucía kitchen     | Cocina   |
| dueno@barratest.example   | Barra Test owner       | Inicio   |
| admin@stratum.example     | Stratum platform admin | `/admin` |

## Hosted demo data

The hosted project (`mezza.stratumpr.com`) gets the same Café Lucía demo, kept light for the free
database tier: about 15% of the local history (roughly 500 orders over 90 days), no Barra Test logins.

1. Load the menu, theme and tables' restaurant rows (`supabase/seed.sql`) into the linked project:
   `pnpm exec supabase db push --include-seed`
2. Create `.env.cloud` (git-ignored) with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `NEXT_PUBLIC_GUEST_BASE_URL=https://mezza.stratumpr.com`, `MEZZA_SEED_CLOUD_REF=<project ref>` and the
   **same** `QR_TOKEN_SECRET` as Vercel (otherwise the demo QR codes won't open).
3. `pnpm seed:cloud`, then save the passwords it prints (shown once, stored nowhere).

## Demo walkthrough

1. Sign in as the owner. **Códigos QR** shows each table's code: scan Mesa 4 with a phone on the same
   network, or open the Mesa 4 link that `pnpm seed` prints.
2. As the guest: pick a style (De la casa, Original, Simple), add dishes, **Enviar a cocina**, follow
   the order, **Llamar al mesero** or **Pedir la cuenta**, then pay (cash, or card/ATH with mocks on).
3. In another browser window, sign in as `cocina@` (**Cocina**) and `mesero@` (**Servicio**) to move
   the order along, collect cash and close the sale on the POS.
4. Back as the owner: **Inicio**, **Reportes** and **Exportar** (the IVU summary for SURI) include it.

## Screens

| Section     | What it does                                                                     |
| ----------- | -------------------------------------------------------------------------------- |
| Inicio      | Today vs. the same day last week, payments, IVU, open tables, alerts             |
| Servicio    | Today's orders by status, alerts, cash dialog, voids and refunds                 |
| Tomar orden | Tablet order screen for guests who don't scan (`/servicio/orden`)                |
| Mesas       | Floor plan by area (tablet/desktop) or grid (phone), live table state            |
| Cocina      | Kitchen display, sold-out toggles, ticket printing                               |
| Menú        | Editor with live preview, modifiers, photos, tags; menu import with review       |
| Códigos QR  | QR studio, code rotation, print-ready PDFs                                       |
| Reportes    | Ten metrics with date ranges and table views                                     |
| Exportar    | IVU summary (PDF/CSV) and sales (CSV/Excel), stored for re-download              |
| Equipo      | Invites, roles, deactivation                                                     |
| Ajustes     | Profile, Marca, IVU, fiscal mode, payments, floor plan, printers, support access |
| Plan        | Trial and pricing                                                                |

## Checks

```bash
pnpm typecheck && pnpm lint && pnpm test   # types, lint, unit tests
pnpm test:db                               # pgTAP database tests (needs the local stack)
pnpm db:check                              # same database tests on in-process PGlite (no Docker)
pnpm test:e2e                              # Playwright smoke tests; starts the dev server if needed
pnpm screenshots                           # on demand: every screen, 390 and 1280 px, light and dark
```

End-to-end tests run serially against the seeded Café Lucía data and tidy up after themselves
(`resetTable` in `tests/e2e/helpers.ts` only ever touches the local stack). The screenshot review is
left out of `pnpm test:e2e`; run it before a release or after UI work. What every test checks and
how long it takes: [docs/E2E_TESTS.md](docs/E2E_TESTS.md); `npx playwright show-report` opens the
latest run.

## What's real and what's a stub

Real in pass 1: QR ordering, the kitchen display, servers' screens, cash payments confirmed by staff,
the sit-beside fiscal flow ("Cerrado en el POS"), browser printing, reports, exports, team and
settings. Card payments, ATH Móvil, fiscal processors, network printers, AI menu import, shared
tabs and bill splitting, SMS and billing are interfaces with stubs (and demo mocks), switched on per
connector once they pass their tests. See `CONNECTORS.md` and `src/config/flags.ts`.

## Layout

- `src/app/[locale]` website · `src/app/app` staff and owner app · `src/app/r` guest · `src/app/admin` Stratum admin · `src/app/api` auth callback, events, cron
- `src/components` UI by area (`ui` primitives, `menu`, `staff`, `reports`, `settings`, …)
- `src/lib` money, IVU, QR, tickets, reports, exports, auth, data loaders and server actions
- `src/connectors` integrations behind interfaces · `src/config` flags, pricing, presets
- `supabase/migrations`, `supabase/tests`, `supabase/seed.sql` · `scripts/seed` local data
- `messages/es.json`, `messages/en.json` every UI string · `docs/screenshots` screenshot review
