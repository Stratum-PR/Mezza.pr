import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { LiveRefresh } from "@/components/staff/live-refresh";
import { TableDetail } from "@/components/staff/table-detail";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { loadTableDetail } from "@/lib/staff/table-detail";

/** One table: people, what each owes, payments, and the split-bill tools. */
export default async function TablePage({ params }: PageProps<"/app/[restaurant]/mesas/[table]">) {
  const { restaurant, table } = await params;
  const ctx = await requireSection(restaurant, "tables");
  const db = await createClient();
  await db.rpc("close_idle_tabs", { p_restaurant_id: ctx.restaurant.id });
  const detail = await loadTableDetail(db, ctx.restaurant.id, table);
  if (!detail) notFound();
  const t = await getTranslations("staff.tableDetail");
  const locale = (await getLocale()) === "en" ? "en" : "es";
  return (
    <div>
      <LiveRefresh
        slug={restaurant}
        impl={process.env.MEZZA_REALTIME === "supabase_stub" ? "supabase_stub" : "polling"}
      />
      {detail.tab ? (
        <TableDetail
          slug={restaurant}
          table={detail.table}
          tab={detail.tab}
          canManage={ctx.role === "owner" || ctx.role === "manager"}
          locale={locale}
          restaurantName={ctx.restaurant.name}
        />
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
              {t("title", { label: detail.table.label })}
            </h1>
            <Link
              href={`/app/${restaurant}/mesas`}
              className="font-bold text-accent underline-offset-2 hover:underline"
            >
              {t("back")}
            </Link>
          </div>
          <p className="text-muted">{t("free")}</p>
        </div>
      )}
    </div>
  );
}
