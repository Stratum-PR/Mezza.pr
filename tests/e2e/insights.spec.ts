import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { app, atApp, email, login } from "./helpers";

test.describe("owner insights", () => {
  test("Inicio shows today against last week, payments, IVU and alerts", async ({ page }, info) => {
    await login(page, email("dueno"), `${app()}`);
    await expect(page.getByRole("heading", { name: "Hoy", level: 1 })).toBeVisible();
    await expect(page.getByText("Ventas de hoy")).toBeVisible();
    await expect(page.getByText(/(más|menos) que el \w+ pasado a esta hora|Sin ventas el/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pagos por forma de pago" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "IVU de hoy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Atención" })).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/app-home.${info.project.name}.light.png`,
      fullPage: true,
    });
  });

  test("Reportes has the ten metrics, each with a table view, and a date range", async ({ page }, info) => {
    await login(page, email("gerente"), `${app()}/reportes`);
    await page.goto(`${app()}/reportes?range=90d`);
    const titles = [
      "Ventas por hora y día",
      "Ventas diarias vs. la semana anterior",
      "Comensales y promedio por mesa",
      "Formas de pago y propinas",
      "IVU cobrado por mes",
      "Más y menos vendidos",
      "Platos pedidos con extras",
      "Agotados y ventas perdidas (estimado)",
      "Uso del QR",
      "Idioma del menú",
    ];
    for (const title of titles) await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText(/· 90 días$/)).toBeVisible();
    await expect(page.getByText(/Es un estimado/)).toBeVisible();
    await page.screenshot({
      path: `docs/screenshots/app-reports.${info.project.name}.light.png`,
      fullPage: true,
    });

    // The payment mix as a plain table.
    const mix = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Formas de pago y propinas" }) });
    await mix.getByRole("button", { name: "Ver tabla" }).click();
    const table = mix.getByRole("table");
    await expect(table.getByRole("columnheader")).toHaveText([
      "Forma de pago",
      "Ventas",
      "Pagos",
      "Porcentaje",
      "Propina",
    ]);
    await expect(table.getByRole("row")).toHaveCount(4);
    await mix.getByRole("button", { name: "Ver gráfica" }).click();
    await expect(table).toBeHidden();

    // Presets and a custom range.
    await page.getByRole("link", { name: "7 días" }).click();
    await expect(page.getByText(/· 7 días$/)).toBeVisible();
    await page.getByLabel("Desde").fill("2026-09-01");
    await page.getByLabel("Hasta").fill("2026-09-30");
    await page.getByRole("button", { name: "Ver", exact: true }).click();
    await expect(page.getByText(/1 sept – .*30 sept · 30 días$/)).toBeVisible();
  });

  test("Exportar builds the IVU summary and sales files and keeps them", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one run is enough");
    await login(page, email("dueno"), `${app()}/exportar`);
    await expect(page.getByText("No es un formulario oficial").first()).toBeVisible();

    const ivu = await page.request.get(`${app()}/exportar/descargar?kind=ivu_monthly_csv&month=2026-09`);
    expect(ivu.status()).toBe(200);
    const csv = await ivu.text();
    expect(csv).toContain("Resumen de IVU para preparar la planilla en SURI");
    expect(csv).toMatch(/^Total,\d+\.\d\d,\d+\.\d\d,\d+\.\d\d,\d+\.\d\d,\d+\.\d\d$/m);

    const pdf = await page.request.get(`${app()}/exportar/descargar?kind=ivu_monthly_pdf&month=2026-09`);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

    const xlsx = await page.request.get(`${app()}/exportar/descargar?kind=sales_xlsx&month=2026-09`);
    expect(xlsx.status()).toBe(200);
    expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK"); // a zip, as .xlsx files are

    const sales = await page.request.get(`${app()}/exportar/descargar?kind=sales_csv&month=2026-09`);
    const salesCsv = await sales.text();
    for (const section of ["Órdenes", "Platos", "Pagos", "Reembolsos"])
      expect(salesCsv).toMatch(new RegExp(`^${section}\\r?$`, "m"));

    // Every export is stored and can be downloaded again.
    await page.reload();
    const latest = page.getByRole("listitem").filter({ hasText: "Ventas (CSV)" }).first();
    await expect(latest).toBeVisible();
    const again = await page.request.get(
      (await latest.getByRole("link", { name: "Descargar" }).getAttribute("href"))!,
    );
    expect(again.status()).toBe(200);
    expect(await again.text()).toContain("Órdenes");
    await page.screenshot({ path: "docs/screenshots/app-export.desktop.light.png", fullPage: true });
  });

  test("servers get neither reports nor exports", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one run is enough");
    await login(page, email("mesero"));
    await page.goto(`${app()}/reportes`);
    await expect(page).toHaveURL(atApp("/servicio"));
    const res = await page.request.get(`${app()}/exportar/descargar?kind=ivu_monthly_csv&month=2026-09`, {
      maxRedirects: 0,
    });
    expect(res.status()).not.toBe(200);
  });
});

test("the summary cron needs CRON_SECRET", async ({ request }, info) => {
  test.skip(info.project.name !== "desktop", "one run is enough");
  if (!process.env.CRON_SECRET && existsSync(".env.local")) process.loadEnvFile(".env.local");
  expect((await request.get("/api/cron/refresh-sales")).status()).toBe(401);
  expect(
    (
      await request.get("/api/cron/refresh-sales", { headers: { authorization: "Bearer wrong-secret-0000" } })
    ).status(),
  ).toBe(401);
  const ok = await request.get("/api/cron/refresh-sales", {
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).refreshed).toBeGreaterThan(0);
});
