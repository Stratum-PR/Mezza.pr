import { formatPlain, type Cents } from "@/lib/money";
import en from "../../../messages/en.json";
import es from "../../../messages/es.json";

/** Mirrors the Ticket type in the printing connector (section 7 of the brief). */
export interface Ticket {
  kind: "kitchen" | "receipt";
  restaurantName: string;
  tableLabel: string;
  orderNumber: number;
  createdAt: string;
  locale: "es" | "en";
  lines: { qty: number; name: string; modifiers: string[]; note?: string }[];
  totals?: {
    subtotalCents: Cents;
    ivuStateCents: Cents;
    ivuMunicipalCents: Cents;
    tipCents: Cents;
    totalCents: Cents;
  };
  footer?: string;
}

// Labels come from the message files like every other UI string.
const L = { es: es.ticket, en: en.ticket };

function wrap(text: string, width: number, indent = ""): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const chunks =
      word.length > width - indent.length
        ? word.match(new RegExp(`.{1,${width - indent.length}}`, "g"))!
        : [word];
    for (const chunk of chunks) {
      const candidate = line ? `${line} ${chunk}` : chunk;
      if ((out.length ? indent : "").length + candidate.length > width && line) {
        out.push(line);
        line = chunk;
      } else {
        line = candidate;
      }
    }
  }
  if (line || out.length === 0) out.push(line);
  return out.map((l, i) => (i === 0 ? l : indent + l));
}

function center(text: string, width: number): string {
  const t = text.slice(0, width);
  return " ".repeat(Math.floor((width - t.length) / 2)) + t;
}

function row(left: string, right: string, width: number): string {
  const space = width - left.length - right.length;
  return space >= 1
    ? left + " ".repeat(space) + right
    : `${left.slice(0, width - right.length - 1)} ${right}`;
}

function time(iso: string, locale: "es" | "en"): string {
  return new Date(iso).toLocaleString(locale === "es" ? "es-PR" : "en-US", {
    timeZone: "America/Puerto_Rico",
    dateStyle: "short",
    timeStyle: "short",
  });
}

/**
 * The single source of ticket text, at a fixed character width. The browser printer prints it
 * now; the Epson/Star drivers will send the same text later.
 */
export function renderTicketText(ticket: Ticket, widthChars: number): string {
  if (!Number.isInteger(widthChars) || widthChars < 24 || widthChars > 64)
    throw new RangeError("width 24–64");
  const l = L[ticket.locale];
  const rule = "-".repeat(widthChars);
  const out: string[] = [
    center(ticket.restaurantName, widthChars),
    center(ticket.kind === "kitchen" ? l.kitchen : l.receipt, widthChars),
    rule,
    row(`${l.table} ${ticket.tableLabel}`, `${l.order} #${ticket.orderNumber}`, widthChars),
    time(ticket.createdAt, ticket.locale),
    rule,
  ];
  for (const line of ticket.lines) {
    out.push(...wrap(`${line.qty}x ${line.name}`, widthChars, "   "));
    for (const m of line.modifiers)
      out.push(...wrap(`- ${m}`, widthChars, "     ").map((s) => `   ${s.trimStart()}`));
    if (line.note)
      out.push(...wrap(`${l.note}: ${line.note}`, widthChars, "     ").map((s) => `   ${s.trimStart()}`));
  }
  if (ticket.totals) {
    const t = ticket.totals;
    out.push(
      rule,
      row(l.subtotal, formatPlain(t.subtotalCents), widthChars),
      row(l.ivuState, formatPlain(t.ivuStateCents), widthChars),
      row(l.ivuMunicipal, formatPlain(t.ivuMunicipalCents), widthChars),
      row(l.tip, formatPlain(t.tipCents), widthChars),
      row(l.total, formatPlain(t.totalCents), widthChars),
    );
  }
  if (ticket.footer) out.push(rule, ...wrap(ticket.footer, widthChars));
  return out.map((s) => s.slice(0, widthChars).trimEnd()).join("\n") + "\n";
}
