# Fiscal connector

Contract and what a certified processor must do: [CONNECTORS.md → fiscal](../../../CONNECTORS.md#fiscal).
Only what is local is here.

## Files

- `types.ts`: `FiscalProvider` (`mode`, `recordSale(ctx, tabId)`).
- `index.ts`: `fiscal()`, from `MEZZA_FISCAL` (`sit_beside` default, `processor_stub`). Server-only.
- `sit-beside.ts`: live. Sums `amount + IVU` of the tab's paid and partially refunded payments
  (no tip) with the service-role client and returns `requiresPosEntry: true`, no control number.
- `processor-stub.ts`: throws `ConnectorNotImplementedError`.

## Callers

- Only `cashProvider.confirm` (`../payments/cash.ts`) after `confirm_cash_payment`. Its return value
  is not used there; the staff floor computes the POS total itself, and "Cerrado en el POS" goes
  through `closeOnPos` → RPC `close_tab_on_pos`.

## Data

- Reads `payments`. Writes nothing.

## Tests

- No unit test for this folder. Covered end to end by `tests/e2e/service-flow` (cash, then "Cerrado
  en el POS"); the tab close by `supabase/tests/15_tab_writes`, `21_one_tab_close`.
