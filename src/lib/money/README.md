# Money (`src/lib/money`)

## What it does

Integer-cent arithmetic for Puerto Rico checks: IVU (state and municipal), even splits, tips, parsing
typed dollar amounts and formatting cents. Pure and client-safe.

## Entry points

`index.ts` exports `computeIvu`, `ivuForPart`, `distributeCents`, `tipFromPercent`, `checkTotals`,
`dollarsToCents`, `formatCents`, `formatPlain` and the `Cents` and `IvuRates` types (`types.ts` holds
`Cents` alone, for `config/pricing.ts`).

- IVU: `lib/guest/status.ts`, `lib/staff/floor.ts`, the splitter connector, and previews in
  `components/guest/guest-app.tsx` and `components/staff/take-order.tsx`.
- `dollarsToCents`: refunds (`lib/staff/actions.ts`), the menu editor
  (`app/app/[restaurant]/menu/actions.ts`), the import review screen and the guest's custom tip.
- `formatCents` / `formatPlain`: display only, across guest, staff, reports and marketing pages.

## Data

None. The database mirrors these rules: `create_tab_payment` computes every real payment (IVU by
cumulative difference through `ivu_cents`), and it is the authority.

## Rules

- Money is a non-negative safe integer of cents; helpers throw `RangeError` otherwise.
- IVU components are rounded half-up to the cent separately (`applyBps`). The rounding rule awaits
  CPA confirmation (see `DECISIONS.md`).
- `ivuForPart` = IVU(paid before + part) − IVU(paid before), so parts add up to the one-check IVU.
- Tips are a percent of the pre-tax subtotal and are not taxed.
- Amounts computed in the browser are previews; the server computes what is charged.

## Tests

- Unit: [`money.test.ts`](money.test.ts); the splitter property test
  (`src/connectors/splitter/splitter.test.ts`) uses these helpers.
- Database: `supabase/tests/09_split_engine`, `10_guest_checkout` (server-side IVU).
