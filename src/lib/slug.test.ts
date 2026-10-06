import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it.each([
    ["Café Lucía", "cafe-lucia"],
    ["  El Jibarito  ", "el-jibarito"],
    ["Bar & Grill Doña Ana", "bar-y-grill-dona-ana"],
    ["Ñam!!", "nam"],
    ["X", "restaurante-x"],
    ["!!!", "restaurante-nuevo"],
  ])("%s → %s", (name, slug) => expect(slugify(name)).toBe(slug));

  it("matches the database's slug rule", () => {
    for (const name of ["Café Lucía", "A".repeat(200), "--a--b--"]) {
      expect(slugify(name)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(slugify(name).length).toBeLessThanOrEqual(60);
    }
  });
});

describe("uniqueSlug", () => {
  it("adds a number when the slug is taken", async () => {
    const taken = new Set(["cafe-lucia", "cafe-lucia-2"]);
    expect(await uniqueSlug("cafe-lucia", async (s) => taken.has(s))).toBe("cafe-lucia-3");
    expect(await uniqueSlug("nuevo", async (s) => taken.has(s))).toBe("nuevo");
  });
});
