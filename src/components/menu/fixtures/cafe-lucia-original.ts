/**
 * Café Lucía's printed menu, ported from the prototype's buildOriginal(). The seed writes it to
 * supabase/seed/assets/cafe-lucia-original.svg and rasterizes it; the demo uses it directly.
 * Hotspots come from the same layout, so they always line up with the page.
 */
import { formatPlain } from "@/lib/money";

interface PrintedItem {
  id: string;
  nameEs: string;
  descriptionEs: string;
  priceCents: number;
}

export interface PrintedSection {
  nameEs: string;
  items: PrintedItem[];
}

const W = 600;
const F = "Playfair Display, Georgia, serif";
const J = "Josefin Sans, Arial, sans-serif";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function buildPrintedMenu(sections: PrintedSection[]) {
  const parts: string[] = [];
  const hotspots: { itemId: string; x: number; y: number; width: number; height: number }[] = [];
  let y = 212;
  for (const section of sections) {
    parts.push(
      `<line x1="70" y1="${y - 6}" x2="210" y2="${y - 6}" stroke="#B08D57"/><line x1="390" y1="${y - 6}" x2="530" y2="${y - 6}" stroke="#B08D57"/>`,
      `<text x="300" y="${y}" text-anchor="middle" font-family="${J}" font-size="17" letter-spacing="6" fill="#8C2F2B" font-weight="600">${esc(section.nameEs.toUpperCase())}</text>`,
    );
    y += 44;
    for (const item of section.items) {
      const price = formatPlain(item.priceCents);
      const x1 = 72 + item.nameEs.length * 10.6;
      const x2 = 528 - price.length * 11.5;
      parts.push(
        `<text x="64" y="${y}" font-family="${F}" font-size="22" font-weight="600" fill="#2A2620">${esc(item.nameEs)}</text>`,
        `<line x1="${x1}" y1="${y - 2}" x2="${x2}" y2="${y - 2}" stroke="#B08D57" stroke-width="2" stroke-dasharray="1 6" stroke-linecap="round"/>`,
        `<text x="536" y="${y}" text-anchor="end" font-family="${F}" font-size="21" font-weight="700" fill="#1F4D3A">${price}</text>`,
        `<text x="64" y="${y + 21}" font-family="${F}" font-style="italic" font-size="15" fill="#6B5E4B">${esc(item.descriptionEs)}</text>`,
      );
      hotspots.push({ itemId: item.id, x: 46, y: y - 28, width: 508, height: 56 });
      y += 60;
    }
    y += 26;
  }
  const height = y + 60;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${height}" width="${W}" height="${height}">
<defs><pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#7A5A28" opacity=".08"/></pattern></defs>
<rect width="${W}" height="${height}" fill="#F3E9D2"/><rect width="${W}" height="${height}" fill="url(#grain)"/>
<rect x="16" y="16" width="${W - 32}" height="${height - 32}" fill="none" stroke="#1F4D3A" stroke-width="3"/>
<rect x="26" y="26" width="${W - 52}" height="${height - 52}" fill="none" stroke="#B08D57" stroke-width="1"/>
<text x="300" y="112" text-anchor="middle" font-family="${F}" font-style="italic" font-weight="600" font-size="66" fill="#1F4D3A">Café Lucía</text>
<text x="300" y="146" text-anchor="middle" font-family="${J}" font-size="13" letter-spacing="5" fill="#8C2F2B" font-weight="600">VIEJO SAN JUAN · DESDE 1962</text>
<line x1="190" y1="168" x2="280" y2="168" stroke="#B08D57"/><path d="M300 160l8 8-8 8-8-8z" fill="#B08D57"/><line x1="320" y1="168" x2="410" y2="168" stroke="#B08D57"/>
${parts.join("\n")}
<text x="300" y="${height - 44}" text-anchor="middle" font-family="${F}" font-style="italic" font-size="14" fill="#6B5E4B">Precios no incluyen IVU · Gracias por su visita</text>
</svg>`;
  return {
    svg,
    width: W,
    height,
    hotspots: hotspots.map((h) => ({
      itemId: h.itemId,
      x: h.x / W,
      y: h.y / height,
      width: h.width / W,
      height: h.height / height,
    })),
  };
}
