import { defineConfig, devices } from "@playwright/test";
process.env.MEZZA_BILL_TEST_FIXTURE = "1";
// Entirely synthetic, isolated, loopback-only. No real Supabase credentials are needed.
const fixtureEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-public-key-0123456789",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key-0123456789",
  QR_TOKEN_SECRET: "fixture-qr-secret-01234567890123456789",
  CRON_SECRET: "fixture-cron-secret-0123456789",
  MEZZA_SPLIT_BILL: "true",
  MEZZA_DEMO_MODE: "false",
};
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "bill-splitting.spec.ts",
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3017",
    ...devices["iPhone 13"],
    defaultBrowserType: "chromium",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node --import tsx scripts/db-check/bill-http-fixture.ts",
      url: "http://127.0.0.1:54329/fixture/state",
      timeout: 60000,
    },
    {
      command: "pnpm dev --hostname 127.0.0.1 --port 3017",
      url: "http://127.0.0.1:3017/es",
      env: fixtureEnv,
      timeout: 120000,
    },
  ],
});
