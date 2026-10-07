# Mezza pass 1 plan

## Hand-off (read first when resuming)

- Local Supabase runs in Docker as project `mezza` on ports 55320–55329 (isolated from other projects). `.env.local` is generated from `supabase status -o env`.
- User decision: build in PLAN order (no demo-first track). Post short progress messages during long waits.
- Done early at the user's request (2026-10-05): phase 4 menu renderers on static data (`/es/demo`, home hero).
- Guest polish pass done after phase 8 (user request): quick "+" add, photo thumbnails in Simple, sticky section chips that follow the scroll, dish sheet with full-width photo and an always-visible add button, cart quantity steppers + "Seguir pidiendo", guest page fills the screen (menu scrolls inside, cart bar always visible).
- Agreed for phase 9 (user request): Ajustes gets restaurant branding — logo and cover photo on the guest page, guest header/buttons in the restaurant's colour (contrast-checked). Optional, small: a light/dark/auto theme switch (the `mezza-theme` cookie in `src/components/shell/document.tsx` already exists; it needs a toggle).
- Bill splitting is pass 2 (see "Pass 2: bill splitting" at the end); resume from its first unchecked task. Testing on real phones needs the dev server on the LAN IP (and `allowedDevOrigins` in `next.config.ts`).
- Phases 1–8 complete (phase 8 added migration `20261005000500_reports.sql`: `report_summary` and a revised `refresh_sales_summaries`). Phase 9 done too (migration `20261005000600_branding.sql`: `restaurants.brand_color`, `cover_path`). Phase 9b done too (migration `20261005000700_floor_and_tags.sql`: table shape/position, `menu_items.tags`; "Tomar orden" lives at `/app/[slug]/servicio/orden`). Phase 10 done (2026-10-05): every section 10 item has a test; screenshots of every screen in light and dark; README rewritten for a fresh clone (verified with `supabase db reset` + `pnpm seed`). Pass 1 is complete. Next (user decides): GitHub repo, Supabase cloud + Vercel for client demos; open items below.
- Phases 1–4 complete (guest menu still reads the static fixture on the website demo; the guest page in phase 7 uses `loadMenu`). Next: phase 5 (website pages, demo QR + request form, signup/reset, onboarding wizard).
- E2E runs with one worker (shared seeded restaurant); `resetTable(n)` in `tests/e2e/helpers.ts` clears a table's live tab before guest tests.
- E2E logins use `tests/e2e/helpers.ts` (waits for hydration; generous timeout under parallel load).

Source of truth: `MEZZA_PASS1.md`. Phase gate: `pnpm typecheck && pnpm lint && pnpm test` (plus `supabase test db` from phase 2), then commit `pass1(phase N): <summary>`.

## Phase 1: Foundation

- [x] Scaffold Next.js (App Router, TS strict, pnpm, Tailwind 4, src/)
- [x] ESLint with `no-restricted-imports` for connector implementations and the admin client; Prettier
- [x] Vitest config and first tests; Playwright config
- [x] Design tokens as CSS variables (light, dark, `data-theme`), exposed through the Tailwind theme
- [x] Archivo via `next/font/local`; brand assets moved from `brand/` into `public/`
- [x] UI primitives: Button, Segmented, Chip, Pill, Panel, Tag, Field, Switch, LangToggle, Diamond mark
- [x] next-intl: routing (`/es`, `/en`), proxy for marketing paths, request config with cookie fallback for `/app`, `/r`, `/admin`
- [x] `messages/es.json`, `messages/en.json` and the key-parity test
- [x] Layouts: site (header, footer, texture), app, guest, admin
- [x] `src/config/flags.ts`, `pricing.ts`, `menu-fonts.ts`
- [x] `.env.example`, `DECISIONS.md`
- [x] Screenshots at 390 and 1280 px of the layouts

## Phase 2: Database

