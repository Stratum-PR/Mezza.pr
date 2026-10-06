import { ConnectorNotImplementedError } from "../shared";
import type { FiscalProvider } from "./types";

/** Certified processor (YCS, Evertec) reporting to Hacienda: a later pass. */
export const processorStubFiscal: FiscalProvider = {
  mode: "processor",
  async recordSale() {
    throw new ConnectorNotImplementedError("fiscal", "processor_stub");
  },
};
