import { renderTicketText } from "@/lib/tickets";
import type { PrinterDriver } from "./types";

/**
 * Prints through the browser's print dialog: the ticket text (from renderTicketText, the same text
 * the network drivers will send) goes into a hidden, print-only frame sized like a receipt.
 */
export const browserPrinter: PrinterDriver = {
  protocol: "browser",
  async print(printer, ticket) {
    if (typeof window === "undefined") return { ok: false, error: "browser_only" };
    const text = renderTicketText(ticket, printer.widthChars);
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(frame);
    try {
      const doc = frame.contentDocument;
      if (!doc) return { ok: false, error: "no_print_frame" };
      const pre = doc.createElement("pre");
      pre.textContent = text;
      const style = doc.createElement("style");
      style.textContent = `@page{size:80mm auto;margin:4mm}body{margin:0}pre{font:12px/1.35 ui-monospace,Menlo,Consolas,monospace;white-space:pre;margin:0}`;
      doc.head.appendChild(style);
      doc.body.appendChild(pre);
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    } finally {
      setTimeout(() => frame.remove(), 1000);
    }
  },
};
