import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { activePricingModel, monthlyFee, pricing } from "@/config/pricing";
import { isLocale } from "@/i18n/locales";
import { formatCents } from "@/lib/money";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.pricing");
  return { title: t("title") };
}

export default async function PricingPage({ params }: PageProps<"/[locale]/precios">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "es";
  const t = await getTranslations("site.pricing");
  const model = activePricingModel();
  const percent = model.kind === "base_plus_card" ? model.cardFeeBps / 100 : 0;
  const example = { card: 300_000, ath: 150_000, cash: 200_000 };

  return (
    <div className="container-site py-10 lg:py-14">
      <header className="mb-10 max-w-2xl">
        <h1 className="mb-3 text-[clamp(32px,3.6vw,46px)] font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="text-[17px] leading-relaxed text-muted">{t("lead")}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel className="p-8">
          <h2 className="text-lg font-bold text-muted">{t("plan")}</h2>
          {model.kind === "base_plus_card" && (
            <>
              <p className="tabular mt-1 text-[52px] font-extrabold tracking-[-0.03em]">
                {formatCents(model.monthlyCents, locale)}
                <span className="ml-1.5 text-lg font-semibold text-muted">{t("month")}</span>
              </p>
              <p className="text-lg font-semibold">{t("plusCard", { percent })}</p>
            </>
          )}
          <h3 className="mb-2 mt-6 font-bold">{t("includes")}</h3>
          <ul className="grid gap-2">
            {(t.raw("features") as string[]).map((f) => (
              <li key={f} className="flex gap-2.5 text-[15px]">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ok-bg text-xs font-bold text-ok"
                >
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-6 rounded-btn bg-ok-bg px-3 py-2 text-sm font-semibold text-ok">{t("trial")}</p>
          <ButtonLink href={`/${locale}/registro`} size="lg" className="mt-5">
            {t("start")}
          </ButtonLink>
        </Panel>

        <div className="grid content-start gap-6">
          <Panel className="p-7">
            <h2 className="mb-1 text-xl font-extrabold">{t("guided")}</h2>
            <p className="text-muted">{t("guidedBody")}</p>
            <p className="tabular mt-3 text-2xl font-extrabold">
              {t("guidedPrice", { price: formatCents(pricing.guidedSetupCents, locale) })}
            </p>
            <ButtonLink href={`/${locale}/demo#solicitar`} variant="soft" className="mt-4">
              {t("guidedCta")}
            </ButtonLink>
          </Panel>
          <Panel className="p-7">
            <h2 className="mb-1 text-xl font-extrabold">{t("exampleTitle")}</h2>
            <p className="text-muted">
              {t("exampleBody", {
                card: formatCents(example.card, locale),
                ath: formatCents(example.ath, locale),
                cash: formatCents(example.cash, locale),
                fee: formatCents(monthlyFee(example.card), locale),
                percent,
              })}
            </p>
          </Panel>
        </div>
      </div>

      <section className="mt-16 max-w-3xl">
        <h2 className="mb-4 text-2xl font-extrabold">{t("faqTitle")}</h2>
        <div className="grid gap-3">
          {(["1", "2", "3", "4"] as const).map((n) => (
            <details key={n} className="group rounded-card border border-line bg-surface px-6 py-1">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-bold">
                {t(`q${n}`)}
                <span aria-hidden className="text-xl text-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 leading-relaxed text-muted">{t(`a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
