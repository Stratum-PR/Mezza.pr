import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectorNotImplementedError, isNotImplemented, mocksAllowed, pickImplementation } from "./shared";

afterEach(() => vi.unstubAllEnvs());

describe("connector registries", () => {
  it("use the default when the variable is unset", () => {
    vi.stubEnv("MEZZA_TEST_IMPL", undefined as unknown as string);
    expect(pickImplementation("MEZZA_TEST_IMPL", ["a", "b"] as const, "a")).toBe("a");
  });

  it("reject unknown implementations at startup", () => {
    vi.stubEnv("MEZZA_TEST_IMPL", "stripe_live");
    expect(() => pickImplementation("MEZZA_TEST_IMPL", ["stub", "mock"] as const, "stub")).toThrow(
      "MEZZA_TEST_IMPL=stripe_live is not one of: stub, mock",
    );
  });

  it("allow mocks only in demo mode outside production", () => {
    vi.stubEnv("MEZZA_DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "development");
    expect(mocksAllowed()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(mocksAllowed()).toBe(false);
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MEZZA_DEMO_MODE", "false");
    expect(mocksAllowed()).toBe(false);
  });

  it("stubs throw an error the UI can recognise", () => {
    const error = new ConnectorNotImplementedError("payments.card", "stub");
    expect(isNotImplemented(error)).toBe(true);
    expect(error.message).toBe("payments.card:stub is not implemented yet");
    expect(isNotImplemented(new Error("x"))).toBe(false);
  });
});
