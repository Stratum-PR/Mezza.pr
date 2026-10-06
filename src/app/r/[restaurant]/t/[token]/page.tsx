import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { VisitGuestApp } from "@/components/bills/visit-guest-app";
import { splitWorkflowEnabled } from "@/lib/bills/feature";
import { GuestApp } from "@/components/guest/guest-app";
import { readThemeChoice } from "@/components/shell/document";
import { menuMessages } from "@/components/menu/menu-messages";
import { LOCALE_COOKIE, isLocale } from "@/i18n/locales";
import { createAdminClient } from "@/lib/db/admin";
import { resolveTable } from "@/lib/guest/resolve";
import { loadMenu } from "@/lib/menu/load";

export const metadata: Metadata = { title: "Mezza", robots: { index: false, follow: false } };

/**
 * The guest page a table QR opens. The token is resolved on the server; no Supabase client ships to
 * the guest's phone, and every action re-resolves the token.
 */
export default async function GuestTablePage({ params }: PageProps<"/r/[restaurant]/t/[token]">) {
  const { restaurant, token } = await params;
  const g = await resolveTable(restaurant, token);

  if (!g) {
    const t = await getTranslations("guest");
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col">
        <header className="on-navy bg-navy px-4 pb-3 pt-[calc(14px+env(safe-area-inset-top))] text-white">
          <b className="text-lg">Mezza</b>
        </header>
        <div className="p-5">
          <h1 className="text-xl font-extrabold">{t("invalidTitle")}</h1>
          <p className="mt-2 text-muted">{t("invalidBody")}</p>
        </div>
      </main>
    );
  }

  // A code printed under an older restaurant link: send the guest to the current one.
  if (g.restaurant.slug !== restaurant) redirect(`/r/${g.restaurant.slug}/t/${token}`);

  const menu = await loadMenu(createAdminClient(), g.restaurant.id);
  // The guest's language: their remembered choice, else the restaurant's default.
  const remembered = (await cookies()).get(LOCALE_COOKIE)?.value;
  const lang = isLocale(remembered) ? remembered : g.restaurant.defaultLanguage;

  if (splitWorkflowEnabled())
    return (
      <VisitGuestApp
        slug={g.restaurant.slug}
        token={token}
        tableLabel={g.table.label}
        menu={menu}
        messages={await menuMessages()}
        initialLang={lang}
      />
    );
  return (
    <GuestApp
      slug={g.restaurant.slug}
      token={token}
      restaurantId={g.restaurant.id}
      tableId={g.table.id}
      tableLabel={g.table.label}
      menu={menu}
      messages={await menuMessages()}
      initialLang={lang}
      rates={{ stateBps: g.restaurant.ivuStateBps, municipalBps: g.restaurant.ivuMunicipalBps }}
      realtimeImpl={process.env.MEZZA_REALTIME === "supabase_stub" ? "supabase_stub" : "polling"}
      queueImpl={process.env.MEZZA_ORDER_QUEUE === "offline_stub" ? "offline_stub" : "online"}
      theme={await readThemeChoice()}
    />
  );
}
