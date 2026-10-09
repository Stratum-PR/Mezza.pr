# QR (`src/lib/qr`)

## What it does

Table QR codes: derives each table's token, renders styled QR codes (SVG) and prints them as PDF cards
(sheet, tent, sticker). The guest side resolves a scanned token with the hash helper here.

## Entry points

- `token.ts`: `deriveQrToken`, `hashQrToken`, `isTokenShape`, `tableUrl` (and `verifyQrToken`, used
  only in tests). Called by `rotateTableCode` (`app/app/[restaurant]/qr/actions.ts`), `wizardTables`
  (`app/app/[restaurant]/empezar/actions.ts`) and `lib/guest/resolve.ts`.
- `load.ts`: `loadQrStudio(db, restaurant)` for the QR studio page and the PDF route
  (`app/app/[restaurant]/qr/page.tsx`, `qr/pdf/route.ts`).
- `render.ts`: `renderQr`, `qrSafety` (contrast check), `qrSvgString`. Used by
  `components/qr/qr-studio.tsx`, `components/wizard/steps.tsx` and the demo page.
- `pdf.tsx`: `renderQrPdf`, for the PDF route. `card.ts`: the card design shared by preview and PDF.

## Data

- Reads `qr_designs` and `dining_tables` (`token_version`) with the user's client; signs the logo
  from the `photos` bucket.
- Callers write `dining_tables.qr_token_hash` and `token_version` (rotate), `qr_designs` (design,
  logo), and the PDF route stores the file in the `exports` bucket and an `exports` row.
- No RPCs.

## Rules

- `token = base64url(HMAC-SHA256(QR_TOKEN_SECRET, "<tableId>:<version>"))`. Only `sha256(token)` is
  stored; printable URLs are derived on the server and never stored.
- Bumping `token_version` stops the old printed code; changing `QR_TOKEN_SECRET` stops all of them.
- `QR_TOKEN_SECRET` is server-only (`lib/server-env.ts`) and at least 32 characters.

## Tests

- Unit: [`token.test.ts`](token.test.ts), [`render.test.ts`](render.test.ts) (decodes the SVG back to
  the URL), [`pdf.test.ts`](pdf.test.ts).
- E2E: `tests/e2e/qr-studio`, `guest-polish` (old restaurant link still opens the table).
