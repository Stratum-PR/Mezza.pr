import type { Cents } from "@/lib/money/types";

/** Percentages are basis points: 50 = 0.5%. */
export type PricingModel =
  | { id: "A"; kind: "base_plus_card"; monthlyCents: Cents; cardFeeBps: number }
  | { id: "B"; kind: "tiers"; tiers: { id: "basico" | "pro" | "plus"; monthlyCents: Cents }[] }
  | { id: "C"; kind: "percent_only"; cardFeeBps: number; athFeeBps: number }
  | { id: "D"; kind: "base_plus_card"; monthlyCents: Cents; cardFeeBps: number };

export const pricing = {
  activeModel: "A" as PricingModel["id"],
  trialDays: 30,
  /** Placeholder until Stratum confirms the guided setup price. */
  guidedSetupCents: 29_900,
  models: [
    { id: "A", kind: "base_plus_card", monthlyCents: 2_900, cardFeeBps: 50 },
    {
      id: "B",
      kind: "tiers",
      tiers: [
        { id: "basico", monthlyCents: 4_900 },
        { id: "pro", monthlyCents: 9_900 },
        { id: "plus", monthlyCents: 17_900 },
      ],
    },
    { id: "C", kind: "percent_only", cardFeeBps: 100, athFeeBps: 100 },
    { id: "D", kind: "base_plus_card", monthlyCents: 4_900, cardFeeBps: 25 },
  ] satisfies PricingModel[],
};

export function activePricingModel(): PricingModel {
  const model = pricing.models.find((m) => m.id === pricing.activeModel);
  if (!model) throw new Error(`Unknown pricing model ${pricing.activeModel}`);
  return model;
}

/** Mezza's monthly fee for a month with this much card volume, under the active model (half-up). */
export function monthlyFee(cardCents: Cents): Cents {
  const model = activePricingModel();
  const pct = (bps: number) => Math.floor((cardCents * bps + 5000) / 10000);
  if (model.kind === "base_plus_card") return model.monthlyCents + pct(model.cardFeeBps);
  if (model.kind === "percent_only") return pct(model.cardFeeBps);
  return model.tiers[0]!.monthlyCents;
}
