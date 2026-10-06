import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const connectorImplementations = {
  group: ["@/connectors/*/*", "**/connectors/*/*"],
  message:
    "Import connectors only through their registry, e.g. `@/connectors/payments`. Implementation files are private to src/connectors.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "no-restricted-imports": ["error", { patterns: [connectorImplementations] }],
    },
  },
  {
    // Registries and implementations may import each other.
    files: ["src/connectors/**"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "reference/**",
    "playwright-report/**",
    "test-results/**",
    "src/lib/db/types.ts",
  ]),
]);

export default eslintConfig;
