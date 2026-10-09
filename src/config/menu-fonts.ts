/**
 * The only font families a restaurant menu theme may use. Mezza's own interface never uses these
 * (it uses Archivo). They are loaded with next/font/google, which self-hosts them at build time.
 */
type MenuFontRole = "display" | "body" | "both";

export interface MenuFont {
  family: string;
  role: MenuFontRole;
  category: "serif" | "sans" | "display" | "script";
  weights: number[];
  italic: boolean;
}

export const MENU_FONTS = [
  { family: "Playfair Display", role: "display", category: "serif", weights: [500, 600, 700], italic: true },
  { family: "Josefin Sans", role: "body", category: "sans", weights: [400, 600], italic: false },
  { family: "Lora", role: "both", category: "serif", weights: [400, 600], italic: true },
  {
    family: "Cormorant Garamond",
    role: "display",
    category: "serif",
    weights: [500, 600, 700],
    italic: true,
  },
  { family: "DM Serif Display", role: "display", category: "serif", weights: [400], italic: true },
  { family: "Libre Baskerville", role: "both", category: "serif", weights: [400, 700], italic: true },
  { family: "Cinzel", role: "display", category: "serif", weights: [500, 700], italic: false },
  { family: "Abril Fatface", role: "display", category: "display", weights: [400], italic: false },
  { family: "Pacifico", role: "display", category: "script", weights: [400], italic: false },
  { family: "Oswald", role: "display", category: "sans", weights: [500, 600], italic: false },
  { family: "Raleway", role: "both", category: "sans", weights: [400, 600], italic: false },
  { family: "Work Sans", role: "body", category: "sans", weights: [400, 600], italic: false },
] as const satisfies readonly MenuFont[];

export type MenuFontFamily = (typeof MENU_FONTS)[number]["family"];

export function isMenuFont(family: string): family is MenuFontFamily {
  return MENU_FONTS.some((f) => f.family === family);
}
