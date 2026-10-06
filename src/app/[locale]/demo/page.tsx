import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CAFE_LUCIA_MENU } from "@/components/menu/fixtures/cafe-lucia";
import { GuestMenu } from "@/components/menu/guest-menu";
import { menuMessages } from "@/components/menu/menu-messages";
import { QrSvg } from "@/components/qr/qr-svg";
import { DemoRequestForm } from "@/components/site/demo-request-form";
import { Panel } from "@/components/ui/surface";
import { isLocale } from "@/i18n/locales";
import { renderQr } from "@/lib/qr/render";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.demo");
  return { title: t("title") };
}

/** The live Café Lucía guest menu in demo mode (orders never reach a kitchen), a QR to open it on a
 *  phone, and the demo request form. */
export default async function DemoPage({ params }: PageProps<"/[locale]/demo">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "es";
  const t = await getTranslations("site.demo");
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const qr = renderQr(`${siteUrl}/${locale}/demo`, {
    fg: "#1E2B7E",
    bg: "#FFFFFF",
    dotStyle: "rounded",
    eyeStyle: "rounded",
    logoMode: "none",
  });

  return (
    <div className="container-site py-10 lg:py-14">
      <header className="mb-8 max-w-2xl">
        <h1 className="mb-3 text-[clamp(30px,3.4vw,42px)] font-extrabold leading-tight tracking-[-0.03em]">
          {t("title")}
        </h1>
        <p className="text-[17px] leading-relaxed text-muted">{t("lead")}</p>
      </header>
      <div className="grid items-start gap-8 md:grid-cols-[350px_minmax(0,1fr)]">
        <GuestMenu
          menu={CAFE_LUCIA_MENU}
          messages={await menuMessages()}
          initialLang={locale}
          tableLabel="4"
          framed
        />
        <div className="grid gap-6">
          <Panel title={t("tryTitle")}>
            <ol className="list-decimal space-y-2 pl-5 text-[15px] leading-relaxed">
              <li>{t("try1")}</li>
              <li>{t("try2")}</li>
              <li>{t("try3")}</li>
              <li>{t("try4")}</li>
            </ol>
          </Panel>
          <Panel className="flex flex-wrap items-center gap-5">
            <QrSvg render={qr} label={t("qrLabel")} className="size-36 shrink-0 rounded-lg" />
            <div className="min-w-[200px] flex-1">
              <h2 className="mb-1 text-lg font-extrabold">{t("qrTitle")}</h2>
              <p className="text-muted">{t("qrBody")}</p>
            </div>
          </Panel>
        </div>
      </div>

      <section id="solicitar" className="mt-16 max-w-3xl scroll-mt-28">
        <h2 className="mb-2 text-[clamp(26px,2.6vw,32px)] font-extrabold tracking-[-0.02em]">
          {t("requestTitle")}
        </h2>
        <p className="mb-6 text-muted">{t("requestLead")}</p>
        <Panel className="p-6 sm:p-8">
          <DemoRequestForm locale={locale} />
        </Panel>
      </section>
    </div>
  );
}
