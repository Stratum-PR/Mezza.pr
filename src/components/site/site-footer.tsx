import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { StratumLogo } from "@/components/ui/brand";

/** navy-deep footer with the on-dark Stratum logo; links turn sand on hover. */
export async function SiteFooter() {
  const t = await getTranslations("site");
  const linkClass = "text-white hover:text-sand";
  return (
    <footer className="on-navy relative mt-24 bg-navy-deep text-white/75">
      <div className="container-site flex flex-col justify-between gap-12 pb-8 pt-14 md:flex-row">
        <div className="max-w-sm">
          <StratumLogo onDark className="h-[34px]" />
          <p className="mt-4 text-[13.5px] leading-relaxed">{t("footer.about")}</p>
        </div>
        <div className="flex flex-wrap gap-x-16 gap-y-8">
          <nav aria-label={t("footer.product")} className="flex flex-col gap-2.5 text-[14.5px] font-semibold">
            <span className="mb-1 text-[13px] font-bold text-white/60">{t("footer.product")}</span>
            <Link className={linkClass} href="/como-funciona">
              {t("nav.how")}
            </Link>
            <Link className={linkClass} href="/precios">
              {t("nav.pricing")}
            </Link>
            <Link className={linkClass} href="/demo">
              {t("nav.demo")}
            </Link>
          </nav>
          <nav aria-label={t("footer.legal")} className="flex flex-col gap-2.5 text-[14.5px] font-semibold">
            <span className="mb-1 text-[13px] font-bold text-white/60">{t("footer.legal")}</span>
            <Link className={linkClass} href="/legal/terminos">
              {t("footer.terms")}
            </Link>
            <Link className={linkClass} href="/legal/privacidad">
              {t("footer.privacy")}
            </Link>
            <Link className={linkClass} href="/legal/datos">
              {t("footer.dpa")}
            </Link>
          </nav>
        </div>
      </div>
      <div className="container-site border-t border-white/10 pb-[calc(28px+env(safe-area-inset-bottom))] pt-[18px] text-[13px]">
        {t("footer.copyright", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
