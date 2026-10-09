import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

type Pending = {
  user_id: string;
  full_name: string;
  restaurant_name: string;
  phone: string | null;
  language: "es" | "en";
};
const state = {
  confirmedAt: null as string | null,
  pending: null as Pending | null,
  takenSlugs: [] as string[],
  rpcError: null as { message: string } | null,
  rpcs: [] as { fn: string; args: unknown }[],
  writes: [] as { op: string; values: unknown }[],
};

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        getUserById: (id: string) =>
          Promise.resolve({ data: { user: { id, email_confirmed_at: state.confirmedAt } }, error: null }),
      },
    },
    rpc(fn: string, args: unknown) {
      state.rpcs.push({ fn, args });
      return Promise.resolve({ data: state.rpcError ? null : "r-new", error: state.rpcError });
    },
    from(table: string) {
      let slug = "";
      const chain = {
        select: () => chain,
        eq: (col: string, value: string) => {
          if (col === "slug") slug = value;
          return chain;
        },
        then: (resolve: (v: unknown) => void) =>
          resolve({ count: state.takenSlugs.includes(slug) ? 1 : 0, error: null }),
        delete: () => {
          state.writes.push({ op: `${table}.delete`, values: null });
          const claimed = state.pending;
          state.pending = null;
          const del = {
            eq: () => del,
            select: () => del,
            maybeSingle: () => Promise.resolve({ data: claimed, error: null }),
          };
          return del;
        },
        insert: (values: unknown) => {
          state.writes.push({ op: `${table}.insert`, values });
          return Promise.resolve({ error: null });
        },
        update: (values: unknown) => {
          state.writes.push({ op: `${table}.update`, values });
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
      return chain;
    },
  }),
}));

import { finishSignup } from "./finish-signup";

const pending: Pending = {
  user_id: "u1",
  full_name: "Nora Nueva",
  restaurant_name: "Fonda Nueva",
  phone: "787-555-0100",
  language: "en",
};

beforeEach(() => {
  state.confirmedAt = "2026-10-08T12:00:00Z";
  state.pending = { ...pending };
  state.takenSlugs = [];
  state.rpcError = null;
  state.rpcs = [];
  state.writes = [];
});

describe("finishSignup (restaurant created after the email is confirmed)", () => {
  it("does nothing until the email is confirmed", async () => {
    state.confirmedAt = null;
    expect(await finishSignup("u1")).toBeNull();
    expect(state.rpcs).toEqual([]);
    expect(state.writes).toEqual([]);
    expect(state.pending).not.toBeNull();
  });

  it("creates the restaurant from the pending details and returns its slug", async () => {
    expect(await finishSignup("u1")).toBe("fonda-nueva");
    expect(state.rpcs).toEqual([
      {
        fn: "create_restaurant_with_owner",
        args: {
          p_owner_id: "u1",
          p_name: "Fonda Nueva",
          p_slug: "fonda-nueva",
          p_phone: "787-555-0100",
          p_language: "en",
        },
      },
    ]);
    expect(state.writes).toContainEqual({ op: "profiles.update", values: { full_name: "Nora Nueva" } });
    expect(state.pending).toBeNull();
  });

  it("picks the slug at confirmation, so a slug taken meanwhile gets a suffix", async () => {
    state.takenSlugs = ["fonda-nueva"];
    expect(await finishSignup("u1")).toBe("fonda-nueva-2");
  });

  it("does nothing when there is no pending signup (already created, or a staff account)", async () => {
    state.pending = null;
    expect(await finishSignup("u1")).toBeNull();
    expect(state.rpcs).toEqual([]);
  });

  it("puts the pending signup back when the restaurant can't be created", async () => {
    state.rpcError = { message: "boom" };
    expect(await finishSignup("u1")).toBeNull();
    expect(state.writes).toContainEqual({ op: "pending_signups.insert", values: pending });
  });
});
