import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ publicEnv: { NEXT_PUBLIC_SITE_URL: "https://mezza.test" } }));

type Existing = { id: string; role: "owner" | "manager" | "server" | "kitchen" } | null;
const state = {
  invitedUser: null as { id: string } | null,
  users: [] as { id: string; email: string }[],
  existing: null as Existing,
  writes: [] as { op: string; values: unknown }[],
  inviteArgs: [] as unknown[],
};

vi.mock("@/lib/db/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        inviteUserByEmail: (...args: unknown[]) => {
          state.inviteArgs = args;
          return Promise.resolve({
            data: { user: state.invitedUser },
            error: state.invitedUser ? null : { message: "exists" },
          });
        },
        listUsers: () => Promise.resolve({ data: { users: state.users }, error: null }),
      },
    },
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: () =>
          Promise.resolve({ data: table === "memberships" ? state.existing : null, error: null }),
        insert: (values: unknown) => {
          state.writes.push({ op: `${table}.insert`, values });
          return Promise.resolve({ error: null });
        },
        update: (values: unknown) => {
          state.writes.push({ op: `${table}.update`, values });
          return { eq: () => Promise.resolve({ error: null }) };
        },
        upsert: (values: unknown) => {
          state.writes.push({ op: `${table}.upsert`, values });
          return Promise.resolve({ error: null });
        },
      };
      return chain;
    },
  }),
}));

import { addMember } from "./invite";

const base = { restaurantId: "r1", email: "Ana@Example.com", role: "server" as const, actorIsOwner: true };

beforeEach(() => {
  state.invitedUser = null;
  state.users = [{ id: "u-owner", email: "ana@example.com" }];
  state.existing = null;
  state.writes = [];
  state.inviteArgs = [];
});

describe("addMember (Equipo and the setup wizard)", () => {
  it("never changes an owner's membership, e.g. the owner typing their own email", async () => {
    state.existing = { id: "m1", role: "owner" };
    expect(await addMember(base)).toBe("forbidden");
    expect(state.writes.filter((w) => w.op.startsWith("memberships"))).toEqual([]);
  });

  it("only the owner changes a manager", async () => {
    state.existing = { id: "m2", role: "manager" };
    expect(await addMember({ ...base, actorIsOwner: false })).toBe("forbidden");
    expect(state.writes).toEqual([]);
  });

  it("only the owner adds a manager", async () => {
    expect(await addMember({ ...base, role: "manager", actorIsOwner: false })).toBe("forbidden");
    expect(state.inviteArgs).toEqual([]);
  });

  it("adds an existing account and reactivates it", async () => {
    state.existing = { id: "m3", role: "kitchen" };
    expect(await addMember(base)).toBe("added");
    expect(state.writes).toContainEqual({
      op: "memberships.update",
      values: { role: "server", active: true },
    });
  });

  it("invites a new person with a link to the site, not the request's origin", async () => {
    state.invitedUser = { id: "u-new" };
    expect(await addMember({ ...base, name: "Ana" })).toBe("invited");
    expect(state.inviteArgs[0]).toBe("ana@example.com");
    expect(state.inviteArgs[1]).toMatchObject({
      redirectTo: "https://mezza.test/api/auth/callback?next=/app/contrasena",
      data: { full_name: "Ana" },
    });
    expect(state.writes).toContainEqual({
      op: "memberships.insert",
      values: { restaurant_id: "r1", user_id: "u-new", role: "server" },
    });
  });

  it("fails when the address is neither invitable nor an existing account", async () => {
    state.users = [];
    expect(await addMember(base)).toBe("invite_failed");
    expect(state.writes).toEqual([]);
  });
});
