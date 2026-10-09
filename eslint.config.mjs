import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const connectorImplementations = {
  group: ["@/connectors/*/*", "**/connectors/*/*"],
  message:
    "Import connectors only through their registry, e.g. `@/connectors/payments`. Implementation files are private to src/connectors.",
};

// P4-3: the service-role client bypasses RLS. Inside src/ it may be imported only from server code
// that checks the caller first: src/lib/**, src/connectors/**, and in src/app/** only from
// actions.ts, route.ts and server pages/layouts. Everything else under src/ is denied
// (src/components/**, src/config, src/i18n, src/proxy.ts, other files in src/app).
// Limitation: a glob cannot see "use client", so a client page.tsx/layout.tsx is not caught here;
// tests/unit/client-boundaries.test.ts and `import "server-only"` in admin.ts cover that case.
const adminClient = {
  group: ["@/lib/db/admin", "**/db/admin", "**/db/admin.ts"],
  message:
    "The service-role client (`@/lib/db/admin`) is server-only: import it from src/lib/**, src/connectors/**, or an app actions.ts / route.ts / page.tsx / layout.tsx, never from src/components/** or other UI code.",
};

const adminClientAllowed = [
  "src/lib/**",
  "src/app/**/actions.ts",
  "src/app/**/route.ts",
  "src/app/**/page.tsx",
  "src/app/**/layout.tsx",
];

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
    files: ["src/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [connectorImplementations, adminClient] }],
    },
  },
  {
    files: adminClientAllowed,
    rules: { "no-restricted-imports": ["error", { patterns: [connectorImplementations] }] },
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
