import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/** P2-4 (issue #16): links in emails and redirects are built from NEXT_PUBLIC_SITE_URL, never from the
 * request's Origin header, which the caller controls. */
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("links never come from the request's Origin header", () => {
  it("no server code reads the origin header", () => {
    const root = join(__dirname, "..", "..");
    const offenders = files(join(root, "src"))
      .filter((f) => /\.get\(\s*["']origin["']\s*\)/i.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });
});
