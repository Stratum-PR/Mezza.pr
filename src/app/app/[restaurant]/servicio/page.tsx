import { getTranslations } from "next-intl/server";
import { ServiceScreen } from "@/components/staff/service-screen";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { loadMenu } from "@/lib/menu/load";
import { loadFloor } from "@/lib/staff/floor";

export default async function ServicePage({ params }: PageProps<"/app/[restaurant]/servicio">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "service");
  const db = await createClient();
  const [floor, menu] = await Promise.all([loadFloor(db, ctx.restaurant), loadMenu(db, ctx.restaurant.id)]);
  const t = await getTranslations("staff.service");
  return (
    <div>
      <h1 className="mb-1 text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <ServiceScreen
        slug={restaurant}
        floor={floor}
        menu={menu}
        canManage={ctx.role === "owner" || ctx.role === "manager"}
        realtimeImpl={process.env.MEZZA_REALTIME === "supabase_stub" ? "supabase_stub" : "polling"}
      />
    </div>
  );
}
