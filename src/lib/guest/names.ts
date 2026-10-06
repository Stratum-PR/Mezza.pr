/**
 * Guest display names at a table. Optional; without one a guest is "Invitado #n". Names are labels,
 * never identity: the #n always shows next to them, and words that read as staff or as another
 * guest's default label are refused so nobody can pose as the server or as "Invitado #2".
 */
export const NAME_MAX = 24;

const BLOCKED = new Set([
  "mesero",
  "mesera",
  "meseros",
  "camarero",
  "camarera",
  "gerente",
  "encargado",
  "encargada",
  "dueno",
  "duena",
  "cajero",
  "cajera",
  "cocina",
  "cocinero",
  "cocinera",
  "chef",
  "staff",
  "manager",
  "server",
  "waiter",
  "waitress",
  "owner",
  "admin",
  "administrador",
  "administradora",
  "mezza",
  "stratum",
  "invitado",
  "invitada",
  "guest",
  "restaurante",
  "restaurant",
  "soporte",
  "support",
]);

export type NameCheck =
  { ok: true; name: string | null } | { ok: false; reason: "long" | "invalid" | "blocked" };

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function cleanName(raw: string | null | undefined): NameCheck {
  const name = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { ok: true, name: null };
  if (name.length > NAME_MAX) return { ok: false, reason: "long" };
  if (!/^[\p{L}\p{M}0-9' .-]+$/u.test(name)) return { ok: false, reason: "invalid" };
  if (
    fold(name)
      .split(/[^a-z0-9]+/)
      .some((w) => BLOCKED.has(w))
  )
    return { ok: false, reason: "blocked" };
  return { ok: true, name };
}

/** "Ana · #2", or "Invitado #3" through the caller's translator. */
export function participantLabel(
  p: { name: string | null; number: number },
  guestLabel: (number: number) => string,
): string {
  return p.name ? `${p.name} · #${p.number}` : guestLabel(p.number);
}
