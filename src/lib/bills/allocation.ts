import { assertCents } from "@/lib/money";

/** Largest-remainder allocation, with stable input-order ties and exact conservation. */
export function distribute(total: number, weights: number[]): number[] {
  assertCents(total);
  if (!weights.length || weights.some((n) => !Number.isSafeInteger(n) || n < 0))
    throw new Error("invalid_weights");
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(sum)) throw new Error("amount_too_large");
  if (!sum) {
    if (total) throw new Error("zero_weights");
    return weights.map(() => 0);
  }
  const denomin = BigInt(sum);
  const products = weights.map((w) => BigInt(total) * BigInt(w));
  const parts = products.map((n) => Number(n / denomin));
  const ranked = products
    .map((n, i) => ({ i, remainder: n % denomin }))
    .sort((a, b) => (a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1));
  for (let n = total - parts.reduce((a, b) => a + b, 0), i = 0; i < n; i++) parts[ranked[i].i]++;
  return parts;
}

export interface BillLine {
  id: string;
  qty: number;
  unitCents: number;
  name: string;
  participantId: string | null;
}
export interface PortionDraft {
  participantId: string;
  label: string;
}
export interface UnitAssignment {
  lineId: string;
  unit: number;
  recipients: string[];
}
export interface Allocation {
  participantId: string;
  label: string;
  subtotalCents: number;
  stateCents: number;
  municipalCents: number;
  lines: { lineId: string; unit: number; name: string; cents: number }[];
}

export function allocateBill(
  lines: BillLine[],
  portions: PortionDraft[],
  mode: "even" | "items",
  assignments: UnitAssignment[],
  tax: { state: number; municipal: number },
): Allocation[] {
  if (
    portions.length < 1 ||
    portions.length > 20 ||
    new Set(portions.map((p) => p.participantId)).size !== portions.length
  )
    throw new Error("invalid_portions");
  assertCents(tax.state);
  assertCents(tax.municipal);
  const result: Allocation[] = portions.map((p) => ({
    ...p,
    subtotalCents: 0,
    stateCents: 0,
    municipalCents: 0,
    lines: [],
  }));
  const ids = new Map(result.map((p, i) => [p.participantId, i]));
  const total = lines.reduce((sum, line) => sum + assertCents(line.unitCents) * line.qty, 0);
  assertCents(total);
  // Balance the whole subtotal, not each odd-priced dish independently.
  const remaining = distribute(
    total,
    portions.map(() => 1),
  );
  const seen = new Set<string>();
  const map = new Map(assignments.map((a) => [`${a.lineId}:${a.unit}`, a]));
  if (map.size !== assignments.length) throw new Error("duplicate_assignment");
  for (const line of lines) {
    assertCents(line.unitCents);
    if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > 99 || seen.has(line.id))
      throw new Error("invalid_line");
    seen.add(line.id);
    for (let unit = 0; unit < line.qty; unit++) {
      const key = `${line.id}:${unit}`;
      const recipients =
        mode === "even"
          ? portions.map((p) => p.participantId)
          : map
              .get(key)
              ?.recipients?.slice()
              .sort((a, b) => (ids.get(a) ?? -1) - (ids.get(b) ?? -1));
      if (
        !recipients?.length ||
        new Set(recipients).size !== recipients.length ||
        recipients.some((id) => !ids.has(id))
      )
        throw new Error("unassigned_item");
      let shares: number[];
      if (mode === "even") {
        shares = distribute(line.unitCents, remaining);
        shares.forEach((amount, i) => {
          remaining[i] -= amount;
        });
      } else
        shares = distribute(
          line.unitCents,
          recipients.map(() => 1),
        );
      recipients.forEach((id, i) => {
        const p = result[ids.get(id)!];
        p.subtotalCents += shares[i];
        p.lines.push({ lineId: line.id, unit, name: line.name, cents: shares[i] });
      });
      map.delete(key);
    }
  }
  if (mode === "items" && map.size) throw new Error("unknown_assignment");
  const weights = result.map((p) => p.subtotalCents);
  let state: number[], municipal: number[];
  if (mode === "even") {
    const due = distribute(
      assertCents(total + tax.state + tax.municipal),
      portions.map(() => 1),
    );
    const capacity = due.map((n, i) => n - weights[i]);
    state = distribute(tax.state, capacity);
    municipal = capacity.map((n, i) => n - state[i]);
  } else {
    state = distribute(tax.state, weights);
    municipal = distribute(tax.municipal, weights);
  }
  result.forEach((p, i) => {
    p.stateCents = state[i];
    p.municipalCents = municipal[i];
  });
  return result;
}
