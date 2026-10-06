import { readThemeChoice } from "@/components/shell/document";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Document } from "@/components/shell/document";
import { SiteFooter } from "@/components/site/site-footer";
import { MotionRoot } from "@/components/site/motion-root";
import { SiteHeader } from "@/components/site/site-header";
import { LOCALES, isLocale } from "@/i18n/locales";
import "../globals.css";
import "@/components/site/site.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.hero");
  return {
    title: { default: "Mezza", template: "%s · Mezza" },
    description: t("lead"),
    // Pre-launch, as on the FSQMS site.
    robots: { index: false, follow: false },
  };
}

/** Marketing site root layout (/es, /en): texture, sticky header, navy footer. */
export default async function SiteLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations("common");

  return (
    <Document locale={locale} bodyClassName="relative overflow-x-hidden">
      <div className="site-texture" aria-hidden />
      <a
        href="#main"
        className="absolute -top-16 left-4 z-[100] rounded-[10px] bg-navy px-4 py-2.5 font-bold text-white focus:top-3"
      >
        {t("skipToContent")}
      </a>
      <SiteHeader theme={await readThemeChoice()} />
      <main id="main" className="relative">
        {children}
      </main>
      <SiteFooter />
      <MotionRoot />
    </Document>
  );
}
