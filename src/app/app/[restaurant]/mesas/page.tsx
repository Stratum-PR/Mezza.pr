import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FloorPlan, type TableState } from "@/components/staff/floor-plan";
import { LiveRefresh } from "@/components/staff/live-refresh";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { loadFloor } from "@/lib/staff/floor";

/** Every table with its state (free, ordering, paying, needs attention) and the live tab's total. */
export default async function TablesPage({ params }: PageProps<"/app/[restaurant]/mesas">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "tables");
  const floor = await loadFloor(await createClient(), ctx.restaurant);
  const t = await getTranslations("staff");
  const locale = (await getLocale()) === "en" ? "en" : "es";

  const attention = new Set([
    ...floor.requests.map((r) => r.tabId),
    ...floor.cashToCollect.map((p) => p.tabId),
    ...floor.posToClose.map((p) => p.tabId),
  ]);

  const stateOf = (tab: (typeof floor.tabs)[number] | undefined): TableState =>
    !tab ? "free" : attention.has(tab.id) ? "attention" : tab.status === "paying" ? "paying" : "open";

  return (
    <div>
      <h1 className="mb-1 text-[28px] font-extrabold tracking-[-0.02em]">{t("tables.title")}</h1>
      <p className="mb-4 text-sm text-muted">{t("tables.legend")}</p>
      <LiveRefresh
        slug={restaurant}
        impl={process.env.MEZZA_REALTIME === "supabase_stub" ? "supabase_stub" : "polling"}
      />
      {/* Tablets and desktops: the floor plan. Phones: the grid below. */}
      <div className="hidden md:block">
        <FloorPlan
          tables={floor.tables.map((table) => {
            const tab = floor.tabs.find((x) => x.tableId === table.id);
            return {
              id: table.id,
              label: table.label,
              seats: table.seats,
              area: table.area,
              shape: table.shape,
              x: table.pos_x === null ? null : Number(table.pos_x),
              y: table.pos_y === null ? null : Number(table.pos_y),
              state: stateOf(tab),
              total: tab ? formatCents(tab.totalWithIvuCents, locale) : undefined,
              href: tab ? `/app/${restaurant}/servicio` : undefined,
            };
          })}
        />
      </div>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 md:hidden">
        {floor.tables.map((table) => {
          const tab = floor.tabs.find((x) => x.tableId === table.id);
          const state = !tab
            ? "free"
            : attention.has(tab.id)
              ? "attention"
              : tab.status === "paying"
                ? "paying"
                : "open";
          const tile = (
            <>
              <b className="text-xl">{table.label}</b>
              <span className="text-sm font-semibold">{t(`tables.${state}`)}</span>
              {tab && <span className="tabular text-sm">{formatCents(tab.totalWithIvuCents, locale)}</span>}
            </>
          );
          const cls = cn(
            "grid min-h-24 content-center justify-items-center gap-0.5 rounded-card border-2 p-3 text-center",
            state === "free" && "border-line bg-surface text-muted",
            state === "open" && "border-blue bg-soft",
            state === "paying" && "border-warn bg-sandsoft",
            state === "attention" && "border-bad bg-surface",
          );
          return (
            <li key={table.id}>
              {tab ? (
                <Link
                  href={`/app/${restaurant}/servicio`}
                  className={cls}
                  aria-label={`${t("table", { label: table.label })} · ${t(`tables.${state}`)}`}
                >
                  {tile}
                </Link>
              ) : (
                <div className={cls}>{tile}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
