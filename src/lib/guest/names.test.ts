import { describe, expect, it } from "vitest";
import { cleanName, participantLabel } from "./names";

describe("guest names", () => {
  it("is optional: blank means Invitado #n", () => {
    expect(cleanName("")).toEqual({ ok: true, name: null });
    expect(cleanName("   ")).toEqual({ ok: true, name: null });
    expect(cleanName(undefined)).toEqual({ ok: true, name: null });
  });

  it("keeps real names, accents and spaces, tidied", () => {
    expect(cleanName("  José   Ángel ")).toEqual({ ok: true, name: "José Ángel" });
    expect(cleanName("O'Neill-Ruiz Jr.")).toEqual({ ok: true, name: "O'Neill-Ruiz Jr." });
    expect(cleanName("Ana 2")).toEqual({ ok: true, name: "Ana 2" });
  });

  it("refuses names that read as staff or as another guest's label", () => {
    for (const n of [
      "Mesero",
      "la gerente",
      "Dueño",
      "CHEF Luis",
      "Invitado",
      "Invitado 2",
      "guest",
      "Mezza soporte",
    ])
      expect(cleanName(n)).toEqual({ ok: false, reason: "blocked" });
  });

  it("refuses symbols (including #) and long names", () => {
    expect(cleanName("Ana #2")).toEqual({ ok: false, reason: "invalid" });
    expect(cleanName("<script>")).toEqual({ ok: false, reason: "invalid" });
    expect(cleanName("a".repeat(25))).toEqual({ ok: false, reason: "long" });
  });

  it("labels always carry the number", () => {
    const guest = (n: number) => `Invitado #${n}`;
    expect(participantLabel({ name: "Ana", number: 2 }, guest)).toBe("Ana · #2");
    expect(participantLabel({ name: null, number: 3 }, guest)).toBe("Invitado #3");
  });
});
