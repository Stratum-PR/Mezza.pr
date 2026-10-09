import { join } from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

// P4-3: the ESLint config restricts where the service-role client may be imported.
const ROOT = join(__dirname, "../..");
const eslint = new ESLint({ cwd: ROOT });

async function restrictedImports(file: string, code: string): Promise<number> {
  const [result] = await eslint.lintText(code, { filePath: join(ROOT, file) });
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports").length;
}

const aliasImport =
  'import { createAdminClient } from "@/lib/db/admin";\nexport const a = createAdminClient;\n';

describe("service-role client import rule (P4-3)", () => {
  it.each([
    ["src/components/staff/probe.tsx", aliasImport],
    ["src/components/probe.tsx", 'import * as m from "../lib/db/admin";\nexport const a = m;\n'],
    ["src/app/r/probe-client.tsx", aliasImport],
    ["src/config/probe.ts", aliasImport],
  ])("rejects %s", async (file, code) => {
    expect(await restrictedImports(file, code)).toBe(1);
  });

  it.each([
    "src/lib/staff/probe.ts",
    "src/connectors/payments/probe.ts",
    "src/app/app/[restaurant]/probe/actions.ts",
    "src/app/api/probe/route.ts",
    "src/app/app/[restaurant]/probe/page.tsx",
    "src/app/admin/layout.tsx",
  ])("allows %s", async (file) => {
    expect(await restrictedImports(file, aliasImport)).toBe(0);
  });
});
