import { describe, expect, it } from "vitest";
import { deriveQrToken, hashQrToken, isTokenShape, tableUrl, verifyQrToken } from "./token";

const SECRET = "test-secret-test-secret-test-secret-0123";
const TABLE = "c0ffee00-0005-4000-8000-000000000004";

describe("QR tokens", () => {
  it("are deterministic, so PDFs can be regenerated", () => {
    expect(deriveQrToken(SECRET, TABLE, 1)).toBe(deriveQrToken(SECRET, TABLE, 1));
    expect(isTokenShape(deriveQrToken(SECRET, TABLE, 1))).toBe(true);
  });

  it("differ per table, per version and per secret", () => {
    const base = deriveQrToken(SECRET, TABLE, 1);
    expect(deriveQrToken(SECRET, TABLE, 2)).not.toBe(base);
    expect(deriveQrToken(SECRET, TABLE.replace(/4$/, "5"), 1)).not.toBe(base);
    expect(deriveQrToken(`${SECRET}x`, TABLE, 1)).not.toBe(base);
  });

  it("are looked up by their sha256 hash", () => {
    const token = deriveQrToken(SECRET, TABLE, 1);
    const stored = hashQrToken(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(hashQrToken(token)).toBe(stored);
    expect(hashQrToken(deriveQrToken(SECRET, TABLE, 2))).not.toBe(stored);
  });

  it("rotation invalidates the old code", () => {
    const v1 = deriveQrToken(SECRET, TABLE, 1);
    expect(verifyQrToken(SECRET, TABLE, 1, v1)).toBe(true);
    expect(verifyQrToken(SECRET, TABLE, 2, v1)).toBe(false);
    expect(verifyQrToken(SECRET, TABLE, 1, "not-a-token")).toBe(false);
  });

  it("refuses short secrets", () => {
    expect(() => deriveQrToken("short", TABLE, 1)).toThrow();
  });

  it("builds the table URL", () => {
    expect(tableUrl("http://localhost:3000/", "cafe-lucia", "abc")).toBe(
      "http://localhost:3000/r/cafe-lucia/t/abc",
    );
  });
});
