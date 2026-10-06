import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { HomeView } from "@/components/reports/home-view";
import { LiveRefresh } from "@/components/staff/live-refresh";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { dayLabel } from "@/lib/reports/format";
import { loadToday } from "@/lib/reports/today";

/** Inicio: today against the same day last week, payments, IVU, open tables and what needs attention. */
export default async function InicioPage({ params }: PageProps<"/app/[restaurant]">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "home");
  // Owners resume onboarding until they finish it.
  if (ctx.role === "owner" && ctx.restaurant.onboarding_step < 7) redirect(`/app/${restaurant}/empezar`);
  const t = await getTranslations("home");
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const today = await loadToday(await createClient(), ctx.restaurant);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        <p className="text-sm text-muted">{dayLabel(today.date, locale, true)}</p>
      </div>
      <LiveRefresh
        slug={restaurant}
        impl={process.env.MEZZA_REALTIME === "supabase_stub" ? "supabase_stub" : "polling"}
      />
      <HomeView today={today} slug={restaurant} locale={locale} />
    </div>
  );
}
