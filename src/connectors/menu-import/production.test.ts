import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: vi.fn() }));
import { createAdminClient } from "@/lib/db/admin";
import { fixtureImporter } from "./fixture";
import { menuImporter } from "./index";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("production fixture protection", () => {
  it("cannot generate sample content even when demo mode is set in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MEZZA_DEMO_MODE", "true");
    const ctx = { restaurantId: "actual-restaurant", locale: "es" as const };
    await expect(
      fixtureImporter.start(ctx, { storagePath: "actual.jpg", mimeType: "image/jpeg" }),
    ).rejects.toThrow("not implemented");
    await expect(fixtureImporter.result(ctx, "pending-upload")).rejects.toThrow("not implemented");
    await expect(menuImporter().result(ctx, "pending-upload")).rejects.toThrow("not implemented");
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
