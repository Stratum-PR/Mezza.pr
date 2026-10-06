import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "bill-local-supabase.spec.ts",
  workers: 1,
  timeout: 120000,
  use: {
    baseURL: "http://127.0.0.1:3019",
    ...devices["iPhone 13"],
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev --hostname 127.0.0.1 --port 3019",
    url: "http://127.0.0.1:3019/es",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      MEZZA_SPLIT_BILL: "true",
      QR_TOKEN_SECRET: "bill-local-qr-secret-01234567890123456789",
      SWC_NATIVE_BINDING_CACHE: process.env.SWC_NATIVE_BINDING_CACHE ?? "C:\\mezza-swc-verification",
    },
  },
});
