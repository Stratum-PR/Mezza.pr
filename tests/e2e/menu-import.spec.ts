import { expect, test } from "@playwright/test";

import { login } from "./helpers";

test("a fixture import is reviewed, flagged prices block publishing, and publishing succeeds", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "import flow runs once");
  test.setTimeout(90_000);

  await login(page, "gerente@cafelucia.example", "/app/cafe-lucia/menu/importar");
  await expect(page).toHaveURL(/\/menu\/importar$/);
  await page.waitForLoadState("networkidle");

  await page.getByLabel("Menú en PDF o foto").setInputFiles({
    name: "menu-cafe-lucia.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n% Mezza test menu\n%%EOF\n"),
  });
  await page.getByRole("button", { name: "Subir y leer menú" }).click();
  await expect(page).toHaveURL(/\/menu\/importar\/[0-9a-f-]{36}$/, { timeout: 30_000 });

  // The fixture importer takes a few seconds; the page refreshes itself.
  await expect(page.getByRole("heading", { name: "Revisa el menú importado" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("status").filter({ hasText: "Faltan confirmar 3 precios" })).toBeVisible();
  const publish = page.getByRole("button", { name: "Publicar menú" });
  await expect(publish).toBeDisabled();
  await page.screenshot({
    path: "docs/screenshots/app-menu-import-review.desktop.light.png",
    fullPage: true,
  });

  // Avena came back without a price.
  await page.getByLabel("Precio de Avena").fill("3.00");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Confirmar precio" }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Todo listo para publicar" })).toBeVisible();

  // Tap zones respond to the keyboard (Shift + arrow resizes).
  const zone = page.getByRole("button", { name: "Zona tocable de Malta" });
  await zone.focus();
  await page.keyboard.press("ArrowDown");

  await expect(publish).toBeEnabled();
  await publish.click();
  await expect(page).toHaveURL(/\/app\/cafe-lucia\/menu\?importado=1$/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Editar Avena" })).toBeVisible();
});
