# End-to-end tests: what each one checks and how long it takes

Measured 2026-10-06 on the local dev server, one worker: **80 tests, 9.7 minutes** of test time (10.0 minutes wall clock). All passed. 54 more are skipped on purpose (they run at only one of the two screen sizes).

**See them yourself:** `npx playwright show-report` opens the latest report in your browser: every test, its steps and timing, screenshots, and a full replay ("trace") for any failure. Run one file with `npx playwright test tests/e2e/checkout.spec.ts`, or watch it in a real browser with `--headed`.

**Where the time goes:** the screenshot review alone is **188.3 s (32%)**. The next biggest are the multi-device money flows (checkout, service flow, staff tools), which are the ones least worth cutting.

## Summary

| File                    | Tests | Time    | What it protects                                                                                                                                                                                 | Recommendation                                                                                                                                                                     |
| ----------------------- | ----- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `screenshots.spec.ts`   | 17    | 188.3 s | Photographs every screen (website, owner app, guest page, admin) at phone and desktop size, light and dark, into docs/screenshots for visual review. Checks almost nothing by itself.            | **Before releases only**. Run with `pnpm screenshots` before a release or after UI work, not on every run. Move its one real check (phone menu + language switch) to site.spec.ts. |
| `checkout.spec.ts`      | 2     | 57.3 s  | Guest split-bill checkout with up to three phones and a server: Mis platos, paying for someone else, staff confirming cash, receipts per payment, the even split, and the POS-close rule.        | Every run. Core money flow; keep.                                                                                                                                                  |
| `service-flow.spec.ts`  | 1     | 42.0 s  | The whole Pass 1 loop on one table: a phone orders, the kitchen moves it along, the guest pays cash, staff confirm, sales show up on Inicio and in the IVU summary, the table closes on the POS. | Every run. The single best end-to-end check; keep.                                                                                                                                 |
| `insights.spec.ts`      | 7     | 34.0 s  | Inicio, Reportes (the ten metrics and date ranges), Exportar files, servers locked out of reports, the cron secret.                                                                              | Every run. Keep. Inicio and Reportes run at both sizes only to take screenshots; the phone run could move to the screenshot review (saves ~10 s).                                  |
| `staff-tools.spec.ts`   | 1     | 33.2 s  | The phase 5 table view: move a dish, charge a person through Dividir cuenta, void a paid dish with a refund, write off, free the table, reports; checked at three sizes, light and dark.         | Every run. Core money flow; keep.                                                                                                                                                  |
| `staff-ui.spec.ts`      | 7     | 30.4 s  | Staff navigation at every size (sidebar, rail, drawer, bottom bar), Servicio's order strip, the floor plan editor, dish tags, theme and language.                                                | Every run. Guards the 'nav at every size' rule; keep.                                                                                                                              |
| `settings.spec.ts`      | 5     | 29.6 s  | Equipo (invite, deactivate), managers' limits, brand colour on the guest page, Plan, Stratum support access approval.                                                                            | Every run. Keep.                                                                                                                                                                   |
| `auth.spec.ts`          | 7     | 24.2 s  | Sign-in redirects, wrong-password message, each role lands where it should, another restaurant's owner gets a 404, admin is for platform admins only.                                            | Every run. Security; keep.                                                                                                                                                         |
| `qr-studio.spec.ts`     | 4     | 19.6 s  | QR PDF download, contrast warning, rotating a table's code, the owner's logo in the PDF.                                                                                                         | Every run. Keep (PDF generation breaks quietly otherwise).                                                                                                                         |
| `manager-tools.spec.ts` | 2     | 17.1 s  | Servicio voids and partial refunds by a manager; servers can't.                                                                                                                                  | Every run. Keep.                                                                                                                                                                   |
| `menu-editor.spec.ts`   | 3     | 15.6 s  | Price change shows in the preview and on the guest menu, sold out, a bad price explains the fix.                                                                                                 | Every run. Keep.                                                                                                                                                                   |
| `shared-tab.spec.ts`    | 1     | 15.5 s  | Phase 1: two phones become people at a table, a shared dish splits, staff order for one person, renaming rules.                                                                                  | Every run. Keep.                                                                                                                                                                   |
| `order-limits.spec.ts`  | 1     | 14.1 s  | Phase 2: owner lowers QR limits in Ajustes, a guest is refused, 'Mesa nueva por QR', 'Ampliar límite'.                                                                                           | Every run. Keep.                                                                                                                                                                   |
| `guest.spec.ts`         | 4     | 11.4 s  | A guest orders and sees status, a double tap makes one order, call the server, pay cash, a rotated QR code shows a clear page.                                                                   | Every run. Keep.                                                                                                                                                                   |
| `guest-polish.spec.ts`  | 3     | 11.2 s  | Quick add and cart quantities, section chips follow the scroll, an old receipt doesn't come back, an old QR link still works.                                                                    | Every run. Keep.                                                                                                                                                                   |
| `menu-import.spec.ts`   | 1     | 9.5 s   | The fixture menu import: review, flagged prices block publishing, publish.                                                                                                                       | Every run. Keep (uses demo mocks; needs a real image under a production build).                                                                                                    |
| `site.spec.ts`          | 6     | 8.6 s   | Marketing site: demo request saved and validated, demo QR, legal drafts marked, pricing example, hero headline spacing.                                                                          | Every run. Keep. Its demo requests count against the real 5-per-hour limit; give test runs their own IP (see below).                                                               |
| `menu.spec.ts`          | 6     | 8.4 s   | The website's menu demo: three styles, sold-out dishes, modifiers price correctly.                                                                                                               | Every run. Keep.                                                                                                                                                                   |
| `signup.spec.ts`        | 1     | 6.2 s   | A new owner signs up and walks the six-step wizard.                                                                                                                                              | Every run. Keep (uses demo mocks; needs a real image under a production build).                                                                                                    |
| `kitchen-print.spec.ts` | 1     | 4.0 s   | The kitchen reprints a ticket and the print is logged.                                                                                                                                           | Every run. Keep.                                                                                                                                                                   |

