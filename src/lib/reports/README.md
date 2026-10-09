# Reports (`src/lib/reports`)

## What it does

The owner's numbers: Inicio (today against the same weekday last week, plus alerts), Reportes (ten
metrics over a date range), and the sales summaries both read from. Dates and hours are in the
restaurant's local time zone.

## Entry points

- `today.ts`: `loadToday(db, restaurant)` for Inicio, `app/app/[restaurant]/page.tsx`.
- `summary.ts`: `shapeReport` turns `report_summary`'s raw rows into the Reportes metrics (pure). Used
  by `app/app/[restaurant]/reportes/page.tsx`, which also calls `period_adjustments`.
- `range.ts`: `resolveRange` (presets or `from`/`to`, clamped to today and to 366 days).
- `refresh.ts`: `refreshRecentSales(restaurantId)` rebuilds the local yesterday and today. Called by
  the payments connector (cash confirm, refunds, mock payments) and by the cron route
  `app/api/cron/refresh-sales/route.ts` (Bearer `CRON_SECRET`).
- `time.ts` and `format.ts`: local-date math and number/date labels, also used by `lib/exports` and
  `components/reports/*`.

## Data

- `loadToday` reads with the user's client: `payments`, `refunds`, `daily_sales`, `print_jobs`, plus
  `loadFloor` from `lib/staff`.
- RPCs:
  - `report_summary`: SECURITY INVOKER, `authenticated` and `service_role`; owners and managers only.
  - `period_adjustments`: SECURITY DEFINER, `authenticated` and `service_role`; checks owner/manager.
  - `refresh_sales_summaries`: SECURITY DEFINER, `service_role` only; writes `daily_sales` and
    `item_sales_daily` from `payments`, `orders`, `order_items`. Called only from `refresh.ts` with
    the service-role client.

## Rules

- Amounts are integer cents; formatting happens only at display (`format.ts`, `@/lib/money`).
- Today's figures come live from `payments`; earlier days come from the summaries.
- Range and day boundaries use the restaurant's `timezone`, never the server's.

## Tests

- Unit: [`summary.test.ts`](summary.test.ts), [`range.test.ts`](range.test.ts),
  [`time.test.ts`](time.test.ts).
- Database: `supabase/tests/03_reports`, `11_staff_tools` (`period_adjustments`).
- E2E: `tests/e2e/insights`.
