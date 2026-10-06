import base from "./playwright.config";

/**
 * `pnpm test:e2e:prod`: the full suite against a production build (`next build` + `next start`),
 * the same kind of build Vercel runs. Demo mocks are off in production builds, so the mock card/ATH
 * payments are switched to their stubs here and demo-only tests skip themselves (E2E_BUILD).
 */
const PORT = Number(process.env.E2E_PROD_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
process.env.E2E_BUILD = "production";

const config = {
  ...base,
  use: { ...base.use, baseURL },
  workers: Number(process.env.E2E_WORKERS ?? 4),
  webServer: {
    command: `pnpm build && pnpm start --port ${PORT}`,
    url: `${baseURL}/es`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: { MEZZA_PAYMENTS_CARD: "stub", MEZZA_PAYMENTS_ATH: "stub" },
  },
};
export default config;
