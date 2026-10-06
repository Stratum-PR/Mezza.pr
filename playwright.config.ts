import { randomInt } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;
// The dev server compiles pages on demand and slows down under load: 2 workers here; the production
// build (playwright.prod.config.ts, the full-suite run) takes 4.
const WORKERS = Number(process.env.E2E_WORKERS ?? 2);

// Each worker process loads this file and sends its own client IP (the app trusts x-real-ip only
// from the platform; locally nothing overwrites it), so per-IP rate limits (demo requests 5 an hour,
// orders 30 a minute) never trip across workers or across runs.
const testIp = `10.${randomInt(1, 255)}.${randomInt(1, 255)}.${randomInt(1, 255)}`;

export default defineConfig({
  testDir: "tests/e2e",
  // The screenshot review (every screen, light and dark) is on demand: `pnpm screenshots`.
  testIgnore: ["**/screenshots.spec.ts"],
  // Files run in parallel, each worker on its own copy of Café Lucía (tests/e2e/helpers.ts worker());
  // tests inside a file run in order. Copies are made by `pnpm seed:e2e` (global setup).
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: WORKERS,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", extraHTTPHeaders: { "x-real-ip": testIp } },
  projects: [
    { name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: `${baseURL}/es`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
