# Menu import connector

Contract and the tests required before AI import:
[CONNECTORS.md → menu import](../../../CONNECTORS.md#menu-import). Only what is local is here.

## Files

- `types.ts`: `MenuImporter` (`start`, `result`), `MenuImportResult`, `needsReview` (not imported
  yet; kept for the review step).
- `index.ts`: `menuImporter()`, from `MEZZA_MENU_IMPORTER` (`fixture` default, `claude_stub`).
  `fixture` runs only when `mocksAllowed()`; otherwise the registry returns `claude_stub`, so outside
  demo mode every import shows "coming soon". Server-only.
- `fixture.ts`: records the upload, then after ~2.5 s stores Café Lucía's printed page in the `menus`
  bucket and returns `fixture-result.ts`. Both methods also refuse to run without demo mode.
- `fixture-result.ts`: Café Lucía as an importer would return it (pure).
- `claude-stub.ts`: throws `ConnectorNotImplementedError`.

## Callers

- `startImport` (`app/app/[restaurant]/menu/importar/actions.ts`), the review page
  `menu/importar/[upload]/page.tsx`, and `wizardUploadMenu` (`app/app/[restaurant]/empezar/actions.ts`).
- Publishing goes through RPC `publish_menu_import` (SECURITY DEFINER, `service_role` only) from
  `publishImport`, not through this connector.

## Data

- `fixture` writes `menu_uploads` (insert, then `status: review` and `ai_result`) with the service
  role, scoped by `restaurant_id`.

## Tests

- Unit: [`production.test.ts`](production.test.ts) (no sample content in production, even with demo
  mode set), [`../shared.test.ts`](../shared.test.ts).
- E2E: `tests/e2e/menu-import`.
