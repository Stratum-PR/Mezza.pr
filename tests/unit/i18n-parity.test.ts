import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";

/** Flattens nested messages (objects and arrays) into "a.b.0.c" → string. */
function flatten(tree: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof tree === "string") {
    out.set(prefix, tree);
    return out;
  }
  for (const [k, v] of Object.entries(tree as Record<string, unknown>)) {
    for (const [ck, cv] of flatten(v, prefix ? `${prefix}.${k}` : k)) out.set(ck, cv);
  }
  return out;
}

/** ICU argument names, e.g. {year} or {count, plural, …} → ["year", "count"]. */
function argNames(message: string): string[] {
  return [...message.matchAll(/\{\s*([a-zA-Z_][\w]*)\s*(?:[,}])/g)].map((m) => m[1]).sort();
}

const esKeys = flatten(es);
const enKeys = flatten(en);

describe("translation files", () => {
  it("es.json has every key that en.json has", () => {
    expect([...enKeys.keys()].filter((k) => !esKeys.has(k))).toEqual([]);
  });

  it("en.json has every key that es.json has", () => {
    expect([...esKeys.keys()].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("has no empty messages", () => {
    const empty = [...esKeys, ...enKeys].filter(([, v]) => v.trim() === "").map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it("uses the same arguments in both languages", () => {
    const mismatched = [...esKeys.keys()]
      .filter((k) => enKeys.has(k))
      .filter((k) => argNames(esKeys.get(k)!).join() !== argNames(enKeys.get(k)!).join());
    expect(mismatched).toEqual([]);
  });
});
