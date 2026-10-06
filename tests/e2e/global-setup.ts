import { execFileSync } from "node:child_process";

/** One copy of Café Lucía per worker (idempotent: existing copies are left alone). */
export default function globalSetup() {
  const workers = String(Number(process.env.E2E_WORKERS ?? 4));
  execFileSync("pnpm", ["seed:e2e", workers], { stdio: "inherit", shell: true });
}
