import { describe, expect, it, vi } from "vitest";
import { onlineOrderQueue } from "./online";
import type { OrderDraft } from "./types";

const draft: OrderDraft = {
  clientOrderId: "11111111-1111-4111-8111-111111111111",
  tableId: "t",
  source: "qr",
  guestLanguage: "es",
  lines: [{ itemId: "i", qty: 1, modifierOptionIds: [] }],
};

describe("online order queue", () => {
  it("retries with the same clientOrderId", async () => {
    const seen: string[] = [];
    const action = vi.fn(async (d: OrderDraft) => {
      seen.push(d.clientOrderId);
      if (seen.length < 3) throw new Error("network");
      return { status: "accepted" as const, orderId: "o", number: 1001 };
    });
    const result = await onlineOrderQueue(action).submit(draft);
    expect(result).toEqual({ status: "accepted", orderId: "o", number: 1001 });
    expect(new Set(seen)).toEqual(new Set([draft.clientOrderId]));
  });

  it("gives up after the retries", async () => {
    const action = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(onlineOrderQueue(action, 1).submit(draft)).rejects.toThrow("offline");
    expect(action).toHaveBeenCalledTimes(2);
  });
});
