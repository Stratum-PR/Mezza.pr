import type { Cents, Ctx } from "../shared";

interface ImportedItem {
  sectionKey: string;
  nameEs: string;
  nameEn: string;
  descriptionEs?: string;
  descriptionEn?: string;
  priceCents: Cents | null;
  confidence: number; // 0–1; below 0.8 (or null price) must be confirmed in review
  modifierGroupKeys: string[];
  hotspot?: { page: number; x: number; y: number; width: number; height: number };
}

export interface MenuImportResult {
  sections: { key: string; nameEs: string; nameEn: string }[];
  items: ImportedItem[];
  modifierGroups: {
    key: string;
    nameEs: string;
    nameEn: string;
    min: number;
    max: number;
    options: { nameEs: string; nameEn: string; priceCents: Cents }[];
  }[];
  theme: {
    palette: { ink: string; paper: string; accent: string; muted: string };
    displayFont: string;
    bodyFont: string; // only from src/config/menu-fonts.ts
    ornament?: string;
    paperTexture: "none" | "linen" | "kraft" | "parchment";
  };
  pages: { storagePath: string; width: number; height: number }[];
  warnings: string[];
}

export interface MenuImporter {
  start(ctx: Ctx, upload: { storagePath: string; mimeType: string }): Promise<{ uploadId: string }>;
  result(
    ctx: Ctx,
    uploadId: string,
  ): Promise<
    | { status: "processing" }
    | { status: "review"; result: MenuImportResult }
    | { status: "failed"; error: string }
  >;
}

/**
 * An item needs a person to confirm it before publishing.
 * @public Part of the menu-import connector contract described in CONNECTORS.md. Nothing
 * imports it yet; kept for the import review step.
 */
export function needsReview(item: ImportedItem): boolean {
  return item.priceCents === null || item.confidence < 0.8;
}
