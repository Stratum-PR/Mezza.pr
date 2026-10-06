/** CSV for spreadsheets: UTF-8 with BOM (so Excel reads accents), CRLF, RFC 4180 quoting. */

export type Cell = string | number | null | undefined;

/**
 * Free text a guest or staff member typed (notes, reasons) could start with "=", "+", "-" or "@"
 * and run as a formula when the file is opened. Prefix those with an apostrophe.
 */
export function safeText(value: string | null | undefined): string {
  if (!value) return "";
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: Cell): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Cents as a plain decimal a spreadsheet reads as a number: 1234 → "12.34". */
export function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
