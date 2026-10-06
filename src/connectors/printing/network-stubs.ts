import { ConnectorNotImplementedError } from "../shared";
import type { PrinterDriver } from "./types";

/** Epson ePOS and Star WebPRNT network printing come in a later pass; they'll reuse renderTicketText. */
export const epsonStubPrinter: PrinterDriver = {
  protocol: "epson_epos",
  async print() {
    throw new ConnectorNotImplementedError("printer", "epson_stub");
  },
};

export const starStubPrinter: PrinterDriver = {
  protocol: "star_webprnt",
  async print() {
    throw new ConnectorNotImplementedError("printer", "star_stub");
  },
};
