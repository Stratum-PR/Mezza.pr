# Mezza by Stratum: build pass 1

You are building the first pass of **Mezza**, a QR table-ordering and payments product for sit-down restaurants in Puerto Rico, sold by Stratum PR. This pass builds everything that is well-trodden in full. Every risky integration is built as a typed connector with a working dev implementation, so later passes slot in without touching the screens.

Read this whole file, `reference/mezza-prototype.html` and `brand/` before writing code.

---

## 0. How to work

1. **Plan, then build.** Create `PLAN.md` with every phase in section 9 broken into checkbox tasks. If `PLAN.md` already exists, you are resuming: continue from the first unchecked task.
2. **Phase gates.** After each phase, run `pnpm typecheck && pnpm lint && pnpm test`. From phase 2 on, also run `supabase test db`. Fix everything, tick the boxes, and commit as `pass1(phase N): <summary>`.
3. **Don't stop for confirmation.** When something is ambiguous, make the reasonable call and keep going. Add one line to `DECISIONS.md` covering the decision, the reason, and how to reverse it. Stop only for the cases in section 11.
4. **Verify APIs instead of recalling them.** Before using Next.js, next-intl, @supabase/ssr, Tailwind or any other library, check it against the installed version's types and docs. Follow the installed version's conventions even where they differ from wording in this file.
5. **Never invent a third-party API.** This pass makes no calls to Stripe, ATH Móvil, the Claude API, Epson/Star printer SDKs, Supabase Realtime, YCS/Evertec or Twilio. They exist only behind the interfaces in section 7.
6. **Look at what you built.** Before closing a UI phase, take Playwright screenshots of its screens at 390 px and 1280 px wide. Compare them with the prototype and fix what's off.

---

## 1. Product in brief

Guests scan a QR at their table and see the restaurant's own menu, in the restaurant's style and in Spanish or English. From there they order, follow their order, call the server, and pay from their phone. Staff take orders for guests who don't scan, run a kitchen display, and confirm cash payments. Owners edit the menu, design and print QR codes, and see sales, IVU and menu performance. Stratum runs an admin view across all restaurants.

Mezza starts out beside each restaurant's existing POS. The restaurant still closes each sale on its own fiscal terminal ("fiscal path A"). Later passes make Mezza the POS.

The signature feature is the menu. Owners upload their printed menu, and guests get it back in one of three styles:

- **De la casa:** rebuilt for phones in the restaurant's own style.
- **Original:** the printed page itself, with tap zones.
- **Simple:** a clean list.

---

## 2. Stack (fixed)

- **App:** Next.js (current stable, App Router) with TypeScript `strict`. Use React Server Components by default and server actions for mutations. Use pnpm.
- **Styling:** Tailwind (current major). Define the section 3 tokens as CSS variables and expose them through the Tailwind theme.
- **Data:** Supabase, run locally with the CLI (`supabase init`, `supabase start`).
  - SQL migrations go in `supabase/migrations`.
  - The seed is `supabase/seed.sql` plus a TypeScript script (`pnpm seed`) for generated history and storage uploads.
  - Generate database types into `src/lib/db/types.ts`.
- **Auth:** Supabase Auth via `@supabase/ssr`, with cookie sessions, email + password, and magic link. Use whichever key names the installed CLI and SDK expect (anon/service-role or publishable/secret).
- **i18n:** next-intl.
  - The marketing site uses locale prefixes (`/es`, `/en`).
  - The staff/owner app (`/app`), guest pages (`/r`) and admin (`/admin`) have no prefix. They take the locale from the user's profile or a cookie.
  - Locale middleware applies only to marketing paths.
- **Validation:** zod at every server boundary.
- **Charts:** Recharts.
- **PDF:** @react-pdf/renderer.
- **QR:** `qrcode`, using its matrix API. Draw the modules yourself as SVG primitives, so the on-screen preview and the PDF share one renderer.
- **QR decoding in tests:** `@resvg/resvg-js` to rasterize, `jsqr` to decode.
- **Excel:** exceljs.
- **Tests:** Vitest (unit), pgTAP via `supabase test db` (database), Playwright (end-to-end smoke and screenshots).
- **Deploy target later:** Vercel. Nothing long-running. Scheduled work is a route guarded by `CRON_SECRET`.

### Folder layout

```
src/
  app/                  routes (section 8)
  components/ui/        design-system primitives
  components/menu/      menu renderers shared by guest page, editor preview and website demo
  connectors/           section 7, one folder per connector
  lib/money/            cents, IVU, tips (pure, fully tested)
  lib/db/               server client, admin client (server-only), generated types
  lib/qr/               token derivation, matrix, SVG renderer (shared by preview and PDF)
  lib/tickets/          ticket model and plain-text renderer
  config/               flags.ts, pricing.ts, menu-fonts.ts
messages/es.json, messages/en.json
supabase/migrations, supabase/tests, supabase/seed/
reference/mezza-prototype.html   (styled to match the Stratum FSQMS site)
brand/                          fonts, logos, mark, texture; moved into public/ in phase 1
docs/screenshots/
```

