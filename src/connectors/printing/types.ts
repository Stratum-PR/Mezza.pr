import type { Ticket } from "@/lib/tickets";

export type { Ticket } from "@/lib/tickets";

export type PrinterProtocol = "browser" | "epson_epos" | "star_webprnt";

export interface PrinterDriver {
  protocol: PrinterProtocol;
  print(
    printer: { id: string; ipAddress?: string; widthChars: number },
    ticket: Ticket,
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}
