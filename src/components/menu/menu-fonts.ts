import { Josefin_Sans, Playfair_Display } from "next/font/google";
import { MENU_FONTS } from "@/config/menu-fonts";

// Restaurant menu fonts (never Mezza's interface). next/font/google self-hosts them at build time.
// Only the families a seeded theme uses are loaded so far; others fall back by category.
const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--mf-playfair-display",
  display: "swap",
});
const josefin = Josefin_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  variable: "--mf-josefin-sans",
  display: "swap",
});

export const menuFontVariables = `${playfair.variable} ${josefin.variable}`;

const LOADED: Record<string, string> = {
  "Playfair Display": "var(--mf-playfair-display)",
  "Josefin Sans": "var(--mf-josefin-sans)",
};

const FALLBACK = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: "'Helvetica Neue', Arial, sans-serif",
  display: "Georgia, serif",
  script: "cursive",
} as const;

export function menuFontStack(family: string): string {
  const category = MENU_FONTS.find((f) => f.family === family)?.category ?? "serif";
  return [LOADED[family], FALLBACK[category]].filter(Boolean).join(", ");
}
