import { getLocale, getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { monthLabel } from "@/lib/reports/format";
import { addDays, localParts } from "@/lib/reports/time";

const selectClass =
  "min-h-11 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base text-ink focus:border-sky focus:outline-none";

export default async function ExportPage({ params }: PageProps<"/app/[restaurant]/exportar">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "export");
  const t = await getTranslations("exports");
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const db = await createClient();

  // This month and the 11 before it; last month is the default (the one usually being filed).
  const thisMonth = localParts(new Date(), ctx.restaurant.timezone).ymd.slice(0, 7);
  const months = [thisMonth];
  while (months.length < 12) months.push(addDays(`${months.at(-1)}-01`, -1).slice(0, 7));
  const [{ data: past }, { data: people }] = await Promise.all([
    db
      .from("exports")
      .select("id, kind, period, created_at, created_by")
      .eq("restaurant_id", ctx.restaurant.id)
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("profiles").select("user_id, full_name"),
  ]);
  const who = new Map((people ?? []).map((p) => [p.user_id, p.full_name ?? ""]));
  const action = `/app/${restaurant}/exportar/descargar`;
  const when = new Intl.DateTimeFormat(locale === "es" ? "es-PR" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ctx.restaurant.timezone,
  });

  const monthSelect = (id: string) => (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
      {t("month")}
      <select id={id} name="month" defaultValue={months[1]} className={selectClass}>
        {months.map((m) => (
          <option key={m} value={m}>
            {monthLabel(m, locale)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="grid gap-4">
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("ivu.title")}>
          <p className="mb-2 text-sm text-ink-2">{t("ivu.description")}</p>
          <p className="mb-4 rounded-lg bg-sandsoft px-3 py-2 text-sm text-olive">{t("ivu.disclaimer")}</p>
          <form action={action} className="flex flex-wrap items-end gap-2">
            {monthSelect("ivu-month")}
            <button type="submit" name="kind" value="ivu_monthly_pdf" className={buttonClass({ size: "md" })}>
              {t("pdf")}
            </button>
            <button
              type="submit"
              name="kind"
              value="ivu_monthly_csv"
              className={buttonClass({ variant: "soft", size: "md" })}
            >
              {t("csv")}
            </button>
          </form>
        </Panel>
        <Panel title={t("sales.title")}>
          <p className="mb-4 text-sm text-ink-2">{t("sales.description")}</p>
          <form action={action} className="flex flex-wrap items-end gap-2">
            {monthSelect("sales-month")}
            <button type="submit" name="kind" value="sales_xlsx" className={buttonClass({ size: "md" })}>
              {t("xlsx")}
            </button>
            <button
              type="submit"
              name="kind"
              value="sales_csv"
              className={buttonClass({ variant: "soft", size: "md" })}
            >
              {t("csv")}
            </button>
          </form>
        </Panel>
      </div>

      <Panel title={t("past.title")}>
        {past?.length ? (
          <ul className="divide-y divide-line-2">
            {past.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {t(`kinds.${e.kind}`)}
                    {e.period && /^\d{4}-\d{2}$/.test(e.period) && (
                      <span className="font-normal text-ink-2"> · {monthLabel(e.period, locale)}</span>
                    )}
                  </p>
                  <p className="text-sm text-muted">
                    {when.format(new Date(e.created_at))}
                    {e.created_by && who.get(e.created_by) ? ` · ${who.get(e.created_by)}` : ""}
                  </p>
                </div>
                <a
                  href={`/app/${restaurant}/exportar/archivo/${e.id}`}
                  className={buttonClass({ variant: "ghost", size: "sm" })}
                >
                  {t("past.download")}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("past.none")}</p>
        )}
      </Panel>
    </div>
  );
}
