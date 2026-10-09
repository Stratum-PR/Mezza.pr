/**
 * Proves every rollback script works: applies supabase/rollbacks/*.down.sql newest first against the
 * local database, then re-applies the migrations with `supabase migration up`. Run `pnpm test:db`
 * afterwards (CI does) to show the re-applied schema is still correct.
 *
 *   pnpm db:rollback-cycle          (local stack running: `supabase start` or `supabase db start`)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const dir = join(root, "supabase", "rollbacks");
const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_mezza";

const downs = readdirSync(dir)
  .filter((f) => f.endsWith(".down.sql"))
  .sort()
  .reverse();
for (const file of downs) {
  execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-q", "-v", "ON_ERROR_STOP=1"],
    { input: readFileSync(join(dir, file), "utf8"), stdio: ["pipe", "inherit", "inherit"] },
  );
  console.log(`rolled back  ${file}`);
}
execFileSync("pnpm", ["exec", "supabase", "migration", "up", "--local"], {
  cwd: root,
  stdio: "inherit",
  shell: true,
});
console.log(`re-applied ${downs.length} migration(s)`);
