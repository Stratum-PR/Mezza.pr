import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_SITE_URL: "https://mezza.test" } }));
vi.mock("@/lib/client-ip", () => ({ clientIp: () => Promise.resolve("ip") }));
vi.mock("@/connectors/rate-limit", () => ({
  rateLimiter: () => ({ limit: () => Promise.resolve({ ok: true }) }),
}));

const state = {
  session: null as object | null,
  rpcs: [] as string[],
  writes: [] as { op: string; values: unknown }[],
  finished: [] as string[],
  redirects: [] as string[],
};

vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    state.redirects.push(to);
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/lib/db/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        signUp: () =>
          Promise.resolve({
            data: { user: { id: "u1", identities: [{}] }, session: state.session },
            error: null,
          }),
      },
    }),
}));
vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    rpc: (fn: string) => {
      state.rpcs.push(fn);
      return Promise.resolve({ data: "r1", error: null });
    },
    from: (table: string) => ({
      upsert: (values: unknown) => {
        state.writes.push({ op: `${table}.upsert`, values });
        return Promise.resolve({ error: null });
      },
      update: (values: unknown) => {
        state.writes.push({ op: `${table}.update`, values });
        return { eq: () => Promise.resolve({ error: null }) };
      },
      select: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
    }),
  }),
}));
vi.mock("./finish-signup", () => ({
  finishSignup: (userId: string) => {
    state.finished.push(userId);
    return Promise.resolve("fonda-nueva");
  },
}));

import { signUp } from "./signup";

function form() {
  const f = new FormData();
  for (const [k, v] of Object.entries({
    fullName: "Nora Nueva",
    email: "nora@fonda.test",
    password: "contrasena-larga",
    restaurantName: "Fonda Nueva",
    phone: "787-555-0100",
    terms: "on",
    locale: "en",
  }))
    f.set(k, v);
  return f;
}

beforeEach(() => {
  state.session = null;
  state.rpcs = [];
  state.writes = [];
  state.finished = [];
  state.redirects = [];
});

describe("signUp (P2-5: no restaurant before the email is confirmed)", () => {
  it("only saves the details while the email is unconfirmed", async () => {
    expect(await signUp({ status: "idle" }, form())).toEqual({ status: "confirm_email" });
    expect(state.rpcs).toEqual([]);
    expect(state.finished).toEqual([]);
    expect(state.writes).toContainEqual({
      op: "pending_signups.upsert",
      values: {
        user_id: "u1",
        full_name: "Nora Nueva",
        restaurant_name: "Fonda Nueva",
        phone: "787-555-0100",
        language: "en",
      },
    });
  });

  it("finishes right away when Supabase confirms at signup (confirmation off)", async () => {
    state.session = { access_token: "t" };
    await expect(signUp({ status: "idle" }, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(state.finished).toEqual(["u1"]);
    expect(state.redirects).toEqual(["/app/fonda-nueva/empezar"]);
  });
});
