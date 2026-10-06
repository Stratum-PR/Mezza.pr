import type { DotStyle, EyeStyle, LogoMode, QrDesign } from "./render";

/** Everything a printed QR card shows, shared by the studio preview and the PDFs. */
export interface CardDesign {
  fg: string;
  bg: string;
  frame: string;
  frameInk: string;
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
  logoMode: LogoMode;
  logoSrc?: string; // signed URL of an uploaded logo
  frameTextEs: string;
  frameTextEn: string;
  font: "menu" | "modern";
  restaurantName: string;
  displayHost: string;
}

export interface CardTable {
  id: string;
  label: string;
  url: string;
}

export type PdfFormat = "sheet" | "tent" | "sticker";

/** Monogram from the restaurant name: "Café Lucía" → "CL". */
export function monogram(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter((w) => /^[a-z]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function qrDesignOf(card: CardDesign): QrDesign {
  return {
    fg: card.fg,
    bg: card.bg,
    dotStyle: card.dotStyle,
    eyeStyle: card.eyeStyle,
    logoMode: card.logoMode === "upload" && !card.logoSrc ? "mono" : card.logoMode,
    monogram: monogram(card.restaurantName),
    logoHref: card.logoSrc,
  };
}
