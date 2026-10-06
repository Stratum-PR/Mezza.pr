import "server-only";
import { pickImplementation } from "../shared";
import { processorStubFiscal } from "./processor-stub";
import { sitBesideFiscal } from "./sit-beside";
import type { FiscalProvider } from "./types";

export * from "./types";

const impl = pickImplementation("MEZZA_FISCAL", ["sit_beside", "processor_stub"] as const, "sit_beside");

export function fiscal(): FiscalProvider {
  return impl === "sit_beside" ? sitBesideFiscal : processorStubFiscal;
}
