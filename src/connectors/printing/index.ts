import { browserPrinter } from "./browser";
import { epsonStubPrinter, starStubPrinter } from "./network-stubs";
import type { PrinterDriver, PrinterProtocol } from "./types";

export * from "./types";

const DRIVERS: Record<PrinterProtocol, PrinterDriver> = {
  browser: browserPrinter,
  epson_epos: epsonStubPrinter,
  star_webprnt: starStubPrinter,
};

/**
 * Each printer row names its protocol, so the driver follows the printer. MEZZA_PRINTER
 * (browser | epson_stub | star_stub) is the protocol new printers default to.
 */
export function printerDriver(protocol: PrinterProtocol): PrinterDriver {
  return DRIVERS[protocol];
}

export function defaultPrinterProtocol(): PrinterProtocol {
  const value = process.env.MEZZA_PRINTER ?? "browser";
  const map: Record<string, PrinterProtocol> = {
    browser: "browser",
    epson_stub: "epson_epos",
    star_stub: "star_webprnt",
  };
  const protocol = map[value];
  if (!protocol) throw new Error(`MEZZA_PRINTER=${value} is not one of: browser, epson_stub, star_stub`);
  return protocol;
}