### Environment (`.env.example` must list all of these)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=          # or publishable key, per installed SDK
SUPABASE_SERVICE_ROLE_KEY=              # or secret key; server only
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_GUEST_BASE_URL=http://localhost:3000
NEXT_PUBLIC_GUEST_DISPLAY_HOST=mezza.pr  # printed on QR cards; domain not final
QR_TOKEN_SECRET=                        # 32+ random bytes
CRON_SECRET=
MEZZA_DEMO_MODE=true
MEZZA_PAYMENTS_CARD=stub                 # stub | mock
MEZZA_PAYMENTS_ATH=stub                  # stub | mock
MEZZA_FISCAL=sit_beside                  # sit_beside | processor_stub
MEZZA_MENU_IMPORTER=fixture              # fixture | claude_stub
MEZZA_PRINTER=browser                    # browser | epson_stub | star_stub
MEZZA_ORDER_QUEUE=online                 # online | offline_stub
MEZZA_REALTIME=polling                   # polling | supabase_stub
MEZZA_STAFF_SESSION=personal_account     # personal_account | pin_switch_stub
MEZZA_NOTIFIER=console                   # console | resend_stub
MEZZA_BILLING=trial_only                 # trial_only | stripe_stub
MEZZA_RATE_LIMIT=noop                    # noop | upstash_stub
```

---

## 3. Brand and design

Mezza is a Stratum product. It shares one visual system with Stratum's food-safety landing page (FSQMS, live at mvp.stratumpr.com). That site is the brand reference. `reference/mezza-prototype.html` already uses its tokens and type. The real assets are in `brand/`; move them into `public/` in phase 1:

| File                                                         | Use                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `brand/fonts/archivo-latin.woff2`, `archivo-latin-ext.woff2` | Mezza's interface typeface                                                               |
| `brand/logos/stratum-logo-on-light.png`                      | header on light backgrounds                                                              |
| `brand/logos/stratum-logo-on-dark.png`                       | navy footer, dark mode                                                                   |
| `brand/stratum-mark.svg`                                     | favicon and the small mark next to the "Mezza" wordmark                                  |
| `brand/topo-tile.jpg`                                        | topographic texture, marketing site only (licensed to Stratum: Vecteezy / Khulqi Design) |

**Identity**

- **Palette:** navy `#1E2B7E`, blue `#266AB2`, sky `#5FA3DA` and sand `#E6E09E`.
- **Mark:** three rounded, overlapping diamonds in sand, sky and navy (the ◆ motif). Use the SVG; never redraw it with sharp corners.
- **Signature gradient:** `linear-gradient(135deg, navy, blue)`. Spend it sparingly (see Direction below).

**Tokens.** Use these exactly. Light values come from the FSQMS stylesheet. Dark values are Mezza's own, because the FSQMS site has no dark mode.

| Token                                | Light                                           | Dark              |
| ------------------------------------ | ----------------------------------------------- | ----------------- |
| navy / navy-deep / blue / sky / sand | #1E2B7E / #141D5C / #266AB2 / #5FA3DA / #E6E09E | same              |
| bg                                   | #F3F5FA                                         | #0E1230           |
| surface                              | #FFFFFF                                         | #161B42           |
| ink / ink-2                          | #16204F / #3A4270                               | #ECEEF8 / #C9CEE6 |
| muted                                | #586187                                         | #A3A9C9           |
| line / line-2                        | #E2E5EC / #ECEEF3                               | #2A3163 / #232A5A |
| accent / accent-ink                  | #1E2B7E / #FFFFFF                               | #6E9BE0 / #0E1230 |
| soft (tint) / sandsoft               | #EEF0F8 / #F6F3CF                               | #1E2556 / #34331F |
| olive (text on sandsoft)             | #5B5410                                         | #E6E09E           |
| ok / ok-bg                           | #1B7A4C / #E6F4EE                               | #4CC08A / #163A2E |
| warn / warn-bg                       | #9A5B00 / #FCF1DF                               | #E3A84A / #3A2D14 |
| bad                                  | #B3261E                                         | #EB6E66           |
| gradient                             | 135° navy → blue                                | same              |
| ATH Móvil button                     | #F58220, white text                             | same              |

**Shape and depth (from FSQMS)**

- Radii: cards and panels 18 px; hero objects, dialogs and large bands 22 to 28 px; buttons 11 px (13 px for large); chips and pills fully round.
- Cards: white with a 1 px `line` border. On the marketing site they lift on hover (`translateY(-3px)`, shadow `0 18px 40px -24px rgba(30,43,126,.35)`). App cards don't move.
- The primary button is navy with the shadow `0 8px 20px -10px rgba(30,43,126,.6)`. On navy or gradient bands the button is sand with navy text, weight 800.
- Segmented controls copy the FSQMS language toggle: a recessed `line` track with a raised white thumb. The ES/EN switch on the navy phone header is the translucent white version.
- Dialogs: 22 px radius, a `rgba(22,32,79,.45)` backdrop with a 3 px blur.
- The marketing header is sticky and translucent (`bg` at 90% with `backdrop-filter: saturate(1.4) blur(10px)`), with a bottom border. The footer is `navy-deep` with the on-dark logo, and links turn sand on hover.

**Type**