## Every test

### `screenshots.spec.ts`

| Test                                                     | Size    | Time   |
| -------------------------------------------------------- | ------- | ------ |
| owner screens (dark)                                     | desktop | 39.6 s |
| owner screens (light)                                    | desktop | 38.9 s |
| owner screens (light)                                    | phone   | 25.3 s |
| owner screens (dark)                                     | phone   | 20.6 s |
| website (dark)                                           | desktop | 12.9 s |
| website (light)                                          | phone   | 9.9 s  |
| website (light)                                          | desktop | 9.8 s  |
| website (dark)                                           | phone   | 7.9 s  |
| Stratum admin (light)                                    | phone   | 3.9 s  |
| Stratum admin (dark)                                     | phone   | 3.6 s  |
| Stratum admin (dark)                                     | desktop | 3.4 s  |
| Stratum admin (light)                                    | desktop | 3.3 s  |
| guest page (light)                                       | phone   | 2.0 s  |
| guest page (dark)                                        | desktop | 1.9 s  |
| guest page (light)                                       | desktop | 1.9 s  |
| guest page (dark)                                        | phone   | 1.8 s  |
| mobile menu opens and the language switch keeps the page | phone   | 1.5 s  |

### `checkout.spec.ts`

| Test                                                                                         | Size  | Time   |
| -------------------------------------------------------------------------------------------- | ----- | ------ |
| mine, someone else's, staff confirm each payment, and the table closes only when all is paid | phone | 31.8 s |
| an even split: one phone splits in two, each pays a share                                    | phone | 25.5 s |

### `service-flow.spec.ts`

| Test                                                                                      | Size    | Time   |
| ----------------------------------------------------------------------------------------- | ------- | ------ |
| Mesa 4 orders, the kitchen serves it, the guest pays cash and the table closes on the POS | desktop | 42.0 s |

