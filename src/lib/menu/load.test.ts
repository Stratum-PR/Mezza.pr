import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
vi.mock("server-only", () => ({}));
import { loadMenu } from "./load";

afterEach(() => vi.restoreAllMocks());

function client(pageError = false, signError = false) {
  const sign = vi.fn().mockResolvedValue(
    signError
      ? { data: null, error: { message: "storage unavailable" } }
      : {
          data: [
            {
              path: "restaurant/uploads/actual.jpg",
              signedUrl: "https://example.invalid/actual.jpg",
              error: null,
            },
          ],
          error: null,
        },
  );
  const db = {
    from(table: string) {
      const result =
        table === "restaurants"
          ? {
              data: {
                name: "Actual restaurant",
                default_menu_style: "original",
                brand_color: "#123456",
                qr_designs: null,
              },
              error: null,
            }
          : table === "original_menu_pages"
            ? {
                data: [{ id: "page", image_path: "restaurant/uploads/actual.jpg", width: 640, height: 800 }],
                error: pageError ? { message: "permission denied" } : null,
              }
            : { data: table === "menu_themes" ? null : [], error: null };
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: () => chain,
        single: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return chain;
    },
    storage: { from: () => ({ createSignedUrls: sign }) },
  } as unknown as SupabaseClient<Database>;
  return { db, sign };
}

describe("original menu loading", () => {
  it("loads the registered upload path for either caller's client", async () => {
    const { db, sign } = client();
    const menu = await loadMenu(db, "restaurant");
    expect(sign).toHaveBeenCalledWith(["restaurant/uploads/actual.jpg"], 3600);
    expect(menu.pages[0].src).toBe("https://example.invalid/actual.jpg");
    expect(menu.originalError).toBe(false);
  });
  it.each([
    [true, false],
    [false, true],
  ])(
    "surfaces table or signing failure without breaking the other menu views",
    async (pageError, signError) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const menu = await loadMenu(client(pageError, signError).db, "restaurant");
      expect(menu.originalError).toBe(true);
      expect(menu.pages).toEqual([]);
      expect(menu.restaurantName).toBe("Actual restaurant");
    },
  );
});
