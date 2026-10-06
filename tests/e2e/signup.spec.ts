import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("a new owner signs up and walks through the six-step wizard", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "signup flow runs once");
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);

  await page.goto("/es/registro");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Tu nombre").fill("Dueña de Prueba");
  await page.getByLabel("Correo electrónico").fill(`dueno-${stamp}@example.com`);
  await page.getByLabel("Contraseña").fill("prueba-segura-2026");
  await page.getByLabel("Nombre del restaurante").fill(`Fonda Prueba ${stamp}`);
  await page.getByLabel("Teléfono del restaurante").fill("787-555-0199");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Crear cuenta y empezar" }).click();

  // Step 2: menu upload (the importer keeps working in the background).
  await expect(page).toHaveURL(new RegExp(`/app/fonda-prueba-${stamp}/empezar`), { timeout: 30_000 });
  await expect(page.getByText(/días de prueba gratis/)).toBeVisible();
  // A real (tiny) image: PDFs only pass in demo mode, and production builds check the picture.
  await page.getByLabel("Imagen del menú").setInputFiles({
    name: "menu.png",
    mimeType: "image/png",
    buffer: await sharp({ create: { width: 60, height: 90, channels: 3, background: "#f3e9d2" } })
      .png()
      .toBuffer(),
  });
  await page.getByRole("button", { name: "Subir menú y continuar" }).click();

  // Step 3: tables and QR style.
  await expect(page.getByRole("heading", { name: "Tus mesas y el estilo de los QR" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("¿Cuántas mesas tienes?").fill("6");
  await page.getByText("Minimal").click();
  await page.getByRole("button", { name: "Crear mesas y continuar" }).click();

  // Step 4: payments: connecting card is a stub; guests pay with their server.
  await expect(page.getByRole("heading", { name: "Cómo te pagan" })).toBeVisible({ timeout: 20_000 });
  // Card and ATH are stubs ("coming soon") unless demo mode mocks them (then they show as connected).
  const connect = page.getByRole("button", { name: "Conectar" });
  if (await connect.count()) {
    await expect(page.getByText("Paga con tu mesero")).toBeVisible();
    await connect.first().click();
    await expect(
      page.getByText("Esta conexión estará disponible próximamente", { exact: false }),
    ).toBeVisible();
  } else {
    await expect(page.getByText("Conectado").first()).toBeVisible();
  }
  await page.getByRole("button", { name: "Continuar" }).click();

  // Step 5: invite a server.
  await expect(page.getByRole("heading", { name: "Invita a tu equipo" })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Correo electrónico").fill(`mesero-${stamp}@example.com`);
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(page.getByText(`Invitamos a mesero-${stamp}@example.com.`)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Terminé de invitar" }).click();

  // Step 6: print and go live.
  await expect(page.getByText(/códigos de tus 6 mesas/)).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "docs/screenshots/app-wizard.desktop.light.png", fullPage: true });
  await page.getByRole("button", { name: "Terminar y abrir el panel" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/fonda-prueba-${stamp}$`), { timeout: 20_000 });
});