### `insights.spec.ts`

| Test                                                                   | Size    | Time  |
| ---------------------------------------------------------------------- | ------- | ----- |
| Exportar builds the IVU summary and sales files and keeps them         | desktop | 7.4 s |
| Reportes has the ten metrics, each with a table view, and a date range | phone   | 6.8 s |
| Reportes has the ten metrics, each with a table view, and a date range | desktop | 6.1 s |
| Inicio shows today against last week, payments, IVU and alerts         | phone   | 5.3 s |
| servers get neither reports nor exports                                | desktop | 4.8 s |
| Inicio shows today against last week, payments, IVU and alerts         | desktop | 3.4 s |
| the summary cron needs CRON_SECRET                                     | desktop | 0.3 s |

### `staff-tools.spec.ts`

| Test                                                               | Size  | Time   |
| ------------------------------------------------------------------ | ----- | ------ |
| move, charge a person, void with refund, write off, free the table | phone | 33.2 s |

### `staff-ui.spec.ts`

| Test                                                | Size    | Time  |
| --------------------------------------------------- | ------- | ----- |
| grouped side menu; theme and language in Ajustes    | desktop | 7.1 s |
| Mesas is a floor plan the owner can rearrange       | desktop | 5.0 s |
| phone: drawer menu and a bottom bar of main screens | desktop | 4.5 s |
| Servicio shows today's orders by status             | desktop | 4.2 s |
| tablet: icon rail, no top tab bar                   | desktop | 3.8 s |
| the sidebar never scrolls sideways                  | desktop | 3.8 s |
| dish tags show on the guest menu                    | desktop | 1.9 s |

### `settings.spec.ts`

| Test                                                      | Size    | Time  |
| --------------------------------------------------------- | ------- | ----- |
| Stratum requests support access and the owner approves it | desktop | 9.7 s |
| the brand colour shows on the guest page                  | desktop | 6.5 s |
| the owner invites a server, then deactivates them         | desktop | 6.0 s |
| a manager can't add managers or edit the restaurant       | desktop | 4.2 s |
| Plan shows the trial and the active pricing               | desktop | 3.2 s |

### `auth.spec.ts`

| Test                                                      | Size    | Time  |
| --------------------------------------------------------- | ------- | ----- |
| the Stratum admin is for platform admins only             | desktop | 5.9 s |
| the kitchen lands on Cocina and sees nothing else         | desktop | 4.0 s |
| signed-out visitors are sent to login and come back after | desktop | 3.5 s |
| the server lands on Servicio                              | desktop | 3.4 s |
| the owner sees every section                              | desktop | 3.2 s |
| another restaurant's owner gets a 404 for Café Lucía      | desktop | 3.0 s |
| a wrong password says what happened                       | desktop | 1.3 s |

### `qr-studio.spec.ts`

| Test                                                                 | Size    | Time  |
| -------------------------------------------------------------------- | ------- | ----- |
| the QR PDF downloads                                                 | desktop | 6.9 s |
| an owner's own logo replaces the initials in the preview and the PDF | desktop | 6.6 s |
| changing a table's code needs confirmation and bumps its version     | desktop | 3.3 s |
| a light code on a dark background is flagged                         | desktop | 2.9 s |

### `manager-tools.spec.ts`

| Test                                                                                | Size    | Time  |
| ----------------------------------------------------------------------------------- | ------- | ----- |
| a manager takes an order, voids a line with a reason, and refunds part of a payment | desktop | 9.9 s |
| servers can't void or refund                                                        | desktop | 7.2 s |

### `menu-editor.spec.ts`

| Test                                                             | Size    | Time  |
| ---------------------------------------------------------------- | ------- | ----- |
| a manager changes a price and the preview and guest menu show it | desktop | 7.6 s |
| marking a dish sold out shows it in the preview                  | desktop | 4.8 s |
| a bad price says how to fix it                                   | desktop | 3.1 s |

