import { getTranslations } from "next-intl/server";
import { KitchenBoard } from "@/components/staff/kitchen-board";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { loadFloor } from "@/lib/staff/floor";

export default async function KitchenPage({ params }: PageProps<"/app/[restaurant]/cocina">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "kitchen");
  const db = await createClient();
  const [floor, { data: items }, { data: printer }] = await Promise.all([
    loadFloor(db, ctx.restaurant),
    db
      .from("menu_items")
      .select("id, name_es, is_available")
      .eq("restaurant_id", ctx.restaurant.id)
      .is("archived_at", null)
      .order("sort_order"),
    db
      .from("printers")
      .select("width_chars")
      .eq("restaurant_id", ctx.restaurant.id)
      .eq("role", "kitchen")
      .eq("active", true)
      .limit(1)
      .maybeSingle(),
  ]);
  const t = await getTranslations("staff.kitchen");
  return (
    <div>
      <h1 className="mb-3 text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <KitchenBoard
        slug={restaurant}
        restaurantName={ctx.restaurant.name}
        orders={floor.orders}
        items={(items ?? []).map((i) => ({ id: i.id, nameEs: i.name_es, isAvailable: i.is_available }))}
        realtimeImpl={process.env.MEZZA_REALTIME === "supabase_stub" ? "supabase_stub" : "polling"}
        widthChars={printer?.width_chars ?? 42}
      />
    </div>
  );
}
