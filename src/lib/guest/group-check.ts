import type { Cents } from "@/lib/money";

export interface CheckPersonRef {
  id: string;
  number: number;
  name: string | null;
}

export interface CheckLineInput {
  id: string;
  qty: number;
  nameEs: string;
  nameEn: string;
  lineCents: Cents;
  participantId: string | null;
  shared: boolean;
  shares: { participantId: string; cents: Cents }[];
}

interface CheckEntry {
  lineId: string;
  qty: number;
  nameEs: string;
  nameEn: string;
  /** What this person (or the table) owes for the line. */
  cents: Cents;
  /** The whole line, when this entry is one share of a shared dish. */
  sharedOfCents: Cents | null;
}

export interface CheckGroup {
  person: CheckPersonRef | null; // null: the table (unassigned lines)
  entries: CheckEntry[];
  subtotalCents: Cents;
}

/**
 * The table's check by person: own lines, locked shares of shared dishes, and the table's lines
 * (staff orders for the whole table, or shared dishes nobody has a share of yet). Groups always add
 * up to the table subtotal. People come in join order; the table group last, only when it has lines.
 */
export function groupCheck(
  people: CheckPersonRef[],
  orders: { status: string; lines: CheckLineInput[] }[],
): CheckGroup[] {
  const byId = new Map<string, CheckGroup>();
  const sorted = [...people].sort((a, b) => a.number - b.number);
  for (const p of sorted) byId.set(p.id, { person: p, entries: [], subtotalCents: 0 });
  const table: CheckGroup = { person: null, entries: [], subtotalCents: 0 };
  const put = (g: CheckGroup, e: CheckEntry) => {
    g.entries.push(e);
    g.subtotalCents += e.cents;
  };

  for (const o of orders) {
    if (o.status === "void") continue;
    for (const l of o.lines) {
      const base = { lineId: l.id, qty: l.qty, nameEs: l.nameEs, nameEn: l.nameEn };
      if (l.shared && l.shares.length > 0) {
        for (const s of l.shares)
          put(byId.get(s.participantId) ?? table, { ...base, cents: s.cents, sharedOfCents: l.lineCents });
      } else if (!l.shared && l.participantId && byId.has(l.participantId)) {
        put(byId.get(l.participantId)!, { ...base, cents: l.lineCents, sharedOfCents: null });
      } else {
        put(table, { ...base, cents: l.lineCents, sharedOfCents: null });
      }
    }
  }
  return [...sorted.map((p) => byId.get(p.id)!), ...(table.entries.length ? [table] : [])];
}
