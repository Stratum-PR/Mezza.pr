import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// next-intl's plugin loads @swc/core, which refuses a native-binding cache folder that other
// principals can write to (seen on this Windows machine). Keep the cache inside the project.
// Must run before next-intl/plugin is required, hence the require below instead of an import.
if (!process.env.SWC_NATIVE_BINDING_CACHE) {
  const cache = join(process.cwd(), "node_modules", ".cache", "swc");
  mkdirSync(cache, { recursive: true });
  process.env.SWC_NATIVE_BINDING_CACHE = cache;
}

type CreatePlugin = typeof import("next-intl/plugin").default;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pluginModule: CreatePlugin | { default: CreatePlugin } = require("next-intl/plugin");
const createNextIntlPlugin = "default" in pluginModule ? pluginModule.default : pluginModule;
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
