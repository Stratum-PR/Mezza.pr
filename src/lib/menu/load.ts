import "server-only";
import { readableOn } from "@/lib/brand";
import type { DishTag } from "@/components/menu/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MenuData, MenuItem, ModifierGroup } from "@/components/menu/types";
import type { Database } from "@/lib/db/types";

type Db = SupabaseClient<Database>;

const SIGNED_URL_SECONDS = 60 * 60;

async function signed(db: Db, bucket: "photos" | "menus", paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map();
  const { data } = await db.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_SECONDS);
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl]] : [])));
}

export interface EditorMenu extends MenuData {
  restaurantId: string;
  /** Raw rows the editor needs beyond what the guest menu shows. */
  groups: ModifierGroup[];
  photoPaths: Record<string, string | null>;
  sortOrder: { sections: string[] };
}

/**
 * Loads a restaurant's live menu (archived sections and dishes excluded) as the guest menu shape,
 * with signed URLs for photos and printed pages. Works with the user client (RLS) or the admin
 * client (guest pages, after the QR token is resolved).
 */
export async function loadMenu(db: Db, restaurantId: string): Promise<EditorMenu> {
  const [restaurant, theme, sections, items, groups, options, links, pages, hotspots] = await Promise.all([
    db
      .from("restaurants")
      .select("name, default_menu_style, brand_color, cover_path, qr_designs(logo_path)")
      .eq("id", restaurantId)
      .single(),
    db.from("menu_themes").select("*").eq("restaurant_id", restaurantId).maybeSingle(),
    db
      .from("menu_sections")
      .select("id, name_es, name_en, sort_order")
      .eq("restaurant_id", restaurantId)
      .is("archived_at", null)
      .order("sort_order"),
    db
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .is("archived_at", null)
      .order("sort_order"),
    db.from("modifier_groups").select("*").eq("restaurant_id", restaurantId).order("created_at"),
    db.from("modifier_options").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
    db
      .from("item_modifier_groups")
      .select("item_id, group_id, sort_order")
      .eq("restaurant_id", restaurantId)
      .order("sort_order"),
    db.from("original_menu_pages").select("*").eq("restaurant_id", restaurantId).order("page_number"),
    db.from("item_hotspots").select("*").eq("restaurant_id", restaurantId),
  ]);
  if (restaurant.error) throw new Error(`menu load failed: ${restaurant.error.message}`);

  const groupList: ModifierGroup[] = (groups.data ?? []).map((g) => ({
    id: g.id,
    nameEs: g.name_es,
    nameEn: g.name_en,
    min: g.min_select,
    max: g.max_select,
    options: (options.data ?? [])
      .filter((o) => o.group_id === g.id)
      .map((o) => ({ id: o.id, nameEs: o.name_es, nameEn: o.name_en, priceCents: o.price_cents })),
  }));
  const groupById = new Map(groupList.map((g) => [g.id, g]));

  const itemRows = items.data ?? [];
  const photoUrls = await signed(
    db,
    "photos",
    itemRows.flatMap((i) => (i.photo_path ? [i.photo_path] : [])),
  );
  const pageUrls = await signed(
    db,
    "menus",
    (pages.data ?? []).map((p) => p.image_path),
  );

  const menuItems: MenuItem[] = itemRows.map((i) => ({
    id: i.id,
    sectionId: i.section_id,
    nameEs: i.name_es,
    nameEn: i.name_en,
    descriptionEs: i.description_es ?? undefined,
    descriptionEn: i.description_en ?? undefined,
    priceCents: i.price_cents,
    isAvailable: i.is_available,
    tags: (i.tags ?? []) as DishTag[],
    photo:
      i.photo_path && photoUrls.get(i.photo_path)
        ? { kind: "url", src: photoUrls.get(i.photo_path)! }
        : undefined,
    modifierGroups: (links.data ?? [])
      .filter((l) => l.item_id === i.id)
      .flatMap((l) => (groupById.has(l.group_id) ? [groupById.get(l.group_id)!] : [])),
  }));

  const logoPath = (restaurant.data.qr_designs as { logo_path: string | null } | null)?.logo_path ?? null;
  const brandUrls = await signed(
    db,
    "photos",
    [logoPath, restaurant.data.cover_path].filter((p): p is string => Boolean(p)),
  );
  const header = readableOn(restaurant.data.brand_color);

  const palette = (theme.data?.palette ?? {}) as Partial<MenuData["theme"]["palette"]>;
  return {
    restaurantId,
    restaurantName: restaurant.data.name,
    defaultStyle: restaurant.data.default_menu_style,
    brand: {
      background: header.background,
      ink: header.ink,
      logoSrc: logoPath ? brandUrls.get(logoPath) : undefined,
      coverSrc: restaurant.data.cover_path ? brandUrls.get(restaurant.data.cover_path) : undefined,
    },
    theme: {
      palette: {
        ink: palette.ink ?? "#1E2B7E",
        paper: palette.paper ?? "#FFFFFF",
        accent: palette.accent ?? "#266AB2",
        muted: palette.muted ?? "#586187",
      },
      displayFont: theme.data?.display_font ?? "Playfair Display",
      bodyFont: theme.data?.body_font ?? "Josefin Sans",
      ornament: theme.data?.ornament ?? undefined,
      paperTexture: theme.data?.paper_texture ?? "none",
    },
    sections: (sections.data ?? []).map((s) => ({ id: s.id, nameEs: s.name_es, nameEn: s.name_en })),
    items: menuItems,
    pages: (pages.data ?? []).flatMap((p) => {
      const src = pageUrls.get(p.image_path);
      if (!src) return [];
      return [
        {
          src,
          width: p.width,
          height: p.height,
          hotspots: (hotspots.data ?? [])
            .filter((h) => h.page_id === p.id)
            .map((h) => ({
              itemId: h.item_id,
              x: Number(h.x),
              y: Number(h.y),
              width: Number(h.width),
              height: Number(h.height),
            })),
        },
      ];
    }),
    groups: groupList,
    photoPaths: Object.fromEntries(itemRows.map((i) => [i.id, i.photo_path])),
    sortOrder: { sections: (sections.data ?? []).map((s) => s.id) },
  };
}
