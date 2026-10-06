import "server-only";
import { mocksAllowed, pickImplementation, type Ctx } from "../shared";
import { cashProvider } from "./cash";
import { mockProvider } from "./mock";
import { stubProvider } from "./stub";
import type { PaymentMethod, PaymentProvider } from "./types";

export * from "./types";

function provider(method: "card" | "ath", envVar: string): PaymentProvider {
  const impl = pickImplementation(envVar, ["stub", "mock"] as const, "stub");
  if (impl === "mock") {
    if (!mocksAllowed()) throw new Error(`${envVar}=mock needs MEZZA_DEMO_MODE=true outside production`);
    return mockProvider(method);
  }
  return stubProvider(method, impl);
}

let cache: Record<PaymentMethod, PaymentProvider> | null = null;

/** Registry: cash is always the cash provider; card and ATH follow MEZZA_PAYMENTS_CARD / _ATH. */
export function payments(): Record<PaymentMethod, PaymentProvider> {
  cache ??= {
    cash: cashProvider,
    card: provider("card", "MEZZA_PAYMENTS_CARD"),
    ath: provider("ath", "MEZZA_PAYMENTS_ATH"),
  };
  return cache;
}

/** What a guest can choose now: card/ATH only when connected (or mocked), cash always last. */
export async function availableMethods(ctx: Ctx): Promise<PaymentMethod[]> {
  const all = payments();
  const online: PaymentMethod[] = [];
  for (const m of ["card", "ath"] as const) if ((await all[m].status(ctx)) === "connected") online.push(m);
  return [...online, "cash"];
}