- [x] `supabase init`, config
- [x] Migrations: enums, tables, `updated_at` triggers, indexes
- [x] Functions: `has_role`, `create_restaurant_with_owner`, `place_order`, `publish_menu_import`, `refresh_sales_summaries` (+ `set_item_availability`, `set_order_status`, `void_order`, `record_refund`, price-change audit trigger)
- [x] RLS on every table, staff policies, storage buckets and policies, reporting views (`security_invoker`)
- [x] Generated types in `src/lib/db/types.ts` (`pnpm db:types`)
- [x] `supabase/seed.sql` (Café Lucía menu, theme, QR design; Barra Test)
- [x] `pnpm seed` script (logins, 12 tables + QR tokens, printed page + photos, 90 days of history) — ran against local Supabase
- [x] pgTAP tests written; passing in PGlite via `pnpm db:check` (382 checks)
- [x] `supabase start` and `supabase test db` on real Supabase: 382 tests pass

## Phase 3: Auth and libraries

- [x] Supabase server/browser/admin clients, session refresh in proxy, route protection (membership + role per section, platform admin for /admin); basic `/[locale]/entrar` login (phase 5 completes account pages)
- [x] Role-gated navigation (`src/lib/auth/staff.ts`), each role lands on its own screen
- [x] Connectors: shared types, every interface, registries, dev implementations, stubs, `CONNECTORS.md`
- [x] `lib/money` (cents, IVU, tips) with tests
- [x] `lib/tickets` (`renderTicketText`) with tests
- [x] `lib/qr` (token derivation, matrix, shared shape renderer, SVG string, safety checks; 81 decode combinations)
- [x] Test: no `'use client'` file imports `@/lib/db/admin`

## Phase 4: Menu

- [x] Shared menu renderers: house, original, simple (`src/components/menu`, static Café Lucía fixture for now; demo at `/es/demo` and the home hero)
- [x] Item sheet with modifiers, qty, note
- [x] Guest page reads the database (`loadMenu`); the website demo keeps the static fixture by design. Menu fonts beyond Playfair/Josefin still to load
- [x] Menu editor: sections (drag + keyboard), items, modifiers, photos, availability events, price audit (trigger), live preview from the database (`src/lib/menu/load.ts`)
- [x] Import: upload, fixture importer, review screen (flags, draggable/resizable + keyboard hotspots, theme), publish via `publish_menu_import`

## Phase 5: Website and onboarding

- [x] Home (all sections), pricing, demo + demo request, how it works, legal drafts
- [x] Signup, login, magic link, password reset
- [x] Onboarding wizard (6 steps, resumable)

## Phase 6: QR studio

- [x] Studio controls, presets, safety checks, preview (`src/components/qr/qr-studio.tsx`)
- [x] Rotation with confirmation (bumps `token_version`)
- [x] PDFs: letter sheet, folded tents (back panel upside down), stickers; stored in `exports` (`/app/[restaurant]/qr/pdf`); wizard step 6 downloads the sheet
- [x] Decode tests across preset × dots × corners × logo (81, shared renderer)

## Phase 7: Ordering basics

- [x] Guest page: token resolution, menu, cart, send to kitchen (double tap = one order), status, service requests
- [x] Pay screen (tip on pre-tax subtotal, separate IVU lines), cash flow, mock card/ATH in demo, receipt
- [x] Servicio, Mesas, Cocina (polling `/api/events`, guest `/api/r/.../events`)
- [x] Printing (browser + print_jobs), voids, refunds (manager/owner, reason, audited), device registration

## Phase 8: Owner insights

- [x] Inicio (today live from payments vs. the same weekday last week, method mix, IVU, open tables, alerts)
- [x] Reportes (10 metrics from `report_summary`, date range presets + custom, table view on every chart)
- [x] Exportar (IVU PDF/CSV, sales CSV/XLSX, stored in `exports`, re-download via signed URL)
- [x] Summary refresh after cash/card/ATH payments and refunds (restaurant-local dates); `/api/cron/refresh-sales` + `vercel.json` cron

## Phase 9: Team, settings, plan and admin

- [x] Equipo: invite staff (Supabase admin invite from server code), change roles, deactivate; PIN section shows coming soon
- [x] Ajustes: profile (name, slug, timezone, default language, default menu style); IVU rates as % (stored as bps); fiscal mode (sit-beside, processor coming soon); payment provider status + onboarding buttons; printers (add/edit, "Imprimir prueba"); support-access approvals
- [x] Ajustes → Marca (user request): logo (reuse the QR studio upload) and cover photo on the guest page; guest header/buttons in the restaurant's colour with a contrast check (fall back to navy if it fails)
- [x] Plan: trial days left and the active pricing model from config
- [x] Admin: restaurants (onboarding step, trial days, plan, 30-day volume, last order), health flags (no orders in 3 days, failed payments, failed prints, devices unseen 24 h), support access (time-limited, owner approves in Ajustes, logged), feature flags (read-only)

