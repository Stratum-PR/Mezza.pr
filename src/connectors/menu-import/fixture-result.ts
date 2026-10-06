import { CAFE_LUCIA_MENU, CAFE_LUCIA_PRINTED } from "@/components/menu/fixtures/cafe-lucia";
import type { MenuImportResult } from "./types";

const SECTION_KEYS = ["cafe", "desayuno", "sand", "dulce", "beb"];
// Two prices come back unsure and one is missing, so the review checks get exercised.
const LOW_CONFIDENCE = new Set(["Cortadito", "Tripleta"]);
const MISSING_PRICE = "Avena";

/** Café Lucía's menu as an importer would return it (pure; no I/O). */
export function cafeLuciaImportResult(pageStoragePath: string): MenuImportResult {
  const sectionKey = new Map(CAFE_LUCIA_MENU.sections.map((s, i) => [s.id, SECTION_KEYS[i]!]));
  const groups = new Map(CAFE_LUCIA_MENU.items.flatMap((i) => i.modifierGroups).map((g) => [g.id, g]));
  const groupKey = (id: string) => `g${[...groups.keys()].indexOf(id) + 1}`;
  const hotspots = new Map(CAFE_LUCIA_PRINTED.hotspots.map((h) => [h.itemId, h]));

  return {
    sections: CAFE_LUCIA_MENU.sections.map((s, i) => ({
      key: SECTION_KEYS[i]!,
      nameEs: s.nameEs,
      nameEn: s.nameEn,
    })),
    items: CAFE_LUCIA_MENU.items.map((item) => {
      const h = hotspots.get(item.id);
      return {
        sectionKey: sectionKey.get(item.sectionId)!,
        nameEs: item.nameEs,
        nameEn: item.nameEn,
        descriptionEs: item.descriptionEs,
        descriptionEn: item.descriptionEn,
        priceCents: item.nameEs === MISSING_PRICE ? null : item.priceCents,
        confidence: item.nameEs === MISSING_PRICE ? 0.3 : LOW_CONFIDENCE.has(item.nameEs) ? 0.6 : 0.97,
        modifierGroupKeys: item.modifierGroups.map((g) => groupKey(g.id)),
        hotspot: h ? { page: 1, x: h.x, y: h.y, width: h.width, height: h.height } : undefined,
      };
    }),
    modifierGroups: [...groups.values()].map((g) => ({
      key: groupKey(g.id),
      nameEs: g.nameEs,
      nameEn: g.nameEn,
      min: g.min,
      max: g.max,
      options: g.options.map((o) => ({ nameEs: o.nameEs, nameEn: o.nameEn, priceCents: o.priceCents })),
    })),
    theme: {
      palette: CAFE_LUCIA_MENU.theme.palette,
      displayFont: CAFE_LUCIA_MENU.theme.displayFont,
      bodyFont: CAFE_LUCIA_MENU.theme.bodyFont,
      ornament: CAFE_LUCIA_MENU.theme.ornament,
      paperTexture: CAFE_LUCIA_MENU.theme.paperTexture,
    },
    pages: [
      {
        storagePath: pageStoragePath,
        width: CAFE_LUCIA_PRINTED.width,
        height: CAFE_LUCIA_PRINTED.height,
      },
    ],
    warnings: [],
  };
}
