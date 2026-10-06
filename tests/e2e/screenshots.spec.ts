import { test, type Page } from "@playwright/test";
import { app, email, guestUrl, login } from "./helpers";

/**
 * Every screen at 390 px (project "phone") and 1280 px (project "desktop"), light and dark, saved to
 * docs/screenshots for review against reference/mezza-prototype.html. One sign-in per role.
 */
const SITE = ["/es", "/en", "/es/precios", "/es/como-funciona", "/es/demo", "/es/entrar", "/es/registro"];
const OWNER = [
  "",
  "/servicio",
  "/servicio/orden",
  "/mesas",
  "/cocina",
  "/menu",
  "/menu/importar",
  "/qr",
  "/reportes",
  "/exportar",
  "/equipo",
  "/ajustes",
  "/plan",
];

const name = (path: string) => path.replace(/^\//, "").replace(/\//g, "-") || "home";

async function shoot(page: Page, file: string) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `docs/screenshots/${file}`, fullPage: true });
}

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    });

    test(`website (${scheme})`, async ({ page }, info) => {
      for (const path of SITE) {
        await page.goto(path);
        await shoot(page, `site-${name(path)}.${info.project.name}.${scheme}.png`);
      }
    });

    test(`owner screens (${scheme})`, async ({ page }, info) => {
      test.setTimeout(300_000);
      await login(page, email("dueno"), `${app()}`);
      for (const path of OWNER) {
        await page.goto(`${app()}${path}`);
        await shoot(page, `app-${name(path)}.${info.project.name}.${scheme}.png`);
      }
      // Tablet (icon rail) from the desktop project.
      if (info.project.name === "desktop") {
        await page.setViewportSize({ width: 820, height: 1180 });
        for (const path of OWNER) {
          await page.goto(`${app()}${path}`);
          await shoot(page, `app-${name(path)}.tablet.${scheme}.png`);
        }
      }
    });

    test(`guest page (${scheme})`, async ({ page }, info) => {
      await page.goto(guestUrl(5));
      await shoot(page, `guest-menu.${info.project.name}.${scheme}.png`);
      await page.getByRole("button", { name: "Simple", exact: true }).click();
      await shoot(page, `guest-menu-simple.${info.project.name}.${scheme}.png`);
    });

    test(`Stratum admin (${scheme})`, async ({ page }, info) => {
      await login(page, "admin@stratum.example", "/admin");
      await shoot(page, `admin.${info.project.name}.${scheme}.png`);
    });
  });
}
