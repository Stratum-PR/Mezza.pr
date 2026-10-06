import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  // The screenshot review (every screen, light and dark) is on demand: `pnpm screenshots`.
  testIgnore: ["**/screenshots.spec.ts"],
  // One worker: the tests share one seeded restaurant (and one dev server), so they run in order.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure" },
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
