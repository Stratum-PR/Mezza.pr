import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { TakeOrder } from "@/components/staff/take-order";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { loadMenu } from "@/lib/menu/load";

/** "Tomar orden": the full-width order screen for tablets. */
export default async function TakeOrderPage({ params }: PageProps<"/app/[restaurant]/servicio/orden">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "service");
  const db = await createClient();
  const [menu, { data: tables }] = await Promise.all([
    loadMenu(db, ctx.restaurant.id),
    db.from("dining_tables").select("id, label").eq("restaurant_id", ctx.restaurant.id).order("sort_order"),
  ]);
  const t = await getTranslations("staff");
  const locale = (await getLocale()) === "en" ? "en" : "es";
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{t("service.takeOrder")}</h1>
        <Link
          href={`/app/${restaurant}/servicio`}
          className="font-bold text-accent underline-offset-2 hover:underline"
        >
          {t("take.back")}
        </Link>
      </div>
      <TakeOrder
        slug={restaurant}
        tables={tables ?? []}
        menu={menu}
        locale={locale}
        rates={{ stateBps: ctx.restaurant.ivu_state_bps, municipalBps: ctx.restaurant.ivu_municipal_bps }}
      />
    </div>
  );
}
