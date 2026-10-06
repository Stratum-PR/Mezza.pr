import { expect, test } from "@playwright/test";
import { Resvg } from "@resvg/resvg-js";
import { app, email, login, worker } from "./helpers";

test.describe("QR studio", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "studio flow runs once"));

  test("the QR PDF downloads", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, email("gerente"), `${app()}/qr`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("img", { name: "QR · Mesa 1" })).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/app-qr-studio.desktop.light.png", fullPage: true });

    for (const [title, size] of [
      ["Hoja para recortar", /\/MediaBox \[0 0 612 792\]/],
      ["Tarjeta doblada", /\/MediaBox \[0 0 288 432\]/],
    ] as const) {
      const download = page.waitForEvent("download");
      await page.getByRole("link", { name: new RegExp(title) }).click();
      const file = await download;
      expect(file.suggestedFilename()).toMatch(new RegExp(`^${worker().slug}-qr-(sheet|tent)\\.pdf$`));
      const body = (await (await file.createReadStream())!.toArray()).map((c) => Buffer.from(c));
      const pdf = Buffer.concat(body);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.toString("latin1")).toMatch(size);
    }
  });

  test("a light code on a dark background is flagged", async ({ page }) => {
    await login(page, email("gerente"), `${app()}/qr`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Minimal" }).click();
    await page.locator('input[type="color"]').first().fill("#ffffff"); // code
    await page.locator('input[type="color"]').nth(1).fill("#111111"); // background
    await expect(page.getByText("El código es más claro que su fondo")).toBeVisible();
  });

  test("changing a table's code needs confirmation and bumps its version", async ({ page }) => {
    await login(page, email("gerente"), `${app()}/qr`);
    await page.waitForLoadState("networkidle");
    const row = page.getByRole("listitem").filter({ hasText: "Mesa 12" });
    const before = Number((await row.getByText(/Versión \d+/).textContent())!.match(/\d+/)![0]);
    page.once("dialog", (d) => d.dismiss());
    await row.getByRole("button", { name: "Cambiar código" }).click();
    await expect(row.getByText(`Versión ${before}`)).toBeVisible();
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: "Cambiar código" }).click();
    await expect(page.getByText("Nuevo código para la Mesa 12")).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText(`Versión ${before + 1}`)).toBeVisible();
  });
  test("an owner's own logo replaces the initials in the preview and the PDF", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, email("dueno"), `${app()}/qr`);
    const preview = page.getByRole("img", { name: "QR · Mesa 1" });
    // Start from initials (an earlier run may have left a logo).
    await page.getByRole("radio", { name: "Iniciales" }).click();
    await expect(preview.locator("image")).toHaveCount(0);

    await page.getByRole("radio", { name: "Mi logo" }).click();
    // Either no logo yet (initials) or one from an earlier upload; uploading replaces it.
    await expect(page.getByText(/el código muestra tus iniciales|Tu logo está cargado/)).toBeVisible();
    const png = new Resvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#B08D57"/><circle cx="32" cy="32" r="16" fill="#F3E9D2"/></svg>',
      { fitTo: { mode: "width", value: 256 } },
    )
      .render()
      .asPng();
    await page
      .getByLabel(/Subir logo/)
      .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(png) });
    await expect(page.getByText("Logo subido.")).toBeVisible({ timeout: 20_000 });
    await expect(preview.locator("image")).toHaveCount(1);
    await expect(page.getByText("Tu logo está cargado")).toBeVisible();
    await page.screenshot({ path: "docs/screenshots/app-qr-logo.desktop.light.png" });

    await page.getByRole("button", { name: "Guardar diseño" }).click();
    await expect(page.getByText("Diseño guardado")).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: /Calcomanías/ }).click();
    const pdf = Buffer.concat(
      ((await (await (await download).createReadStream())!.toArray()) as Buffer[]).map((c) => Buffer.from(c)),
    );
    expect(pdf.toString("latin1")).toMatch(/\/Subtype\s*\/Image/); // the logo is embedded

    // Put the seed design back (initials).
    await page.getByRole("radio", { name: "Iniciales" }).click();
    await page.getByRole("button", { name: "Guardar diseño" }).click();
    await expect(page.getByText("Diseño guardado")).toBeVisible();
  });
});
