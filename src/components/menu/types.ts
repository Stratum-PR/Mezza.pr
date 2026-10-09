import type { Cents } from "@/lib/money";

export type MenuLocale = "es" | "en";
export type MenuStyle = "house" | "original" | "simple";

interface MenuTheme {
  palette: { ink: string; paper: string; accent: string; muted: string };
  displayFont: string; // from src/config/menu-fonts.ts
  bodyFont: string;
  ornament?: string;
  paperTexture: "none" | "linen" | "kraft" | "parchment";
}

interface ModifierOption {
  id: string;
  nameEs: string;
  nameEn: string;
  priceCents: Cents;
}

export interface ModifierGroup {
  id: string;
  nameEs: string;
  nameEn: string;
  min: number;
  max: number;
  options: ModifierOption[];
}

type MenuPhoto = { kind: "illustration"; key: string } | { kind: "url"; src: string };

export const DISH_TAGS = ["vegetariano", "sin_gluten", "picante"] as const;
export type DishTag = (typeof DISH_TAGS)[number];

export interface MenuItem {
  id: string;
  sectionId: string;
  nameEs: string;
  nameEn: string;
  descriptionEs?: string;
  descriptionEn?: string;
  priceCents: Cents;
  isAvailable: boolean;
  photo?: MenuPhoto;
  modifierGroups: ModifierGroup[];
  tags?: DishTag[];
}

export interface MenuSection {
  id: string;
  nameEs: string;
  nameEn: string;
}

/** A printed page; hotspot coordinates are fractions (0–1) of the page. */
interface OriginalPage {
  src: string;
  width: number;
  height: number;
  hotspots: { itemId: string; x: number; y: number; width: number; height: number }[];
}

export interface MenuData {
  restaurantName: string;
  tagline?: { es: string; en: string };
  footer?: { es: string; en: string };
  defaultStyle: MenuStyle;
  theme: MenuTheme;
  sections: MenuSection[];
  items: MenuItem[];
  pages: OriginalPage[];
  originalError?: boolean;
  /** Ajustes → Marca: header colour (already contrast-checked), logo and cover photo. */
  brand?: { background: string; ink: string; logoSrc?: string; coverSrc?: string };
}

export function pick<T extends { nameEs: string; nameEn: string }>(x: T, lang: MenuLocale): string {
  return lang === "es" ? x.nameEs : x.nameEn;
}

export function describe(item: MenuItem, lang: MenuLocale): string | undefined {
  return lang === "es" ? item.descriptionEs : item.descriptionEn;
}
