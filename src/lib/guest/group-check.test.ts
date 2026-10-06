import { describe, expect, it } from "vitest";
import { groupCheck, type CheckLineInput } from "./group-check";

const people = [
  { id: "b", number: 2, name: null },
  { id: "a", number: 1, name: "Ana" },
];
const line = (
  id: string,
  cents: number,
  participantId: string | null,
  extra: Partial<CheckLineInput> = {},
) => ({
  id,
  qty: 1,
  nameEs: id,
  nameEn: id,
  lineCents: cents,
  participantId,
  shared: false,
  shares: [],
  ...extra,
});

describe("group check", () => {
  it("puts own lines, locked shares and table lines in the right place", () => {
    const groups = groupCheck(people, [
      {
        status: "new",
        lines: [
          line("malta", 200, "a"),
          line("tostones", 1001, "b", {
            shared: true,
            shares: [
              { participantId: "a", cents: 501 },
              { participantId: "b", cents: 500 },
            ],
          }),
          line("staff-flan", 400, null),
        ],
      },
      { status: "void", lines: [line("voided", 999, "a")] },
    ]);
    expect(groups.map((g) => g.person?.number ?? "table")).toEqual([1, 2, "table"]);
    expect(groups.map((g) => g.subtotalCents)).toEqual([701, 500, 400]);
    expect(groups[0].entries.find((e) => e.lineId === "tostones")?.sharedOfCents).toBe(1001);
  });

  it("a shared dish without shares stays on the table; no table group when empty", () => {
    expect(
      groupCheck(people, [{ status: "new", lines: [line("x", 300, "a", { shared: true })] }]).at(-1)?.person,
    ).toBe(null);
    expect(groupCheck(people, [{ status: "new", lines: [line("x", 300, "a")] }]).some((g) => !g.person)).toBe(
      false,
    );
  });

  it("always adds up to the table subtotal (property)", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const lines = Array.from({ length: 1 + (seed % 7) }, (_, i) => {
        const cents = ((seed * 37 + i * 101) % 5000) + 1;
        const kind = (seed + i) % 4;
        if (kind === 0) return line(`l${i}`, cents, null);
        if (kind === 1)
          return line(`l${i}`, cents, "a", {
            shared: true,
            shares: [
              { participantId: "a", cents: Math.ceil(cents / 2) },
              { participantId: "b", cents: Math.floor(cents / 2) },
            ],
          });
        return line(`l${i}`, cents, kind === 2 ? "a" : "b");
      });
      const total = lines.reduce((n, l) => n + l.lineCents, 0);
      const groups = groupCheck(people, [{ status: "new", lines }]);
      expect(groups.reduce((n, g) => n + g.subtotalCents, 0)).toBe(total);
    }
  });
});