## Phase 9b: Staff interface pass (user request, from reference designs)

Keep Mezza's own look (tokens, Archivo); take layout patterns only. Status colours always carry a text label.

- [x] Side menu on tablet/desktop, grouped: Operación (Servicio, Mesas, Cocina) · Menú (Menú, Códigos QR) · Negocio (Inicio, Reportes, Exportar) · Administración (Equipo, Ajustes, Plan); count badges (e.g. open alerts on Servicio); phones keep a compact menu
- [x] Light / dark / automático switch (sidebar footer, site header, guest page) writing the existing `mezza-theme` cookie (`src/components/shell/document.tsx`); guest De la casa/Original keep the restaurant's paper colours
- [x] Servicio: live order strip — cards (#, Mesa, platos, minutes ago, status) with filter tabs and counts: Todas, Nuevas, En cocina, Listas, Servidas
- [x] Cash payment dialog: amount due, quick amounts ($20/$40/$50/exacto), keypad for cash received, change in large type; then a success sheet (amount, method, time, Imprimir recibo, Volver a Servicio). Card/ATH tiles only when connected; "Dividir cuenta" tab waits for splitBill
- [x] "Tomar orden" two-pane tablet screen: photo cards with − / + and category chips with counts; right panel with the table's order, subtotal, IVU estatal and municipal on separate lines, "Enviar a cocina" (reuses `staffPlaceOrder`)
- [x] Mesas floor plan: tables by area (Salón/Terraza/Afuera tabs), shape and seats, colour + label per state (libre, ordenando, pagando, atención), seats taken/total; owners arrange by drag in Ajustes (migration: `dining_tables.area`, `shape`, `pos_x`, `pos_y`, `rotation`); phones keep the grid
- [x] Dish tags (Vegetariano, Sin gluten, Picante) in the menu editor, shown on staff and guest menus (migration: `menu_items.tags text[]`)
- [x] E2E for each, screenshots at 390 and 1280 px, light and dark

Not taking from the references (log in DECISIONS when built): "Bill & Print"/invoices (Mezza isn't the fiscal register in pass 1), product/extra/coupon discounts and "% Off" badges (change the IVU base; needs permissions + audit — later), reservations/book table, delivery/take-away, drafts, UPI, donation lines, staff avatars.

## Phase 10: Verification and docs

- [x] Playwright smoke tests (section 10)
- [x] Screenshot review and fixes
- [x] README, CONNECTORS.md, DECISIONS.md
- [x] Final full test run

## Pass 2: bill splitting (agreed 2026-10-06)

Builds on the pass 1 flow; it doesn't replace it. Guest orders keep going straight to the kitchen through `place_order`: no staff approval and no staff-opened visits. Model: Toast Mobile Order & Pay (one table tab; each phone tracks its own items; "pay for my items", "pay the balance" or split evenly). Rules and the simulations behind them are in DECISIONS.md under "Bill splitting". `feat/staff-bill-splitting` (Codex) is reference only and is not merged; only `distribute()` and its property tests come from it.

UI flags: `splitBill` and `sharedTab` in `src/config/flags.ts`. Even/per-item splitting is implemented in the `TabSplitter` connector. Phase gate as in pass 1 (`pnpm typecheck && pnpm lint && pnpm test && pnpm test:db`), then commit `pass2(phase N): <summary>`.

### Phase 1: Participants

- [x] A participant is created on the phone's first order (not on scan), bound to the tab by an HttpOnly device cookie whose hash is stored server-side; a new tab means a new join (migration `20261006150000_participants.sql`, `place_guest_order`)
- [x] Optional name field on the first order; otherwise "Invitado #n" / "Guest #n" (n = join order at the table); rename from "Mi pedido"
- [x] Names unique per table (a taken name is refused, or falls back to "Invitado #n" on the first order); staff-like names blocked (`src/lib/guest/names.ts`); the #n always shows next to the name
- [x] Orders and their items carry `participant_id`; "Tomar orden" picks a person or the whole table
- [x] "Para compartir" on the dish sheet and each cart line (guest and staff); a shared line is split at order time into locked shares among the people who have ordered so far (`order_item_shares`). Staff re-sharing is in the database (`set_item_shares`); its screen comes with the phase 5 table detail
- [x] Group check on "Mi pedido": everyone's items and shares by person, plus the table's lines (`src/lib/guest/group-check.ts`); paid/unpaid per person arrives with per-person payments in phase 4

### Phase 2: Limits and rate limiting

- [x] Restaurant settings (migration `20261006170000_order_limits.sql`) with defaults: max $300 per order, 20 per line, $1,500 per open tab, 20 people per table; editable in Ajustes (owner, audited); enforced in `place_order` for QR orders only
- [x] Staff "Ampliar límite" on a table raises its tab cap (Servicio shows tables at 80% of their cap); staff-entered orders are never capped
- [x] Postgres `RateLimiter` implementation (`MEZZA_RATE_LIMIT=postgres`, now the default): per phone, per table and per IP (`src/lib/client-ip.ts`, platform headers only); 5 orders a minute per phone
- [x] Servicio flags: "Mesa nueva por QR" on an order that opened an idle table (badge and a hint in Servicio; the kitchen board and ticket say "Mesa nueva"; voiding stays with managers), and "pagó y pidió de nuevo" when someone orders after paying (lights up with per-person payments in phase 4)

### Phase 3: Split engine

- [x] `TabSplitter` even and per-item modes (`standardSplitter`, previews for screens); the two `it.todo` property tests are real
- [x] `payment_allocations` (payment, item or share, cents): what each payment covered; a charge is paid when its allocations reach it; pending payments hold their charges, failed ones release them (migration `20261006190000_split_engine.sql`, `tab_charges`)
- [x] One locked RPC (`create_tab_payment`) computes every payable amount server-side from the chosen option (mine, person, balance, plan shares); the phone never sends an amount; idempotency key per payment
- [x] IVU per payment = IVU(paid subtotal including this payment) − IVU(paid subtotal before it), so every payment is non-negative and the table total equals the one-check IVU (`ivuForPart` mirrors it in TypeScript)
- [x] Even split is one plan per table (`start_split_plan`, `cancel_split_plan`): the first person sets N over everything unpaid; later orders belong to whoever orders them, outside the plan; cancellable until a share is paid or pending
- [x] Property tests from the 2026-10-06 simulation: 150 random tables in Postgres (shared dishes, whole-table orders, plans, mine/person/balance, failed payments) conserve every cent with exact IVU and nothing negative; TypeScript property tests for the splitter and `ivuForPart`. Voids after payment and refunds are covered with phase 5's flows

### Phase 4: Guest checkout

- [x] Phone checkout: Mis platos (default when owed), Pagar por otra persona, Todo lo que falta en la mesa, and Dividir en partes iguales (start, join or cancel the table's plan; pay one or more shares); amounts previewed from `tab_checkout` (migration `20261006210000_guest_checkout.sql`), charged by `create_tab_payment`
- [x] One pending payment per phone, expires after 15 minutes (enforced in `create_tab_payment` since phase 3); the phone or staff ("Cancelar" on the cash alert) can cancel it
- [x] Efectivo creates a pending payment that staff confirms; card and ATH use the same path (the provider marks the same payment paid; a provider that can't take it releases it)
- [x] `guestPay` no longer locks the whole table to "paying"; the table keeps ordering. A phone that pays without ordering becomes a person (`ensure_participant`)
- [x] Live balance on every phone (who has paid, "Pago en proceso", what's left at the table); a receipt per payment listing what it covered (shares and even-split parts marked); "Cerrado en el POS" appears only when the table is fully paid

### Phase 5: Staff side

- [x] Table detail at Mesas → a table (`/app/[slug]/mesas/[table]`; tiles link there): people, their items, owed / paid / in progress, the table's payments and write-offs; re-share a shared line (`set_item_shares`) (migration `20261007000000_staff_tools.sql`)
- [x] "Cobrar" → "Dividir cuenta": charge a person, the balance or equal shares (start/cancel the split), then collect in the cash dialog; collect or cancel pending cash from the payments list
- [x] "Mover a otra persona" / "a la mesa" for lines no money has touched (`move_order_item`); paid lines show "Con pago" and can't change
- [x] Voids (`void_line`): an unpaid line lowers the balance; a paid line refunds each payer their part plus its IVU (`record_refund`), and staff are told how much to hand back; lines held by a pending payment can't be voided (old `void_order` path checks too)
- [x] Manager write-off with a reason (a person's, the table's, or everything left; `write_off`); Reportes shows voids, write-offs and refunds apart from sales (`period_adjustments`)
- [x] "Mesa libre" closes a settled table (`close_tab`); settled tables quiet for 10 minutes close on their own as staff screens and guest pages load (`close_idle_tabs`); the next order starts a new tab with new people; the "Cerrado en el POS" reminder stays separate
- [x] Checked at 390/768/1280 px, light and dark (`tests/e2e/staff-tools.spec.ts`, no sideways scroll)

### Phase 6: Verification

Faster E2E first (user request, 2026-10-06), so the rest of the phase runs on it:

- [x] Timing report: run the suite once with the JSON and HTML reporters; a guide to every test (what it checks, how long it takes, keep in every run / before releases only / cut) for the user to review before anything is trimmed ([docs/E2E_TESTS.md](docs/E2E_TESTS.md): 80 tests, 10 min; the screenshot review was 32%)
- [x] Full suite against a production build (`pnpm test:e2e:prod`, `playwright.prod.config.ts`): mock payments switched to their stubs, demo-only tests skip themselves; `next dev` stays for single-file runs while building. Caught a stale assertion the dev server could never reach (signup's "disponible próximamente")
- [x] Parallel E2E: `pnpm seed:e2e` copies Café Lucía per worker (`cafe-lucia-w{k}`, "Café Lucía (w{k})": menu, tables, photos, logins `dueno.w{k}@…`, same history; global setup runs it); tests reach their restaurant, logins and tables through helpers (`worker()`, `app()`, `email()`, `tableId()`, `atApp()`); each worker sends its own test IP for the per-IP rate limits. 4 workers by default (`E2E_WORKERS`). Full suite: 10 min → 1.7 min on a production build
- [x] Trim or move to a pre-release run whatever the user agrees from the timing report: the screenshot review is on demand (`pnpm screenshots`, its own config); its phone-menu check moved to site.spec.ts

- [x] Multi-phone E2E (`tests/e2e/split-edge-cases.spec.ts`): two phones paying at once, paying while someone orders, someone leaving early, an even plan with a late order, a pending payment expiring, auto-close and the next party at the same table; a void after a partial payment is in staff-tools.spec.ts and the database tests. Found and fixed a deadlock (paying while someone orders or pays) and lapsed payments that kept "Pagar" disabled
- [ ] Real phones over the LAN: prepared (`MEZZA_DEV_ORIGINS` → `allowedDevOrigins`, README "Testing on phones"); needs the user with two or three phones
- [x] README, CONNECTORS.md (`TabSplitter`, Postgres `RateLimiter`), DECISIONS.md updated

## Pass 3: ATH Móvil (planned 2026-10-07, not started)

Full plan: [docs/ATH_MOVIL_PLAN.md](docs/ATH_MOVIL_PLAN.md). Order: the public `athmovil` package (P1–P5, its own repo) and Mezza phases 1–5 against a fake ATH server first (the user's ATH Business account isn't available yet); phase 0 live spike when it is, before Mezza phase 6; then Grumi (`Stratum-PR/pet-hub`, expected to be built by Genesis). The package repo and Grumi each start with their own Docker test environment (see "Separate Docker test environments" in the plan). Wait for the user's go-ahead before starting.

- [ ] Package P1–P5 released as `0.1.0` (fake server from Evertec's documented responses)
- [ ] Phase 1: Data
- [ ] Phase 2: Connecting a restaurant
- [ ] Phase 3: Provider and server routes
- [ ] Phase 4: Guest screens
- [ ] Phase 5: Staff and refunds
- [ ] Phase 0: live spike + Evertec questions (needs the user's ATH Business account)
- [ ] Phase 6: Verification
