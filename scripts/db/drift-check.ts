/**
 * Drift check: compares the newest production schema snapshot with what the migrations build
 * locally. The snapshot is a read-only `supabase db dump --schema public,storage` of production,
 * saved as supabase/snapshots/prod-<date>@<version>.sql, where <version> is the last migration
 * production has applied (`supabase migration list --linked`). The local database is rebuilt up to
 * that same version, dumped, and compared statement by statement (whitespace-normalized); then the
 * newer migrations are re-applied.
 *
 *   only in production   = changed directly in production (no migration): fails the check
 *   only in migrations   = in a migration production says it applied, but missing there: fails
 *   newer migrations     = listed as "not applied to production yet"
 *
 * In `storage` only our own policies are compared; the rest of that schema belongs to Supabase and
 * differs between Supabase versions. Rebuilding resets the local database (seed data included), so
 * outside CI it asks for DRIFT_RESET=1.
 *
 *   DRIFT_RESET=1 pnpm db:drift      (local database running: `supabase start` or `supabase db start`)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const snapshots = join(root, "supabase", "snapshots");

const latest = existsSync(snapshots)
  ? readdirSync(snapshots)
      .filter((f) => /^prod-.*\.sql$/.test(f))
      .sort()
      .pop()
  : undefined;
if (!latest) {
  console.log("drift check: no production snapshot in supabase/snapshots yet (issue #12); skipped.");
  process.exit(0);
}
const version = /@(\d{14})\.sql$/.exec(latest)?.[1];
if (!version) {
  console.error(`drift check: ${latest} must name production's last migration: prod-<date>@<version>.sql`);
  process.exit(1);
}
if (!process.env.CI && process.env.DRIFT_RESET !== "1") {
  console.error("drift check: this rebuilds the local database (seed data is lost). Run with DRIFT_RESET=1.");
  process.exit(1);
}

const supabase = (...args: string[]) =>
  execFileSync("pnpm", ["exec", "supabase", ...args], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
    shell: true,
  });
const newer = readdirSync(join(root, "supabase", "migrations"))
  .filter((f) => f.endsWith(".sql") && f.slice(0, 14) > version)
  .sort();

const local = join(mkdtempSync(join(tmpdir(), "mezza-drift-")), "local.sql");
supabase("db", "reset", "--local", "--no-seed", "--version", version);
try {
  supabase("db", "dump", "--local", "--schema", "public,storage", "-f", local);
} finally {
  supabase("migration", "up", "--local");
}

/** Schema statements worth comparing, whitespace-normalized. */
function statements(file: string): Set<string> {
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const out = new Set<string>();
  // Split on semicolons at line ends; function bodies ($$ ... $$) stay whole.
  let current = "";
  let inBody = false;
  for (const line of text.split("\n")) {
    if (!inBody && (line.startsWith("--") || line.trim() === "")) continue;
    current += line + "\n";
    if ((line.match(/\$\$/g) ?? []).length % 2 === 1) inBody = !inBody;
    if (!inBody && line.trimEnd().endsWith(";")) {
      const s = current.replace(/\s+/g, " ").trim();
      current = "";
      if (/^(SET |SELECT pg_catalog\.set_config|RESET )/.test(s)) continue;
      const mentionsStorage = /"storage"\./.test(s) || /SCHEMA "storage"/.test(s);
      if (mentionsStorage && !/^CREATE POLICY /.test(s)) continue;
      out.add(s);
    }
  }
  return out;
}

const prod = statements(join(snapshots, latest));
const mine = statements(local);
const onlyProd = [...prod].filter((s) => !mine.has(s));
const onlyMigrations = [...mine].filter((s) => !prod.has(s));
const short = (s: string) => (s.length > 220 ? `${s.slice(0, 220)}…` : s);

console.log(`drift check: ${latest} vs migrations up to ${version} (${prod.size} / ${mine.size} statements)`);
if (newer.length) {
  console.log(`\nNot applied to production yet (${newer.length}):`);
  for (const f of newer) console.log(`  + ${f}`);
}
if (onlyProd.length) {
  console.log(`\nIn production but in no migration (${onlyProd.length}): changed directly in production.`);
  console.log("Capture each in a migration (or revert it in production), then refresh the snapshot:");
  for (const s of onlyProd) console.log(`  - ${short(s)}`);
}
if (onlyMigrations.length) {
  console.log(`\nIn the migrations up to ${version} but missing in production (${onlyMigrations.length}):`);
  for (const s of onlyMigrations) console.log(`  ? ${short(s)}`);
}
if (onlyProd.length || onlyMigrations.length) process.exit(1);
console.log("\nNo drift.");
