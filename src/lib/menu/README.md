# Menu (`src/lib/menu`)

## What it does

Loads a restaurant's live menu in the shape the guest menu and the editor use, and validates uploaded
menu photos (the "original menu" image a restaurant can publish as is).

## Entry points

- `load.ts`: `loadMenu(db, restaurantId)`. Called by the guest page
  `app/r/[restaurant]/t/[token]/page.tsx` (service-role client, after the QR token is resolved) and by
  the `menu`, `servicio` and `servicio/orden` pages under `app/app/[restaurant]/` (user client).
- `image.ts`: `menuImageSize(bytes, mimeType)`. Called by `startImport`
  (`app/app/[restaurant]/menu/importar/actions.ts`) and `wizardUploadMenu`
  (`app/app/[restaurant]/empezar/actions.ts`).
- `original.ts`: `readOriginalUpload(db, restaurantId, uploadId)`. Called by `publishOriginalImage` and
  the review page `menu/importar/[upload]/page.tsx`.

Menu editing actions (`saveSection`, `saveItem`, `setAvailability`, `uploadPhoto`, `saveGroup`, ...)
live in `app/app/[restaurant]/menu/actions.ts`; import and publish in `menu/importar/actions.ts`.

## Data

- `loadMenu` reads `restaurants` (with `qr_designs`), `menu_themes`, `menu_sections`, `menu_items`,
  `modifier_groups`, `modifier_options`, `item_modifier_groups`, `original_menu_pages`,
  `item_hotspots`, and signs Storage URLs in the `photos` and `menus` buckets (1 hour). Archived
  sections and dishes are left out.
- `readOriginalUpload` reads `menu_uploads` and downloads the file from the `menus` bucket.
- RPCs used by the callers: `publish_original_menu_image` (SECURITY INVOKER, `service_role` only),
  `publish_menu_import` (SECURITY DEFINER, `service_role` only), `set_item_availability`
  (SECURITY DEFINER, `authenticated`; owner/manager/kitchen).

## Rules

- Only real JPEG or PNG images up to 15 MB, one page, decoded fully; the MIME type must match the
  content. EXIF rotation is applied to the reported size. No fixture is substituted for a bad upload.
- An original upload's path must start with `<restaurantId>/uploads/`.
- A `menus` signed URL that can't be created is an error, not a missing image.
- Prices are integer cents.

## Tests

- Unit: [`image.test.ts`](image.test.ts), [`load.test.ts`](load.test.ts).
- Database: `supabase/tests/06_original_image`, `02_place_order` (availability and prices at order
  time).
- E2E: `tests/e2e/menu`, `menu-editor`, `menu-import`, `signup` (wizard upload).