- Mezza's interface uses **Archivo**, self-hosted as on the FSQMS site (variable font, weights 400 to 800). Load it with `next/font/local` from `public/fonts/`. This replaces PP Telegraf (not licensed) and Urbanist. No interface font is loaded from Google at runtime.
- Headings: weight 800, letter-spacing −0.02em (−0.03em on the hero, sized `clamp(38px, 4.6vw, 58px)` with line-height 1.04). Lead paragraphs use `muted` at 17 to 19 px with line-height 1.55. Numbers use `tabular-nums`.
- Playfair Display and Josefin Sans are _restaurant menu_ fonts (Café Lucía's theme). Never use them for Mezza's own interface.
- `src/config/menu-fonts.ts` holds a curated list of about 12 Google font families. Menu themes may only use fonts from this list. Load them through `next/font/google`, which self-hosts them at build time.

**Direction**

- Mezza's own interface is quiet and exact: navy, white, generous spacing, clear hierarchy. The restaurant's menu is where expression lives; the house style takes the restaurant's palette, fonts and ornaments.
- Keep the FSQMS surfaces in their places:
  - **Marketing site:** the topographic texture (`topo-tile.jpg` at 1800 px, 5% opacity, `mix-blend-mode: multiply`, stopping above the footer), the gradient on the closing CTA band with a rotated, rounded sand square (a diamond) as decoration, and the navy-deep footer.
  - **App, guest pages and admin:** no texture. The gradient appears once per screen at most, for example on the highlighted KPI on Inicio. The navy phone header stays solid navy.
- Spend boldness in one place. On the home page, that is the before-and-after of a printed menu turning into the interactive house-style menu on a phone. Treat it the way FSQMS treats its "disconnected tools → one hub" diagram: one scripted timeline that starts from a grey, scattered "before" state, settles into the finished "after" state, and plays when it scrolls into view. Its default CSS is the finished state, so reduced motion shows the result (here, the two side by side).
- **Hero, after the FSQMS hero:** copy on the left; on the right, the phone with Café Lucía's house menu, overlapped at its lower corner by a small gradient card. On FSQMS that card cycles industry stats. Mezza must not invent numbers, so its card cycles one real order instead, with story-style progress tabs and a pause button: "Mesa 4 · enviado a cocina" → "Listo" → "Pagado con ATH Móvil". On phones the card stacks below the phone.
- **Motion language** (marketing site only; it all sits behind a `motion-on` class that is added only when reduced motion is off):
  - the hero headline rises word by word out of a blur;
  - the hero object builds in from a desaturated ghost state;
  - section headings "ink in" word by word from `#C5CBDB` as they scroll in;
  - staggered reveals use `cubic-bezier(.16, 1, .3, 1)`.

  The app stays almost still: short state transitions only.

- Design mobile first:
  - guests use phones;
  - servers use phones or tablets;
  - the kitchen uses a wall tablet;
  - owners use phones as often as laptops.

  Tap targets are at least 44 px.

- Use sentence case. Don't use all-caps labels or a small label above every heading. This is one place Mezza departs from FSQMS, which uses uppercase eyebrows. Use numbered markers only for real sequences, such as the 3-step "how it works" and the signup steps.
- Buttons say exactly what happens ("Enviar a cocina", "Descargar PDF"), and an action keeps the same name through the whole flow.
- Errors say what happened and how to fix it. Empty states say what to do first.
- Meet the accessibility baseline:
  - visible keyboard focus: a 3 px blue outline, which switches to sand on navy or gradient surfaces (as on FSQMS);
  - a skip link on the marketing site;
  - `prefers-reduced-motion` respected;
  - WCAG AA contrast;
  - safe-area insets on phones.
- Reuse the prototype's components: segmented controls, chips, pills, panels, the sand tag, and the navy phone header with the ES/EN switch.

## 4. Rules that apply everywhere

- **Money is integer cents.** Use `_cents` columns and a `Cents` type, never floats. Dollar amounts typed in the UI are converted once, at the boundary.
- **IVU:**
  - Rates are state 10.5% and municipal 1%, stored per restaurant in basis points (`ivu_state_bps` = 1050, `ivu_municipal_bps` = 100).
  - One pure function, `computeIvu(subtotalCents, rates)`, rounds each component half-up to the cent.
  - The tip is calculated on the pre-tax subtotal and is not taxed.
  - Note in DECISIONS.md that the rounding rule awaits CPA confirmation.
- **Bilingual, Spanish first.** Every UI string comes from `messages/es.json` and `messages/en.json`, including emails, PDFs, tickets and exports. A test fails if a key exists in one file but not the other.
- **Time:** each restaurant has a timezone (default `America/Puerto_Rico`). All "today", daily and hourly figures use it.
- **Snapshots:** order lines copy the dish name and price at order time, so later menu edits never change past bills.
- **Audit:** voids, refunds, price changes and support access write to `audit_log`.
- **No fake social proof:** no invented testimonials, customer logos or usage numbers anywhere.

---

## 5. What this pass builds

**Built fully**

- The bilingual marketing site, with a demo page, demo request form, pricing from config, and draft legal pages.
- Self-serve signup and the 6-step onboarding wizard, with a 30-day trial and no card required.
- The owner app:
  - today dashboard;
  - menu editor;
  - menu import review screen;
  - QR studio with print-ready PDFs;
  - analytics and exports;
  - team, settings and plan pages.
- The guest menu renderer in all three styles. One set of components serves the guest page, the editor preview and the website demo.
- The full database schema, row-level security for staff, seed data, and database tests.
- The Stratum admin: restaurants, health flags, support-access records, and feature flags (read-only).

**Built as working basic versions** (real code, simple mechanics)

- Guest ordering from one phone: cart, send to kitchen, order status, call server, bring the check, one check per table.
- Cash payment confirmed by staff, with the "close on your POS" checklist (fiscal path A).
- Server view, tables view and kitchen display, updated by polling.
- Voids and cash refunds for managers and owners, checked by role.
- Browser printing of kitchen tickets and receipts.

**Interface + dev implementation + stub only** (section 7). Do not build the real thing for:

- card payments (Stripe Connect) and ATH Móvil;
- shared multi-person tabs and bill splitting beyond one check;
- PIN switching on shared devices, and anonymous guest Supabase sessions;
- Supabase Realtime;
- the offline queue, service worker and on-device database;
- Epson ePOS / Star WebPRNT network printing;
- AI menu import and style extraction;
- fiscal processor integration (YCS, Evertec);
- SMS receipts, loyalty, Stratum subscription billing, and the rate-limiting backend;
- anything planned for v1.1, v1.5 or v2.

---

## 6. Database

### Table conventions

- Every tenant table has:
  - `id uuid primary key default gen_random_uuid()`;
  - `restaurant_id uuid not null references restaurants on delete cascade`;
  - `created_at`;
  - `updated_at`, kept current by a trigger.
- Money columns are `integer` cents, with `check (x >= 0)` where it applies.
- Use Postgres enums for statuses and roles.
- Items marked _(addition)_ are not in the original plan; keep them.

### Tables

These are the columns beyond the defaults above.

**Tenants and people**

- `restaurants`: slug (unique), name, address, phone, timezone, default_language, default_menu_style (house | original | simple), ivu_state_bps, ivu_municipal_bps, fiscal_mode (sit_beside | processor), plan, status (trial | active | paused | cancelled), trial_ends_at, onboarding_step
- `profiles`: user_id (pk → auth.users), full_name, phone, preferred_language
- `memberships`: user_id, role (owner | manager | server | kitchen), pin_hash (null in this pass), active; unique (user_id, restaurant_id)
- `devices`: name, kind (server | kitchen | register), last_seen_at, app_version
- `platform_admins`: user_id. These are Stratum staff, so this table has no restaurant_id. _(addition)_

**Menu**

- `menu_uploads`: storage_path, mime_type, status (processing | review | published | failed), ai_result jsonb, reviewed_by, published_at
- `menu_themes`: palette jsonb, display_font, body_font, ornament, paper_texture
- `menu_sections`: name_es, name_en, sort_order
- `menu_items`: section_id, name_es, name_en, description_es, description_en, price_cents, photo_path, is_available, sold_out_since, ai_confidence, sort_order
- `item_availability_events`: item_id, sold_out_at, back_at _(addition; needed for "time sold out")_
- `modifier_groups`: name_es, name_en, min_select, max_select
- `modifier_options`: group_id, name_es, name_en, price_cents, sort_order
- `item_modifier_groups`: item_id, group_id, sort_order
- `original_menu_pages`: image_path, width, height, page_number
- `item_hotspots`: item_id, page_id, x, y, width, height (fractions 0–1 of the page)

**Tables and tabs**

- `dining_tables`: label, seats, area, qr_token_hash, token_version, sort_order
- `qr_designs`: preset, fg, bg, frame, frame_ink, dot_style, eye_style, logo_mode (none | mono | upload), logo_path, frame_text_es, frame_text_en, font
- `tabs`: table_id, status (open | paying | closed), split_mode (one | even | items; only `one` is used now), split_count, party_size, opened_at, closed_at, pos_closed_at, pos_closed_by _(party_size and pos__ are additions)*
- `tab_participants`: tab_id, auth_user_id (null in this pass), display_name, guest_id
- `cart_items`: tab_id, participant_id, item_id, qty, modifiers jsonb, shared. Schema only; in this pass the cart lives on the device.
- `service_requests`: tab_id, kind (call_server | bring_check), status (open | handled), handled_by, handled_at

**Orders**

- `orders`: tab_id, number, source (qr | staff), idempotency_key (unique per restaurant), status (new | in_kitchen | ready | served | void), guest_language, created_by, device_id, synced_at
  - `number` is a per-restaurant sequence starting at 1001. _(number and guest_language are additions)_
- `order_items`: order_id, item_id, name_snapshot_es, name_snapshot_en, unit_price_cents, qty, modifiers_snapshot jsonb, participant_id, shared, note, status, voided_at, voided_by, void_reason

**Money**

- `payments`: tab_id, participant_id, method (card | ath | cash), amount_cents, tip_cents, ivu_state_cents, ivu_municipal_cents, status (pending | paid | failed | refunded | partially_refunded), provider_ref, idempotency_key, fiscal_control_number (nullable from day one)
- `refunds`: payment_id, amount_cents, reason, approved_by
- `payment_accounts`: provider (stripe | ath), stripe_account_id, ath_keys_secret_id (Vault reference), status
- `webhook_events`: provider, event_id (unique), payload jsonb, processed_at. Server-only, with no restaurant_id.

**Guests**

- `guests`: phone_e164, consent_at, preferred_language

**Kitchen and printing**

- `printers`: name, model, ip_address, protocol (browser | epson_epos | star_webprnt), role (kitchen | receipt), width_chars, active
- `print_jobs`: order_id, printer_id, kind (kitchen | receipt), status (queued | printed | failed), error, printed_at

**Reporting and platform**

- `daily_sales`: date, hour, sales_cents, ivu_state_cents, ivu_municipal_cents, tips_cents, covers, orders, card_cents, ath_cents, cash_cents
- `item_sales_daily`: item_id, date, units, revenue_cents, modifier_count
- `exports`: kind (ivu_monthly_pdf | ivu_monthly_csv | sales_csv | sales_xlsx | qr_pdf), period, file_path, created_by
- `audit_log`: actor_id, action (void | refund | price_change | pin_reset | support_access), target_table, target_id, before jsonb, after jsonb
- `subscriptions`: plan, stripe_customer_id, status, trial_ends_at
- `usage_fees`: period, card_volume_cents, ath_volume_cents, fee_cents
- `support_access_grants`: requested_by, approved_by, expires_at, reason _(addition)_
- `demo_requests`: name, restaurant_name, email, phone, message, locale. No restaurant_id. _(addition)_

### Database functions

These are security definer with a pinned `search_path`, and are called only from server code.

- `has_role(restaurant_id uuid, roles role[]) returns boolean`: the single helper every policy uses.
- `create_restaurant_with_owner(...)`: signup in one transaction (restaurant, membership, default QR design, trial end date).
- `place_order(restaurant_id, table_id, client_order_id, source, lines jsonb, guest_language, created_by)`:
  - opens a tab if none is open for the table;
  - re-reads prices, modifiers and availability from the menu tables, and never trusts client prices;
  - assigns the order number and inserts the order and its lines in one transaction;
  - returns the existing order if the idempotency key was already used.
- `publish_menu_import(upload_id, payload jsonb)`: writes sections, items, modifiers, theme, pages and hotspots in one transaction.
- `refresh_sales_summaries(restaurant_id, from_date, to_date)`: rebuilds `daily_sales` and `item_sales_daily` in the restaurant's timezone.

### QR tokens

- Derive each token as `base64url(HMAC-SHA256(QR_TOKEN_SECRET, table_id + ':' + token_version))`.
- Store only `sha256(token)` in `qr_token_hash`, for lookup.
- Because the token is derived, PDFs can be regenerated at any time without storing it.
- Rotating a table's code bumps `token_version`, which invalidates the old code.
- Unit-test derivation, lookup and rotation.
- Note in DECISIONS.md that changing `QR_TOKEN_SECRET` invalidates every printed code.

### Row-level security in this pass

- Enable RLS on every table in `public`, without exception.
- Write staff policies only. A signed-in user can read or write a tenant row when `has_role(restaurant_id, …)` allows it. Role permissions:
  - **owner:** everything.
  - **manager:** menu, tables, voids, refunds, staff and reports, but not payment setup or plan.
  - **server:** orders, tabs, service requests, cash confirmation, and reading the menu.
  - **kitchen:** reading orders, updating order status, and toggling sold-out.
- Write no policies for `anon`. Guests never query Supabase from the browser in this pass; guest pages go through server code that resolves the QR token first.
- The admin client lives in `src/lib/db/admin.ts` with `import 'server-only'`. Add a test that fails if any `'use client'` file imports it.
- Reporting views use `security_invoker = true`.
- Storage:
  - private buckets `menus`, `photos` and `exports`;
  - object paths start with the restaurant id;
  - storage policies use `has_role`;
  - images are served with signed URLs.

### Database tests (`supabase/tests`)

- Every `public` table has RLS enabled.
- Every tenant table has `restaurant_id not null`.
- **Cross-tenant isolation:**
  - Signed in as each Café Lucía role, every tenant table returns zero Barra Test rows.
  - Inserts and updates aimed at Barra Test fail.
  - Repeat in reverse, as Barra Test's owner against Café Lucía.
- **Role limits:**
  - kitchen can't read payments;
  - server can't change prices;
  - manager can't edit `payment_accounts`.
- **`place_order`:** rejects sold-out items, ignores client-sent prices, and returns the same order on a repeated key.

### Seed

**Café Lucía** (slug `cafe-lucia`, Viejo San Juan, since 1962)

- The menu:
  - the 5 sections, 12 items and 4 modifier groups exactly as in the prototype's `SECTIONS`, `MENU` and `MODS`;
  - Flan de queso is sold out.
- The theme: ink `#1F4D3A`, paper `#F3E9D2`, Playfair Display + Josefin Sans, and the ◆ ornament.
- The printed menu:
  - extract the prototype's original-menu SVG into `supabase/seed/assets/cafe-lucia-original.svg`;
  - rasterize it to PNG during seeding and upload it as page 1;
  - add hotspots for all 12 items using the prototype's tap-zone positions.
- Dish photos: render the prototype's `PH` illustrations to PNG and upload them as placeholder photos.
- 12 tables (Mesa 1–12), with derived QR tokens and the "De la casa" QR design.

**Logins**

- One login per role (owner, manager, server, kitchen), plus a Stratum platform admin.
- All use a local-only password listed in README.

**Barra Test**

- A second restaurant with its own owner, a few items and some orders, used by the isolation tests.

**90 days of generated Café Lucía history**

- Café hours, with breakfast and lunch peaks and a weekend lift.
- Realistic baskets and party sizes of 1–4.
- Payment mix of roughly 45% card, 20% ATH Móvil and 35% cash, with tips of 15–20%.
- A few voids and refunds, some English-language orders, and a few sold-out intervals.

Finish by running `refresh_sales_summaries`.

---

## 7. Connectors

### Structure and rules

Each connector lives in `src/connectors/<name>/` with:

- `types.ts`: the interface below, exactly. You may only extend it by adding optional members.
- one file per implementation;
- `index.ts`: a registry that picks the implementation from the environment variable and validates it at startup.

Rules:

- **Stub** implementations throw `ConnectorNotImplementedError(connector, implementation)`. The UI catches it and shows a calm "Disponible pronto / Coming soon" state, never a crash.
- **Mock** implementations load only when `MEZZA_DEMO_MODE=true` and `NODE_ENV !== 'production'`.
- Screens and server actions import only from `@/connectors/<name>`, never from an implementation file. Enforce this with an ESLint `no-restricted-imports` rule.
- Feature flags in `src/config/flags.ts` decide what the UI shows; registries decide which implementation runs. All flags start `false`: `cardPayments`, `athPayments`, `splitBill`, `sharedTab`, `pinSwitch`, `offlineMode`, `networkPrinting`, `aiImport`, `fiscalProcessor`, `smsReceipts`.
- `CONNECTORS.md` documents every connector:
  - its interface;
  - the implementation in use now;
  - what the real implementation must do;
  - the tests it must pass before its flag is turned on.

### Interfaces

```ts
// src/connectors/shared.ts
export type Cents = number; // always an integer
export type Locale = "es" | "en";
export type Role = "owner" | "manager" | "server" | "kitchen";
export interface Ctx {
  restaurantId: string;
  actorUserId?: string;
  locale: Locale;
}
export class ConnectorNotImplementedError extends Error {
  constructor(
    public connector: string,
    public implementation: string,
  ) {
    super(`${connector}:${implementation} is not implemented yet`);
  }
}

// payments: MEZZA_PAYMENTS_CARD, MEZZA_PAYMENTS_ATH; cash is always the 'cash' provider
export type PaymentMethod = "card" | "ath" | "cash";
export type ProviderStatus = "not_connected" | "pending" | "connected" | "unavailable";
export interface CreatePaymentInput {
  tabId: string;
  participantId?: string;
  idempotencyKey: string;
  amountCents: Cents;
  tipCents: Cents;
  ivuStateCents: Cents;
  ivuMunicipalCents: Cents;
  returnUrl: string;
}
export type PaymentNext =
  | { kind: "done" }
  | { kind: "staff_confirmation" } // cash
  | { kind: "client_secret"; secret: string } // card form (future)
  | { kind: "external_app"; reference: string }; // ATH Móvil (future)
export interface PaymentProvider {
  method: PaymentMethod;
  status(ctx: Ctx): Promise<ProviderStatus>;
  startOnboarding?(ctx: Ctx, returnUrl: string): Promise<{ url: string }>;
  createPayment(ctx: Ctx, input: CreatePaymentInput): Promise<{ paymentId: string; next: PaymentNext }>;
  confirm?(ctx: Ctx, paymentId: string): Promise<void>;
  refund(ctx: Ctx, paymentId: string, amountCents: Cents, reason: string): Promise<{ refundId: string }>;
  handleWebhook?(rawBody: string, headers: Headers): Promise<{ eventId: string; handled: boolean }>;
}

// fiscal: MEZZA_FISCAL
export interface FiscalProvider {
  mode: "sit_beside" | "processor";
  recordSale(
    ctx: Ctx,
    tabId: string,
  ): Promise<{
    controlNumber: string | null;
    requiresPosEntry: boolean;
    posTotalCents: Cents;
  }>;
}

// menu import: MEZZA_MENU_IMPORTER
export interface ImportedItem {
  sectionKey: string;
  nameEs: string;
  nameEn: string;
  descriptionEs?: string;
  descriptionEn?: string;
  priceCents: Cents | null;
  confidence: number; // 0–1; below 0.8 (or null price) must be confirmed in review
  modifierGroupKeys: string[];
  hotspot?: { page: number; x: number; y: number; width: number; height: number };
}
export interface MenuImportResult {
  sections: { key: string; nameEs: string; nameEn: string }[];
  items: ImportedItem[];
  modifierGroups: {
    key: string;
    nameEs: string;
    nameEn: string;
    min: number;
    max: number;
    options: { nameEs: string; nameEn: string; priceCents: Cents }[];
  }[];
  theme: {
    palette: { ink: string; paper: string; accent: string; muted: string };
    displayFont: string;
    bodyFont: string; // only from src/config/menu-fonts.ts
    ornament?: string;
    paperTexture: "none" | "linen" | "kraft" | "parchment";
  };
  pages: { storagePath: string; width: number; height: number }[];
  warnings: string[];
}
export interface MenuImporter {
  start(ctx: Ctx, upload: { storagePath: string; mimeType: string }): Promise<{ uploadId: string }>;
  result(
    ctx: Ctx,
    uploadId: string,
  ): Promise<
    | { status: "processing" }
    | { status: "review"; result: MenuImportResult }
    | { status: "failed"; error: string }
  >;
}

// printing: MEZZA_PRINTER
export interface Ticket {
  kind: "kitchen" | "receipt";
  restaurantName: string;
  tableLabel: string;
  orderNumber: number;
  createdAt: string;
  locale: Locale;
  lines: { qty: number; name: string; modifiers: string[]; note?: string }[];
  totals?: {
    subtotalCents: Cents;
    ivuStateCents: Cents;
    ivuMunicipalCents: Cents;
    tipCents: Cents;
    totalCents: Cents;
  };
  footer?: string; // in fiscal path A, receipts state they are payment receipts, not fiscal receipts
}
export interface PrinterDriver {
  protocol: "browser" | "epson_epos" | "star_webprnt";
  print(
    printer: { id: string; ipAddress?: string; widthChars: number },
    ticket: Ticket,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

// orders: MEZZA_ORDER_QUEUE
export interface OrderDraft {
  clientOrderId: string; // UUID made on the device; it is the idempotency key
  tableId: string;
  source: "qr" | "staff";
  guestLanguage: Locale;
  lines: {
    itemId: string;
    qty: number;
    modifierOptionIds: string[];
    note?: string;
    participantId?: string;
    shared?: boolean;
  }[];
}
export type SubmitResult =
  | { status: "accepted"; orderId: string; number: number }
  | { status: "queued" }
  | {
      status: "rejected";
      reason: "item_unavailable" | "tab_closed" | "invalid_table" | "validation";
      detail?: string;
    };
export interface OrderQueue {
  submit(draft: OrderDraft): Promise<SubmitResult>;
  pending(): number;
  flush(): Promise<void>;
}

// live updates: MEZZA_REALTIME
export type MezzaEventType =
  | "order.created"
  | "order.updated"
  | "service_request.created"
  | "service_request.updated"
  | "payment.updated"
  | "item.availability";
export interface MezzaEvent {
  type: MezzaEventType;
  restaurantId: string;
  entityId: string;
  at: string;
}
export interface RealtimeChannel {
  subscribe(
    scope: { restaurantId: string; tabId?: string },
    types: MezzaEventType[],
    onEvent: (e: MezzaEvent) => void,
  ): () => void; // returns unsubscribe
}

// staff identity: MEZZA_STAFF_SESSION
export interface StaffSession {
  current(): Promise<{ userId: string; restaurantId: string; role: Role } | null>;
  switchWithPin?(deviceId: string, pin: string): Promise<{ userId: string; role: Role }>;
  setPin?(ctx: Ctx, userId: string, pin: string): Promise<void>;
}

// tabs and splitting: 'one' is real now; 'even' and 'items' throw ConnectorNotImplementedError
export type SplitMode = "one" | "even" | "items";
export interface SplitPart {
  participantId: string | null;
  subtotalCents: Cents;
  ivuStateCents: Cents;
  ivuMunicipalCents: Cents;
}
export interface TabSplitter {
  // contract: parts always sum exactly to the tab's subtotal and IVU totals
  split(
    tab: { lines: { participantId: string | null; shared: boolean; lineTotalCents: Cents }[] },
    rates: { stateBps: number; municipalBps: number },
    mode: SplitMode,
    count?: number,
  ): SplitPart[];
}

// notifications: MEZZA_NOTIFIER (SMS is always a stub in this pass)
export interface Notifier {
  email(
    to: string,
    template: "staff_invite" | "demo_request" | "receipt",
    locale: Locale,
    data: Record<string, unknown>,
  ): Promise<void>;
  sms?(
    toE164: string,
    template: "receipt" | "loyalty",
    locale: Locale,
    data: Record<string, unknown>,
  ): Promise<void>;
}

// Stratum billing: MEZZA_BILLING
export interface BillingProvider {
  current(ctx: Ctx): Promise<{
    plan: string;
    status: "trial" | "active" | "past_due" | "cancelled";
    trialEndsAt: string | null;
  }>;
  startCheckout?(ctx: Ctx, planId: string): Promise<{ url: string }>;
}

// rate limiting: MEZZA_RATE_LIMIT
export interface RateLimiter {
  limit(key: string, max: number, windowSeconds: number): Promise<{ ok: boolean; retryAfter?: number }>;
}
```

### Implementations to build now

- **`cash` payment provider:**
  - `createPayment` inserts a pending cash payment and returns `staff_confirmation`.
  - `confirm` marks the payment paid, calls `FiscalProvider.recordSale`, then refreshes today's sales summary.
  - `refund` records the refund and an audit entry.
- **`mock` card and ATH providers:** succeed after about 1.5 s with `provider_ref` = `mock_…`. Active only in demo mode.
- **`sit_beside` fiscal provider:** returns `requiresPosEntry: true` and the total to enter. The server view keeps showing it until someone taps "Cerrado en el POS", which sets `tabs.pos_closed_at`.
- **`fixture` menu importer:** after a short delay, returns Café Lucía's menu as a `MenuImportResult`. Two prices come back at confidence 0.6 and one item has a null price, so the review checks get exercised.
- **`browser` printer:** puts the ticket into a print-only layout and calls `window.print()`. Ticket text always comes from one pure function, `renderTicketText(ticket, widthChars)`, which the future network drivers will reuse. Unit-test it.
- **`online` order queue:** calls the `place_order` server action. It creates `clientOrderId` before the first attempt and reuses it on every retry.
- **`polling` realtime:**
  - polls `/api/events?since=` every 4 s while the page is visible, and backs off when it's hidden;
  - the route derives events from `updated_at` on orders, service requests, payments and menu items, scoped by the caller's role.
- **`personal_account` staff session:** everyone signs in with their own account.
- **`TabSplitter`:**
  - implement `one`;
  - write the property test for the sum contract now, marked `.todo` for the modes that aren't built.
- **`console` notifier:** logs the message. Locally, Supabase's mail catcher receives auth emails.
- **`trial_only` billing:** reads `restaurants.trial_ends_at`.
- **`noop` rate limiter:** the call sites are already in place on guest actions (place order, call server, bring check).
- **Every other implementation named in the env block:** a stub.

---

## 8. Screens

### Website (`/es`, `/en`)

There's a language toggle on every page, and `/` redirects by Accept-Language.

**Home**, top to bottom:

1. The headline "Tu menú, tu estilo. Ahora se ordena y se paga solo.", next to a phone showing Café Lucía's house-style menu. Two buttons: "Empieza tu prueba gratis" and "Reserva una instalación guiada".
2. Three steps: sube tu menú, imprime tus QR, tus clientes ordenan y pagan desde la mesa.
3. The signature moment: the printed Café Lucía menu becoming the interactive house-style menu. Use one orchestrated transition; with reduced motion, show the two side by side.
4. Built for Puerto Rico: ATH Móvil, IVU on every receipt, Spanish and English, keeps working through outages.
5. Split the bill your way.
6. For owners: today's sales, best sellers, the IVU summary for SURI.
7. Pricing summary and the guided setup offer.
8. Pilot restaurant quotes. Keep this section hidden until real quotes exist.
9. FAQ: hardware needed, fees, fiscal terminal, cancellation.

**Other pages**

- **Precios / Pricing:** renders `src/config/pricing.ts`.
  - The config holds all four models:
    - A: $29/month + 0.5% of card payments;
    - B: Básico $49, Pro $99, Plus $179;
    - C: 1% of card and ATH payments;
    - D: $49/month + 0.25% of card payments.
  - Set `activeModel: 'A'` and a placeholder guided setup price of $299.
  - Include a fee FAQ.
- **Demo:**
  - the live Café Lucía guest menu in demo mode, where orders never reach a real kitchen and payments use the mocks;
  - a QR that opens the demo on a phone;
  - the demo request form, which saves to `demo_requests` and sends a notification through `Notifier`.
- **Cómo funciona / How it works:** import the menu, print the QR codes, guests order and pay, close.
- **Account pages:** signup, login, magic link, and password reset.
- **Legal:** terms, privacy and data processing. Mark each one "Borrador: requiere revisión legal" in both languages.

### Onboarding wizard (`/app/[restaurant]/empezar`)

The wizard can be resumed; `restaurants.onboarding_step` tracks progress.

1. **Account:** email, restaurant name and phone. Calls `create_restaurant_with_owner` and starts a 30-day trial with no card.
2. **Menu:** upload a PDF or photo. The `MenuImporter` runs while the owner continues; review happens on the menu import screen.
3. **Tables:** count and labels, then a QR preset.
4. **Payments:** provider cards from the payment registry. This step is skippable. When no card or ATH provider is connected, guests see "Paga con tu mesero".
5. **Staff:** invite by email, with a role.
6. **Print:** download the QR PDF and go live.

### Owner app (`/app/[restaurant]/…`)

Navigation is gated by role.

**Inicio**

- Today's sales against the same day last week.
- Payments by method.
- IVU, state and municipal.
- Open tables.
- Alerts: open service requests, cash to collect, pending POS closes, and printer failures.

**Menú**

- Sections: drag to reorder, keyboard accessible.
- Items:
  - bilingual name and description;
  - price entered in dollars and stored in cents;
  - photo upload;
  - an availability toggle that also writes `item_availability_events`.
- Modifier groups with min/max and options, assignable to items.
- A live preview pane renders the guest menu in all three styles.
- Price changes write to `audit_log`.

**Importar menú**

- An upload step, followed by the review screen:
  - the source page sits beside the extracted items;
  - low-confidence and missing prices are highlighted, and each one must be confirmed;
  - hotspots are drawn on the page and can be dragged and resized;
  - a preview shows the extracted theme.
- "Publicar menú" stays disabled until every flagged price is confirmed. Publishing calls `publish_menu_import`.

**Códigos QR** (port the prototype's QR studio)

- Design controls:
  - presets: De la casa, Vino y oro, Minimal;
  - colors for code, background, frame and frame text;
  - dot style: square, rounded, dots;
  - corner style: square, rounded, circle;
  - center logo: none, monogram, or an uploaded logo;
  - frame message in Spanish and English;
  - font: the menu's or a modern one.
- Safety checks:
  - a contrast check;
  - a warning when the code is lighter than its background;
  - error correction level H whenever a logo is used;
  - a reminder to test-scan with a few phones.
- Per-table "Cambiar código" (rotation), with a confirmation step.
- PDF downloads in three formats, for all tables or a selection:
  - a letter-size sheet of cards to cut;
  - 4×6 in folded table tents, with the back panel printed upside down so it reads correctly once folded;
  - 3×3 in stickers.
- Each card shows the restaurant name and `NEXT_PUBLIC_GUEST_DISPLAY_HOST`.

**Reportes**

The ten MVP metrics from the plan:

1. Sales heat map by hour × weekday.
2. Daily sales vs. the same day last week.
3. Covers and average check, per table and per guest.
4. Payment mix and average tip %.
5. IVU collected by month, state and municipal.
6. Best and worst sellers, by units and by revenue.
7. Add-on and modifier rate per dish.
8. Time sold out and estimated lost sales per dish. The estimate is the dish's average units per hour at that hour of the week, over the prior 4 weeks, multiplied by the hours sold out. Label it as an estimate.
9. QR adoption: the share of orders and payments from guest phones.
10. Menu language used, Spanish vs. English.

The page has a date range picker, and every chart has a plain table view for accessibility.

**Exportar**

- Monthly IVU summary, as PDF and CSV: taxable sales, state and municipal IVU, and refunds, by day and in total.
  - Title it "Resumen de IVU para preparar la planilla en SURI".
  - Never present it as an official form.
- Sales export, as CSV and Excel: orders, lines, payments, refunds and tips, with dates and staff.
- Store every export in `exports` so it can be downloaded again.

**Equipo**

- Invite staff (Supabase admin invite from server code), change roles, and deactivate members.
- The PIN section shows its coming-soon state.

**Ajustes**

- Restaurant profile: name, slug, timezone, default language, default menu style.
- IVU rates, shown as percentages and stored as basis points.
- Fiscal mode: sit-beside is selected; processor shows coming soon.
- Payments: card and ATH provider status, with onboarding buttons from the registry.
- Printers: add and edit name, model, IP, protocol, role and width. "Imprimir prueba" uses the active `PrinterDriver`.
- Support-access approvals.

**Plan**

- Trial days left and the active pricing model from config. Anything beyond that goes through `BillingProvider`.

### Guest (`/r/[restaurant]/t/[token]`)

**Table resolution**

- Resolve the table on the server by hashing the token and matching `qr_token_hash`.
- An invalid or rotated token shows a clear page saying the code is no longer valid and to ask the server.

**Menu**

- A navy header with the restaurant name, table label and the ES/EN switch. The language defaults to the restaurant's default and is remembered in a cookie.
- The menu opens in the restaurant's default style, with a style switch (De la casa / Original / Simple), as in the prototype:
  - section chips;
  - sold-out dishes marked "Agotado" and not orderable;
  - an item sheet with photo, description, modifier groups (enforcing min/max), quantity and note.

**Ordering**

- The cart lives on the device (localStorage).
- "Enviar a cocina" sends the cart through the `OrderQueue`. A double tap can never create two orders, because both taps share one `clientOrderId`.
- An order status view follows the order (new → in the kitchen → ready → served) via `RealtimeChannel`, with a "Pedir más" button.
- "Llamar al mesero" and "Pedir la cuenta" create service requests.

**Paying**

- The pay screen shows one check for the table:
  - subtotal;
  - a tip chooser (15 / 18 / 20% or custom), calculated on the pre-tax subtotal;
  - state and municipal IVU on separate lines;
  - total.
- Payment methods come from the registry:
  - cash always appears;
  - card and ATH appear only when connected, or mocked in demo mode;
  - when neither is available, the screen shows "Paga con tu mesero".
- The receipt page is labeled as a payment receipt: "Recibo de pago: tu recibo fiscal lo emite el comercio."

**Data access**

- Every guest read and write goes through a server action or route handler that re-resolves the token each time.
- No Supabase client ships in the guest bundle.

### Staff (`/app/[restaurant]/servicio`, `/mesas`, `/cocina`)

**Servicio** (servers)

- My tables.
- An alert list: call server, bring the check, cash to collect, order ready, close on POS.
- Take an order for a table with the same menu components (source `staff`).
- "Efectivo recibido" to confirm cash.
- Mark requests handled.
- "Cerrado en el POS", showing the amount to enter.

**Mesas**

- A grid of tables with status (free, open, paying, needs attention) and each open tab's total.

**Cocina** (kitchen)

- Columns: Nuevo, En cocina, Listo. Tap a ticket to advance it; served orders drop off.
- Each ticket shows its source (QR or mesero) and its elapsed time.
- A sound alert toggle, unlocked by a first tap per browser rules.
- An auto-print toggle and a reprint button, both via `PrinterDriver`. Each print writes to `print_jobs`.
- A sold-out toggle per dish.

**Devices, voids and refunds**

- Each staff browser registers a `devices` row on first load and keeps its id in localStorage. Every poll updates `last_seen_at`.
- Voids and cash refunds:
  - managers and owners only, checked by role on the server;
  - a reason is required;
  - each one is written to `audit_log`.

### Stratum admin (`/admin`, platform admins only)

- **Restaurants:** onboarding step, trial days left, plan, 30-day volume, and last order.
- **Health flags:** no orders in 3 days, failed payments, failed print jobs, and staff devices not seen in 24 hours.
- **Support access:**
  - request a time-limited grant;
  - it becomes active only after the owner approves it in Ajustes;
  - every grant is logged.

  Actual impersonation comes in a later pass.

- **Feature flags:** read-only.

---

## 9. Phases

1. **Foundation**
   - Scaffold, ESLint (including the restricted-imports rule), Prettier, Vitest and Playwright.
   - Design tokens, the Archivo font and the brand assets moved from `brand/` into `public/`, and UI primitives.
   - next-intl setup with the key-parity test.
   - Layouts for site, app, guest and admin.
   - `.env.example`.
2. **Database**
   - Supabase init and migrations: schema, enums, functions, RLS and storage.
   - Type generation.
   - The seed (SQL and the TypeScript script).
   - pgTAP tests.
3. **Auth and libraries**
   - Supabase clients and route protection.
   - Role-gated navigation.
   - Every connector's types, registry, dev implementations and stubs.
   - `lib/money`, `lib/tickets` and `lib/qr`, each with unit tests.
4. **Menu**
   - The shared menu renderers (all three styles).
   - The menu editor with preview, photo upload and availability events.
   - Import, review and publish.
5. **Website and onboarding**
   - All marketing pages, the demo and demo requests.
   - Signup and the onboarding wizard.
6. **QR studio**
   - The studio itself and code rotation.
   - The three PDF formats, stored in exports.
   - Decode tests.
7. **Ordering basics**
   - Guest page, cart, `place_order`, order status, service requests, pay screen and receipt.
   - Servicio, Mesas and Cocina.
   - Printing, voids and refunds, and device registration.
8. **Owner insights**
   - Inicio, Reportes and Exportar.
   - Summary refresh after payment confirmation, plus `/api/cron/refresh-sales` guarded by `CRON_SECRET`.
9. **Team, settings, plan and admin.**
10. **Verification and docs**
    - End-to-end smoke tests.
    - Screenshot review and fixes.
    - README, CONNECTORS.md and DECISIONS.md.
    - A final full test run.

---

## 10. Definition of done

**Setup**

- From a fresh clone, following only the README, `supabase start`, `pnpm seed` and `pnpm dev` produce a working app.

**Tests**

- Typecheck, lint, unit, database and end-to-end tests all pass.

**Playwright smoke tests cover:**

- the website in ES and EN, with no missing translation keys;
- an owner logs in and changes a price, and the guest menu shows the new price;
- a guest at Mesa 4 orders; the order appears in Cocina, is advanced to served, and the guest's status view updates;
- a guest asks for the check and picks cash, and the server confirms it. The POS-close item appears, and the sale shows up on Inicio and in that month's IVU export;
- tapping "Enviar a cocina" twice quickly creates exactly one order;
- the QR PDF downloads;
- a fixture menu import is reviewed, the flagged prices block publishing until confirmed, and publishing succeeds.

**QR decode test**

- Every preset × dot style × corner style × logo mode decodes to the correct table URL.
- This holds for the shared SVG renderer used by both the preview and the PDF.

**Money tests**

- IVU and tip math on edge cases: 0, 1 cent, odd cents, and large checks.
- Check totals always equal the sum of their lines.

**Screenshots**

- Every screen at 390 px and 1280 px, saved in `docs/screenshots/` and reviewed against the prototype.

**Docs**

- README, CONNECTORS.md and DECISIONS.md are complete.
- `.env.example` lists every variable.

---

## 11. Stop and ask only if

- Docker or the Supabase CLI isn't available on this machine.
- An installed library contradicts this file in a way that changes the architecture, not just the syntax.
- Two requirements here conflict, and resolving them would change how the product behaves for restaurants or guests.
