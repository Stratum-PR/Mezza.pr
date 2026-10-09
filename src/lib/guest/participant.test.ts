import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
vi.mock("server-only", () => ({}));
import { tabParticipant } from "./participant";

const ana = { tab_id: "tab-1", device_hash: "a".repeat(64), id: "ana" };

/** A fake client over participant rows; records the filters, and any RPC (e.g. ensure_participant). */
function client(rows = [ana], fail = false) {
  const filters: Record<string, string> = {};
  const from = vi.fn((table: string) => {
    const chain = {
      select: () => chain,
      eq: (col: string, v: string) => {
        filters[col] = v;
        return chain;
      },
      maybeSingle: () =>
        Promise.resolve(
          fail
            ? { data: null, error: { message: "boom" } }
            : {
                data:
                  table === "tab_participants"
                    ? (rows.find(
                        (r) => r.tab_id === filters.tab_id && r.device_hash === filters.device_hash,
                      ) ?? null)
                    : null,
                error: null,
              },
        ),
    };
    return chain;
  });
  const rpc = vi.fn();
  return { db: { from, rpc } as unknown as SupabaseClient<Database>, from, rpc, filters };
}

describe("tab participant lookup", () => {
  it("finds the phone's person by device hash scoped to the tab", async () => {
    const c = client();
    expect(await tabParticipant(c.db, "tab-1", ana.device_hash)).toBe("ana");
    expect(c.from).toHaveBeenCalledWith("tab_participants");
    expect(c.filters).toEqual({ tab_id: "tab-1", device_hash: ana.device_hash });
  });

  it("refuses a phone that never joined this tab, without creating a participant", async () => {
    const c = client();
    expect(await tabParticipant(c.db, "tab-1", "b".repeat(64))).toBe(null);
    // The same phone at the next party's tab is not a participant there.
    expect(await tabParticipant(c.db, "tab-2", ana.device_hash)).toBe(null);
    expect(c.rpc).not.toHaveBeenCalled();
  });

  it("refuses a phone without a device cookie, and fails closed on a lookup error", async () => {
    const c = client();
    expect(await tabParticipant(c.db, "tab-1", null)).toBe(null);
    expect(c.from).not.toHaveBeenCalled();
    expect(await tabParticipant(client([ana], true).db, "tab-1", ana.device_hash)).toBe(null);
  });
});
