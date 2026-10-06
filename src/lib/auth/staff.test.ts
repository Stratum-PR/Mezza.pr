import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ createClient: vi.fn() }));

const { canSee, homeFor, SECTION_ROLES } = await import("./staff");

describe("role-gated sections", () => {
  it("owners see everything", () => {
    for (const section of Object.keys(SECTION_ROLES) as (keyof typeof SECTION_ROLES)[]) {
      expect(canSee("owner", section)).toBe(true);
    }
  });

  it("managers see everything except the plan", () => {
    expect(canSee("manager", "plan")).toBe(false);
    expect(canSee("manager", "menu")).toBe(true);
    expect(canSee("manager", "reports")).toBe(true);
  });

  it("servers work the floor only", () => {
    expect(canSee("server", "service")).toBe(true);
    expect(canSee("server", "tables")).toBe(true);
    expect(canSee("server", "menu")).toBe(false);
    expect(canSee("server", "reports")).toBe(false);
    expect(canSee("server", "kitchen")).toBe(false);
  });

  it("the kitchen sees only the kitchen", () => {
    const visible = (Object.keys(SECTION_ROLES) as (keyof typeof SECTION_ROLES)[]).filter((s) =>
      canSee("kitchen", s),
    );
    expect(visible).toEqual(["kitchen"]);
  });

  it("each role lands on its own screen", () => {
    expect(homeFor("cafe-lucia", "owner")).toBe("/app/cafe-lucia");
    expect(homeFor("cafe-lucia", "server")).toBe("/app/cafe-lucia/servicio");
    expect(homeFor("cafe-lucia", "kitchen")).toBe("/app/cafe-lucia/cocina");
  });
});
