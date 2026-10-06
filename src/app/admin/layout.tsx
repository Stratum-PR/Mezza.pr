import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Document } from "@/components/shell/document";
import { MezzaWordmark } from "@/components/ui/brand";
import { resolveLocale } from "@/i18n/request";
import { requirePlatformAdmin } from "@/lib/auth/staff";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Mezza admin" },
  robots: { index: false, follow: false },
};

/** Stratum admin root layout (/admin): platform admins only; everyone else gets a 404. */
export default async function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  await requirePlatformAdmin();
  const locale = await resolveLocale();
  const t = await getTranslations({ locale, namespace: "admin" });
  return (
    <Document locale={locale}>
      <div className="mx-auto max-w-[1200px] px-4 pb-12 pt-[calc(18px+env(safe-area-inset-top))]">
        <header className="flex items-center justify-between gap-3 border-b border-line pb-4">
          <MezzaWordmark byline={t("title")} />
        </header>
        <main id="main" className="pt-5">
          {children}
        </main>
      </div>
    </Document>
  );
}
