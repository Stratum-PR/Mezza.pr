import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "../../src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

const clientFiles = sourceFiles(SRC).filter((f) =>
  /^\s*(['"])use client\1/m.test(readFileSync(f, "utf8").split("\n").slice(0, 5).join("\n")),
);

describe("client bundle boundaries", () => {
  it("no 'use client' file imports the Supabase admin client", () => {
    const offenders = clientFiles.filter((f) =>
      /from\s+['"](@\/lib\/db\/admin|.*\/db\/admin)['"]/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("no 'use client' file imports a connector implementation", () => {
    const offenders = clientFiles.filter((f) =>
      /from\s+['"]@\/connectors\/[^/'"]+\/[^'"]+['"]/.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
