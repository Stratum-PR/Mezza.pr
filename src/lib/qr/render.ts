import { create } from "qrcode";

/**
 * Mezza's QR renderer. It turns a URL into a list of plain shapes (rects, circles, ring paths, a
 * logo slot) in module units. The on-screen preview (React SVG), the PDFs (@react-pdf primitives)
 * and the decode tests (SVG string) all draw the same shapes, so they can't drift apart.
 */

export type DotStyle = "square" | "rounded" | "dots";
export type EyeStyle = "square" | "rounded" | "circle";
export type LogoMode = "none" | "mono" | "upload";

export interface QrDesign {
  fg: string;
  bg: string;
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
  logoMode: LogoMode;
  /** Monogram letters for logoMode "mono" (e.g. "CL"). */
  monogram?: string;
  /** Image URL for logoMode "upload". */
  logoHref?: string;
}

type QrShape =
  | { kind: "rect"; x: number; y: number; w: number; h: number; rx: number; fill: string }
  | { kind: "circle"; cx: number; cy: number; r: number; fill: string }
  /** A square or rounded ring: outer box minus inner box, drawn as an even-odd path. */
  | { kind: "ring"; d: string; fill: string }
  | { kind: "text"; x: number; y: number; size: number; text: string; fill: string }
  | { kind: "image"; x: number; y: number; w: number; h: number; href: string };

export interface QrRender {
  size: number; // total size in modules, quiet zone included
  shapes: QrShape[];
  errorCorrection: "M" | "H";
}

const QUIET = 4;

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${x} ${y}h${w}v${h}h${-w}Z`;
  return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
}

function inFinder(row: number, col: number, n: number): boolean {
  const inBox = (r0: number, c0: number) => row >= r0 && row < r0 + 7 && col >= c0 && col < c0 + 7;
  return inBox(0, 0) || inBox(0, n - 7) || inBox(n - 7, 0);
}

export function renderQr(text: string, design: QrDesign): QrRender {
  // A logo hides part of the code, and round dots leave gaps scanners struggle with, so both use the
  // highest error correction (round dots at "M" failed the decode tests).
  const errorCorrection = design.logoMode === "none" && design.dotStyle !== "dots" ? "M" : "H";
  const qr = create(text, { errorCorrectionLevel: errorCorrection });
  const n = qr.modules.size;
  const size = n + QUIET * 2;
  const shapes: QrShape[] = [{ kind: "rect", x: 0, y: 0, w: size, h: size, rx: 0, fill: design.bg }];

  // Logo slot: a centred square of about 22% of the code, kept clear of modules.
  const logoSpan = design.logoMode === "none" ? 0 : Math.max(5, Math.round(n * 0.22) | 1);
  const logoStart = Math.floor((n - logoSpan) / 2);
  const inLogo = (r: number, c: number) =>
    logoSpan > 0 &&
    r >= logoStart - 1 &&
    r < logoStart + logoSpan + 1 &&
    c >= logoStart - 1 &&
    c < logoStart + logoSpan + 1;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c) || inFinder(r, c, n) || inLogo(r, c)) continue;
      const x = c + QUIET;
      const y = r + QUIET;
      if (design.dotStyle === "dots")
        shapes.push({ kind: "circle", cx: x + 0.5, cy: y + 0.5, r: 0.46, fill: design.fg });
      else
        shapes.push({
          kind: "rect",
          x,
          y,
          w: 1,
          h: 1,
          rx: design.dotStyle === "rounded" ? 0.32 : 0,
          fill: design.fg,
        });
    }
  }

  // Finder eyes: a 7×7 ring and a 3×3 centre in the chosen style.
  for (const [r0, c0] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ] as const) {
    const x = c0 + QUIET;
    const y = r0 + QUIET;
    if (design.eyeStyle === "circle") {
      shapes.push({
        kind: "ring",
        d: `M${x + 3.5} ${y}a3.5 3.5 0 1 0 0.0001 0ZM${x + 3.5} ${y + 1}a2.5 2.5 0 1 1 -0.0001 0Z`,
        fill: design.fg,
      });
      shapes.push({ kind: "circle", cx: x + 3.5, cy: y + 3.5, r: 1.5, fill: design.fg });
    } else {
      const outerR = design.eyeStyle === "rounded" ? 1.6 : 0;
      const innerR = design.eyeStyle === "rounded" ? 1 : 0;
      shapes.push({
        kind: "ring",
        d: `${roundedRectPath(x, y, 7, 7, outerR)}${roundedRectPath(x + 1, y + 1, 5, 5, innerR)}`,
        fill: design.fg,
      });
      shapes.push({
        kind: "rect",
        x: x + 2,
        y: y + 2,
        w: 3,
        h: 3,
        rx: design.eyeStyle === "rounded" ? 0.7 : 0,
        fill: design.fg,
      });
    }
  }

  if (logoSpan > 0) {
    const x = logoStart + QUIET;
    const y = logoStart + QUIET;
    if (design.logoMode === "upload" && design.logoHref) {
      shapes.push({ kind: "image", x, y, w: logoSpan, h: logoSpan, href: design.logoHref });
    } else {
      shapes.push({
        kind: "circle",
        cx: x + logoSpan / 2,
        cy: y + logoSpan / 2,
        r: logoSpan / 2,
        fill: design.fg,
      });
      shapes.push({
        kind: "text",
        x: x + logoSpan / 2,
        y: y + logoSpan / 2,
        size: logoSpan * 0.42,
        text: (design.monogram ?? "").slice(0, 3),
        fill: design.bg,
      });
    }
  }

  return { size, shapes, errorCorrection };
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** The shapes as an SVG document string (used by tests, exports and server rendering). */
export function qrSvgString(render: QrRender, pixelSize = render.size * 10): string {
  const body = render.shapes
    .map((s) => {
      switch (s.kind) {
        case "rect":
          return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx}" fill="${s.fill}"/>`;
        case "circle":
          return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}" fill="${s.fill}"/>`;
        case "ring":
          return `<path d="${s.d}" fill="${s.fill}" fill-rule="evenodd"/>`;
        case "text":
          return `<text x="${s.x}" y="${s.y}" font-size="${s.size}" font-family="Georgia, serif" font-weight="700" text-anchor="middle" dominant-baseline="central" fill="${s.fill}">${esc(s.text)}</text>`;
        case "image":
          return `<image x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" href="${esc(s.href)}" preserveAspectRatio="xMidYMid meet"/>`;
      }
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${render.size} ${render.size}" width="${pixelSize}" height="${pixelSize}" shape-rendering="geometricPrecision">${body}</svg>`;
}

// ---------------------------------------------------------------------------
// Safety checks for the studio
// ---------------------------------------------------------------------------

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Warnings the QR studio shows. Most phone cameras need dark modules on a lighter background. */
export function qrSafety(fg: string, bg: string) {
  const ratio = contrastRatio(fg, bg);
  return {
    ratio,
    lowContrast: ratio < 4,
    inverted: luminance(fg) > luminance(bg),
  };
}
