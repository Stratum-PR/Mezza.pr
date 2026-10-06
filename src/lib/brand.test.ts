import { describe, expect, it } from "vitest";
import { contrast, readableOn } from "./brand";

describe("brand colour on the guest header", () => {
  it("measures WCAG contrast", () => {
    expect(contrast("#FFFFFF", "#000000")).toBeCloseTo(21, 0);
    expect(contrast("#1E2B7E", "#FFFFFF")).toBeGreaterThan(10);
  });

  it("puts white text on a dark brand colour", () => {
    expect(readableOn("#1F4D3A")).toEqual({ background: "#1F4D3A", ink: "#FFFFFF", fallback: false });
  });

  it("puts dark text on a light brand colour", () => {
    expect(readableOn("#F3E9D2").ink).toBe("#16204F");
  });

  it("falls back to navy when neither text colour is readable", () => {
    expect(readableOn("#8A7F9E")).toEqual({ background: "#1E2B7E", ink: "#FFFFFF", fallback: true });
  });

  it("uses navy when there's no brand colour", () => {
    expect(readableOn(null)).toEqual({ background: "#1E2B7E", ink: "#FFFFFF", fallback: false });
  });
});
