import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("staff access", () => {
  // Sign-ins run one at a time: parallel logins against the dev server raced each other.
  test.describe.configure({ mode: "serial" });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "auth flow runs once"));

  test("signed-out visitors are sent to login and come back after", async ({ page }) => {
    await page.goto("/app/cafe-lucia/menu");
    await expect(page).toHaveURL(/\/es\/entrar\?next=%2Fapp%2Fcafe-lucia%2Fmenu/);
    await login(page, "dueno@cafelucia.example", "/app/cafe-lucia/menu");
    await expect(page).toHaveURL(/\/app\/cafe-lucia\/menu$/);
  });

  test("a wrong password says what happened", async ({ page }) => {
    await page.goto("/es/entrar");
    await page.waitForLoadState("networkidle");
    const form = page.locator("form").first();
    await form.getByLabel("Correo electrónico").fill("dueno@cafelucia.example");
    await form.getByLabel("Contraseña").fill("wrong-password");
    await form.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/no coinciden/)).toBeVisible();
  });

  test("the owner sees every section", async ({ page }) => {
    await login(page, "dueno@cafelucia.example");
    await expect(page).toHaveURL(/\/app\/cafe-lucia$/);
    const nav = page.getByRole("navigation", { name: "Navegación del restaurante" });
    await expect(nav.getByRole("link")).toHaveCount(12); // 11 sections + Tomar orden
    await page.screenshot({ path: "docs/screenshots/app-owner.desktop.light.png" });
  });

  test("the kitchen lands on Cocina and sees nothing else", async ({ page }) => {
    await login(page, "cocina@cafelucia.example");
    await expect(page).toHaveURL(/\/app\/cafe-lucia\/cocina$/);
    const nav = page.getByRole("navigation", { name: "Navegación del restaurante" });
    await expect(nav.getByRole("link")).toHaveText(["Cocina"]);
    await page.goto("/app/cafe-lucia/reportes");
    await expect(page).toHaveURL(/\/app\/cafe-lucia\/cocina$/);
  });

  test("the server lands on Servicio", async ({ page }) => {
    await login(page, "mesero@cafelucia.example");
    await expect(page).toHaveURL(/\/app\/cafe-lucia\/servicio$/);
  });

  test("another restaurant's owner gets a 404 for Café Lucía", async ({ page }) => {
    await login(page, "dueno@barratest.example");
    await expect(page).toHaveURL(/\/app\/barra-test$/);
    const response = await page.goto("/app/cafe-lucia");
    expect(response?.status()).toBe(404);
  });

  test("the Stratum admin is for platform admins only", async ({ page }) => {
    await login(page, "dueno@cafelucia.example", "/admin");
    await expect(page).toHaveURL(/\/admin$/);
    // The check runs in a root layout, so the 404 page arrives with a 200 status once streaming starts.
    await expect(page.getByText("could not be found")).toBeVisible();
    await expect(page.getByText("Restaurantes")).toHaveCount(0);
    await page.context().clearCookies();
    await login(page, "admin@stratum.example", "/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Restaurantes")).toBeVisible();
  });
});
