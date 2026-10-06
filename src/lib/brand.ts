/** Restaurant branding on the guest page: the brand colour is used only when text on it stays readable. */

const NAVY = "#1E2B7E";
const WHITE = "#FFFFFF";
const INK = "#16204F";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * The header background and text colour for a brand colour: white or dark ink, whichever reaches
 * WCAG AA (4.5:1). If neither does, Mezza navy with white text, and `fallback` is true.
 */
export function readableOn(color: string | null | undefined): {
  background: string;
  ink: string;
  fallback: boolean;
} {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return { background: NAVY, ink: WHITE, fallback: false };
  if (contrast(color, WHITE) >= 4.5) return { background: color, ink: WHITE, fallback: false };
  if (contrast(color, INK) >= 4.5) return { background: color, ink: INK, fallback: false };
  return { background: NAVY, ink: WHITE, fallback: true };
}
