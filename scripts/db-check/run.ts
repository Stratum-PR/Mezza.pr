/**
 * Applies supabase/migrations to an in-process Postgres (PGlite) and runs supabase/tests through a
 * pgTAP shim. A Docker-free check of the SQL; `supabase test db` against the real local stack
 * remains the source of truth (real pgTAP, real auth and storage schemas).
 *
 *   pnpm db:check            migrations + tests
 *   pnpm db:check --seed     also loads supabase/seed.sql
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = join(__dirname, "..", "..");
const here = __dirname;
const withSeed = process.argv.includes("--seed");

function sqlFiles(dir: string, suffix: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => join(dir, f));
}

function rel(p: string): string {
  return p.slice(root.length + 1).replaceAll("\\", "/");
}

async function main() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readFileSync(join(here, "supabase-stub.sql"), "utf8"));
  await db.exec(readFileSync(join(here, "pgtap-shim.sql"), "utf8"));
  await db.exec(`set search_path = "$user", public, extensions`);

  for (const file of sqlFiles(join(root, "supabase", "migrations"), ".sql")) {
    try {
      await db.exec(readFileSync(file, "utf8"));
      console.log(`applied  ${rel(file)}`);
    } catch (error) {
      console.error(`FAILED   ${rel(file)}\n${(error as Error).message}`);
      process.exit(1);
    }
  }

  if (withSeed) {
    const seed = join(root, "supabase", "seed.sql");
    try {
      await db.exec(readFileSync(seed, "utf8"));
      console.log(`seeded   ${rel(seed)}`);
    } catch (error) {
      console.error(`FAILED   ${rel(seed)}\n${(error as Error).message}`);
      process.exit(1);
    }
  }

  let failures = 0;
  for (const file of sqlFiles(join(root, "supabase", "tests"), ".test.sql")) {
    const lines: string[] = [];
    try {
      const results = await db.exec(readFileSync(file, "utf8"));
      for (const result of results) {
        for (const row of result.rows) {
          for (const value of Object.values(row as Record<string, unknown>)) {
            if (typeof value === "string" && /^(ok|not ok|1\.\.|#)/.test(value)) lines.push(value);
          }
        }
      }
    } catch (error) {
      await db.exec("rollback").catch(() => undefined);
      lines.push(`not ok - ${rel(file)} died: ${(error as Error).message}`);
    }
    const failed = lines.filter((l) => l.startsWith("not ok") || l.startsWith("# Looks like"));
    const passed = lines.filter((l) => l.startsWith("ok")).length;
    failures += failed.length;
    console.log(`\n${rel(file)}: ${passed} passed, ${failed.length} failed`);
    for (const l of failed) console.log(`  ${l}`);
  }

  await db.close();
  if (failures > 0) {
    console.error(`\n${failures} failing test(s)`);
    process.exit(1);
  }
  console.log("\nall database tests passed");
}

main();
