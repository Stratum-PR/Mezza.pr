/**
 * Café Lucía's menu as static data, mirroring supabase/seed.sql (same ids). Used by the website demo
 * and the home page until the guest page reads the database (phase 7).
 */
import type { MenuData, MenuItem, ModifierGroup } from "../types";
import { buildPrintedMenu } from "./cafe-lucia-original";

const R = "c0ffee00";
const sec = (n: number) => `${R}-0001-4000-8000-00000000000${n}`;
const item = (n: number) => `${R}-0002-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const grp = (n: number) => `${R}-0003-4000-8000-00000000000${n}`;
const opt = (n: number) => `${R}-0004-4000-8000-0000000000${n}`;

const milk: ModifierGroup = {
  id: grp(1),
  nameEs: "Leche",
  nameEn: "Milk",
  min: 1,
  max: 1,
  options: [
    { id: opt(11), nameEs: "Entera", nameEn: "Whole", priceCents: 0 },
    { id: opt(12), nameEs: "Almendra", nameEn: "Almond", priceCents: 75 },
    { id: opt(13), nameEs: "Avena", nameEn: "Oat", priceCents: 75 },
  ],
};
const sugar: ModifierGroup = {
  id: grp(2),
  nameEs: "Azúcar",
  nameEn: "Sugar",
  min: 0,
  max: 1,
  options: [
    { id: opt(21), nameEs: "Normal", nameEn: "Regular", priceCents: 0 },
    { id: opt(22), nameEs: "Poca", nameEn: "Light", priceCents: 0 },
    { id: opt(23), nameEs: "Sin azúcar", nameEn: "No sugar", priceCents: 0 },
  ],
};
const mallorca: ModifierGroup = {
  id: grp(3),
  nameEs: "Mallorca",
  nameEn: "Mallorca",
  min: 1,
  max: 1,
  options: [
    { id: opt(31), nameEs: "Sola", nameEn: "Plain", priceCents: 0 },
    { id: opt(32), nameEs: "Jamón y queso", nameEn: "Ham & cheese", priceCents: 200 },
    { id: opt(33), nameEs: "A la plancha con mantequilla", nameEn: "Buttered & pressed", priceCents: 50 },
  ],
};
const bread: ModifierGroup = {
  id: grp(4),
  nameEs: "Pan",
  nameEn: "Bread",
  min: 1,
  max: 1,
  options: [
    { id: opt(41), nameEs: "Pan sobao", nameEn: "Pan sobao", priceCents: 0 },
    { id: opt(42), nameEs: "Pan de agua", nameEn: "Pan de agua", priceCents: 0 },
  ],
};

type Row = [number, number, string, string, string, string, number, string, ModifierGroup[], boolean?];
const ROWS: Row[] = [
  [
    1,
    1,
    "Café con leche",
    "Café con leche",
    "Colado puertorriqueño con leche espumada",
    "Puerto Rican brew with steamed milk",
    250,
    "cup",
    [milk, sugar],
  ],
  [
    2,
    1,
    "Cortadito",
    "Cortadito",
    "Espresso con un toque de leche",
    "Espresso with a splash of milk",
    225,
    "cup",
    [milk, sugar],
  ],
  [3, 1, "Café negro", "Black coffee", "Colado del día", "Daily drip", 175, "cup", [sugar]],
  [
    4,
    2,
    "Mallorca",
    "Mallorca",
    "Pan dulce con azúcar en polvo",
    "Sweet bread with powdered sugar",
    350,
    "pastry",
    [mallorca],
  ],
  [
    5,
    2,
    "Revoltillo con jamón",
    "Scrambled eggs & ham",
    "Con tostadas de pan de agua",
    "With pan de agua toast",
    650,
    "plate",
    [],
  ],
  [6, 2, "Avena", "Oatmeal", "Avena caliente con canela", "Warm oats with cinnamon", 300, "bowl", [milk]],
  [
    7,
    3,
    "Sándwich de mezcla",
    "Mezcla sandwich",
    "El clásico de fiesta",
    "The classic party spread",
    550,
    "sandwich",
    [bread],
  ],
  [
    8,
    3,
    "Tripleta",
    "Tripleta",
    "Carne, pollo y jamón con papitas",
    "Beef, chicken and ham with potato sticks",
    900,
    "sandwich",
    [bread],
  ],
  [
    9,
    4,
    "Quesito",
    "Quesito",
    "Hojaldre con queso crema",
    "Puff pastry with cream cheese",
    200,
    "pastry",
    [],
  ],
  [
    10,
    4,
    "Flan de queso",
    "Cheese flan",
    "Receta de la abuela Lucía",
    "Grandma Lucía's recipe",
    400,
    "flan",
    [],
    false,
  ],
  [11, 5, "Jugo de china", "Orange juice", "Recién exprimido", "Freshly squeezed", 350, "glass", []],
  [12, 5, "Malta", "Malta", "Bien fría", "Ice cold", 200, "bottle", []],
];

const SECTIONS = [
  { id: sec(1), nameEs: "Café", nameEn: "Coffee" },
  { id: sec(2), nameEs: "Desayunos", nameEn: "Breakfast" },
  { id: sec(3), nameEs: "Sándwiches", nameEn: "Sandwiches" },
  { id: sec(4), nameEs: "Dulces", nameEn: "Pastries" },
  { id: sec(5), nameEs: "Bebidas", nameEn: "Drinks" },
];

const ITEMS: MenuItem[] = ROWS.map(
  ([n, s, nameEs, nameEn, descriptionEs, descriptionEn, priceCents, ph, groups, available]) => ({
    id: item(n),
    sectionId: sec(s),
    nameEs,
    nameEn,
    descriptionEs,
    descriptionEn,
    priceCents,
    isAvailable: available ?? true,
    photo: { kind: "illustration", key: ph },
    modifierGroups: groups,
  }),
);

const printed = buildPrintedMenu(
  SECTIONS.map((s) => ({
    nameEs: s.nameEs,
    items: ITEMS.filter((i) => i.sectionId === s.id).map((i) => ({
      id: i.id,
      nameEs: i.nameEs,
      descriptionEs: i.descriptionEs ?? "",
      priceCents: i.priceCents,
    })),
  })),
);

export const CAFE_LUCIA_PRINTED = printed;

export const CAFE_LUCIA_MENU: MenuData = {
  restaurantName: "Café Lucía",
  tagline: { es: "Viejo San Juan · desde 1962", en: "Old San Juan · since 1962" },
  footer: { es: "Precios no incluyen IVU", en: "Prices do not include IVU" },
  defaultStyle: "house",
  theme: {
    palette: { ink: "#1F4D3A", paper: "#F3E9D2", accent: "#8C2F2B", muted: "#B08D57" },
    displayFont: "Playfair Display",
    bodyFont: "Josefin Sans",
    ornament: "◆",
    paperTexture: "parchment",
  },
  sections: SECTIONS,
  items: ITEMS,
  pages: [
    {
      src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(printed.svg)}`,
      width: printed.width,
      height: printed.height,
      hotspots: printed.hotspots,
    },
  ],
};