### `shared-tab.spec.ts`

| Test                                                                  | Size  | Time   |
| --------------------------------------------------------------------- | ----- | ------ |
| two phones, a shared dish, a staff order for one person, and renaming | phone | 15.5 s |

### `order-limits.spec.ts`

| Test                                                                                    | Size  | Time   |
| --------------------------------------------------------------------------------------- | ----- | ------ |
| owner sets limits; a guest is held to them; staff see the new table and raise its limit | phone | 14.1 s |

### `guest.spec.ts`

| Test                                                    | Size  | Time  |
| ------------------------------------------------------- | ----- | ----- |
| tapping Enviar a cocina twice creates one order         | phone | 3.8 s |
| calls the server, then asks for the check and pays cash | phone | 3.7 s |
| orders from Mesa 7 and sees the status                  | phone | 2.8 s |
| a rotated or made-up code shows a clear page            | phone | 1.1 s |

### `guest-polish.spec.ts`

| Test                                                                | Size  | Time  |
| ------------------------------------------------------------------- | ----- | ----- |
| quick add, cart quantities and section chips that follow the scroll | phone | 7.5 s |
| a receipt from an earlier visit doesn't come back                   | phone | 2.6 s |
| a code printed under an old restaurant link still opens the table   | phone | 1.1 s |

### `menu-import.spec.ts`

| Test                                                                                   | Size    | Time  |
| -------------------------------------------------------------------------------------- | ------- | ----- |
| a fixture import is reviewed, flagged prices block publishing, and publishing succeeds | desktop | 9.5 s |

### `site.spec.ts`

| Test                                                         | Size    | Time  |
| ------------------------------------------------------------ | ------- | ----- |
| the hero headline keeps the space between its animated words | phone   | 3.1 s |
| a demo request is saved and acknowledged                     | desktop | 1.5 s |
| a demo request without an email explains the fix             | desktop | 1.4 s |
| legal drafts are marked for review in both languages         | desktop | 1.0 s |
| the demo QR code is on the page                              | desktop | 0.8 s |
| pricing shows the active model and a worked fee example      | desktop | 0.8 s |

### `menu.spec.ts`

| Test                                                         | Size    | Time  |
| ------------------------------------------------------------ | ------- | ----- |
| shows the three styles                                       | desktop | 2.1 s |
| shows the three styles                                       | phone   | 1.7 s |
| a dish with modifiers goes into the order at the right price | phone   | 1.5 s |
| a dish with modifiers goes into the order at the right price | desktop | 1.2 s |
| sold-out dishes can't be ordered                             | phone   | 1.0 s |
| sold-out dishes can't be ordered                             | desktop | 0.9 s |

### `signup.spec.ts`

| Test                                                       | Size    | Time  |
| ---------------------------------------------------------- | ------- | ----- |
| a new owner signs up and walks through the six-step wizard | desktop | 6.2 s |

### `kitchen-print.spec.ts`

| Test                                                  | Size    | Time  |
| ----------------------------------------------------- | ------- | ----- |
| the kitchen reprints a ticket and the print is logged | desktop | 4.0 s |

## Making the suite faster (phase 6, done)

Result: **10.0 → 1.7 minutes** for the full suite (`pnpm test:e2e:prod`: production build, 4 workers), with the screenshot review on demand.

1. **Screenshot review out of the default run** (−188.3 s): `pnpm screenshots` before releases.
2. **Production build for full runs**: faster pages and the same build Vercel runs. Demo mocks are off in production builds, so the menu-import and signup tests upload a real small image instead of a fake PDF.
3. **Parallel workers**: one copy of Café Lucía per worker (own logins, tables, menu and history), so tests stop sharing settings, sales totals and rate limits. Each worker also sends its own test IP, so the per-IP limits (demo requests 5 an hour, orders 30 a minute) don't trip across runs.
