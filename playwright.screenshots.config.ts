import base from "./playwright.config";

/** `pnpm screenshots`: every screen at 390 and 1280 px, light and dark, into docs/screenshots. */
const config = { ...base, testIgnore: [], testMatch: ["**/screenshots.spec.ts"] };
export default config;
