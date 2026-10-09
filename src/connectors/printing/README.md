# Printing connector

Contract and what network printing must do:
[CONNECTORS.md → printing](../../../CONNECTORS.md#printing). Only what is local is here.

## Files

- `types.ts`: `PrinterDriver`, `PrinterProtocol` (`browser`, `epson_epos`, `star_webprnt`), and
  `Ticket` re-exported from `lib/tickets`.
- `index.ts`: `printerDriver(protocol)`; the driver follows the printer row's protocol.
  `defaultPrinterProtocol()` reads `MEZZA_PRINTER` but nothing calls it yet.
- `browser.ts`: live. Prints `renderTicketText(ticket, widthChars)` through a hidden, print-only
  iframe; returns `{ ok: false }` outside a browser.
- `network-stubs.ts`: Epson and Star throw `ConnectorNotImplementedError`.

## Callers

- `components/staff/kitchen-board.tsx` and `components/staff/cash-dialog.tsx` (always `browser`),
  `components/settings/settings-forms.tsx` (test print with the printer's protocol).
- The kitchen board logs each attempt with `logPrintJob` (`lib/staff/actions.ts`), which writes
  `print_jobs` with the user's client.

## Tests

- E2E: `tests/e2e/kitchen-print` (reprint is logged). Ticket text has no unit test in this folder.
