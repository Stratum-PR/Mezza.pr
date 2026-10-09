# Splitter connector

Contract (parts always sum to the tab's subtotal and IVU) and its flags:
[CONNECTORS.md → splitter](../../../CONNECTORS.md#splitter). Only what is local is here.

## Files

- `types.ts`: `TabSplitter.split(tab, rates, mode, count?)`, `SplitLine`, `SplitPart`; modes `one`,
  `even`, `items`.
- `index.ts`: `tabSplitter()`, always `standardSplitter`; no env var. Usable on server and client.
- `standard.ts`: `one` (one check), `even` (2–20 parts, leftover cents to the first parts), `items`
  (own lines plus locked shares by person; the table's lines last with `participantId: null`). IVU per
  part by cumulative difference (`ivuForPart` from `lib/money`).

## Callers

- None outside its test today. Real payments are computed in the database by `create_tab_payment`
  (SECURITY DEFINER, `service_role` only) with the same rules; checkout screens show
  `tab_checkout`'s numbers and `lib/guest/group-check.ts`.

## Data

- None.

## Tests

- Unit: [`splitter.test.ts`](splitter.test.ts) (property tests for every mode, the `items` order, the
  2–20 range).
- The database rules it mirrors: `supabase/tests/09_split_engine`, `10_guest_checkout`.
