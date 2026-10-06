import { getTranslations } from "next-intl/server";
import { Fragment, type CSSProperties } from "react";
import { CAFE_LUCIA_MENU, CAFE_LUCIA_PRINTED } from "@/components/menu/fixtures/cafe-lucia";
import { GuestMenu } from "@/components/menu/guest-menu";
import { menuMessages } from "@/components/menu/menu-messages";
import { OrderCard } from "@/components/site/order-card";
import { Signature } from "@/components/site/signature";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { activePricingModel, pricing } from "@/config/pricing";
import { isLocale } from "@/i18n/locales";
import { formatCents } from "@/lib/money";

/**
 * Splits a headline into animated words. The space goes between the word spans, not inside them:
 * a trailing space inside an inline-block is dropped, which ran the words together on phones.
 */
function Words({ text }: { text: string }) {
  return text.split(" ").map((w, i) => (
    <Fragment key={i}>
      {i > 0 && " "}
      <span className="w" style={{ "--wi": i } as CSSProperties}>
        {w}
      </span>
    </Fragment>
  ));
}

function SectionHead({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="mx-auto mb-10 max-w-3xl text-center" data-m>
      <h2 className="text-[clamp(28px,3vw,36px)] font-extrabold leading-tight tracking-[-0.02em]">{title}</h2>
      {lead && <p className="mx-auto mt-4 max-w-[46em] text-[17px] leading-relaxed text-muted">{lead}</p>}
    </header>
  );
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "es";
  const t = await getTranslations("site");
  const messages = await menuMessages();
  const model = activePricingModel();
  const steps = t.raw("home.heroCard.steps") as { title: string; body: string }[];

  return (
    <>
      {/* 1. Hero */}
      <section className="container-site grid items-center gap-12 py-10 lg:min-h-[640px] lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:gap-16 lg:py-14">
        <div>
          <h1 className="hero-title mb-5 max-w-[12em] text-[clamp(38px,4.6vw,58px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
            <Words text={t("hero.title")} />
          </h1>
          <div className="hero-rise">
            <p className="mb-8 max-w-[32em] text-[clamp(17px,1.5vw,19px)] leading-[1.55] text-muted">
              {t("hero.lead")}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <ButtonLink href={`/${locale}/registro`} size="lg" className="w-full sm:w-auto">
                {t("hero.primary")}
              </ButtonLink>
              <ButtonLink
                href={`/${locale}/demo#solicitar`}
                size="lg"
                variant="soft"
                className="w-full sm:w-auto"
              >
                {t("hero.secondary")}
              </ButtonLink>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <GuestMenu menu={CAFE_LUCIA_MENU} messages={messages} initialLang={locale} tableLabel="4" framed />
          <div className="mt-4 w-full max-w-[350px] sm:-mt-24 sm:ml-[-140px] sm:w-auto lg:ml-[-220px]">
            <OrderCard
              label={t("home.heroCard.label")}
              steps={steps}
              pauseLabel={t("home.heroCard.pause")}
              playLabel={t("home.heroCard.play")}
            />
          </div>
        </div>
      </section>

      {/* 2. How it works, in three steps */}
      <section id="producto" className="container-site pt-24">
        <SectionHead title={t("home.steps.title")} lead={t("home.steps.lead")} />
        <ol className="grid gap-6 md:grid-cols-3">
          {(["s1", "s2", "s3"] as const).map((k, i) => (
            <li key={k} data-m style={{ "--d": i } as CSSProperties}>
              <Panel className="h-full p-7">
                <span className="mb-4 grid size-11 place-items-center rounded-[12px] bg-soft text-lg font-extrabold text-accent">
                  {i + 1}
                </span>
                <h3 className="mb-2 text-[19px] font-bold tracking-[-0.01em]">
                  {t(`home.steps.${k}.title`)}
                </h3>
                <p className="text-[15px] text-muted">{t(`home.steps.${k}.body`)}</p>
              </Panel>
            </li>
          ))}
        </ol>
      </section>

      {/* 3. The signature moment */}
      <section className="container-site pt-24">
        <SectionHead title={t("home.signature.title")} lead={t("home.signature.lead")} />
        <div className="rounded-[26px] border border-line bg-surface p-6 sm:p-10">
          <Signature
            beforeLabel={t("home.signature.before")}
            afterLabel={t("home.signature.after")}
            replayLabel={t("home.signature.replay")}
            page={
              // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL
              <img
                src={CAFE_LUCIA_MENU.pages[0]!.src}
                alt={t("home.signature.before")}
                width={CAFE_LUCIA_PRINTED.width}
                height={CAFE_LUCIA_PRINTED.height}
                className="block h-auto w-full"
              />
            }
            phone={
              <GuestMenu
                menu={CAFE_LUCIA_MENU}
                messages={messages}
                initialLang={locale}
                tableLabel="4"
                framed
              />
            }
          />
        </div>
      </section>

      {/* 4. Built for Puerto Rico */}
      <section className="container-site pt-24">
        <SectionHead title={t("home.pr.title")} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["ath", "#F58220"],
              ["ivu", "var(--navy)"],
              ["lang", "var(--blue)"],
              ["offline", "var(--olive)"],
            ] as const
          ).map(([k, color], i) => (
            <Panel key={k} className="p-6" data-m style={{ "--d": i } as CSSProperties}>
              <span
                aria-hidden
                className="mb-4 block h-1.5 w-10 rounded-full"
                style={{ background: color }}
              />
              <h3 className="mb-2 text-[17px] font-bold">{t(`home.pr.${k}.title`)}</h3>
              <p className="text-[14.5px] text-muted">{t(`home.pr.${k}.body`)}</p>
            </Panel>
          ))}
        </div>
      </section>

      {/* 5. Split the bill */}
      <section className="container-site pt-24">
        <div className="grid items-center gap-10 rounded-[26px] border border-line bg-surface p-6 sm:p-12 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div data-m>
            <h2 className="mb-4 text-[clamp(28px,3vw,34px)] font-extrabold leading-tight tracking-[-0.02em]">
              {t("home.split.title")}
            </h2>
            <p className="text-[16.5px] leading-relaxed text-muted">{t("home.split.lead")}</p>
          </div>
          <div className="rounded-card bg-bg p-2" data-m style={{ "--d": 1 } as CSSProperties}>
            <div className="overflow-hidden rounded-[14px] bg-surface">
              <div className="flex items-center justify-between border-b border-line-2 px-5 py-4">
                <b>Mesa 4</b>
                <span className="rounded-full bg-sandsoft px-2.5 py-1 text-xs font-bold text-olive">
                  {t("home.split.example")}
                </span>
              </div>
              {(
                [
                  [t("home.split.one"), formatCents(3150, locale), true],
                  [t("home.split.even"), `3 × ${formatCents(1050, locale)}`, false],
                  [
                    t("home.split.items"),
                    `${formatCents(1290, locale)} · ${formatCents(860, locale)} · ${formatCents(1000, locale)}`,
                    false,
                  ],
                ] as const
              ).map(([label, amount, on]) => (
                <div
                  key={label}
                  className={`flex items-center justify-between gap-3 border-b border-line-2 px-5 py-4 last:border-0 ${on ? "bg-soft" : ""}`}
                >
                  <span className="font-semibold">{label}</span>
                  <span className="tabular text-sm font-bold">{amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 6. For owners (labelled sample data) */}
      <section className="container-site pt-24">
        <SectionHead title={t("home.owners.title")} lead={t("home.owners.lead")} />
        <div className="grid gap-5 md:grid-cols-3" data-m>
          <div className="on-navy bg-gradient-brand rounded-card p-6 text-white shadow-[0_20px_50px_-18px_rgba(30,43,126,.55)]">
            <p className="text-sm font-semibold text-white/85">{t("home.owners.today")}</p>
            <p className="tabular mt-1 text-[40px] font-extrabold tracking-[-0.03em]">
              {formatCents(84250, locale)}
            </p>
            <p className="text-sm font-semibold text-sand">{t("home.owners.vsLastWeek")}</p>
          </div>
          <Panel className="p-6">
            <p className="mb-2 text-sm font-semibold text-muted">{t("home.owners.best")}</p>
            <ol className="grid gap-1.5 text-[15px]">
              {["Café con leche", "Mallorca", "Tripleta"].map((d, i) => (
                <li key={d} className="flex justify-between">
                  <span>
                    {i + 1}. {d}
                  </span>
                  <span className="tabular font-bold">{[64, 38, 21][i]}</span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel className="p-6">
            <p className="mb-2 text-sm font-semibold text-muted">{t("home.owners.ivu")}</p>
            <div className="tabular grid gap-1.5 text-[15px]">
              <div className="flex justify-between">
                <span>{t("home.owners.ivuState")}</span>
                <b>{formatCents(118_432, locale)}</b>
              </div>
              <div className="flex justify-between">
                <span>{t("home.owners.ivuMunicipal")}</span>
                <b>{formatCents(11_279, locale)}</b>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted">{t("home.owners.example")}</p>
          </Panel>
        </div>
      </section>

      {/* 7. Pricing summary and guided setup */}
      <section className="container-site pt-24">
        <SectionHead title={t("home.pricing.title")} />
        <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
          <Panel className="p-7" data-m>
            {model.kind === "base_plus_card" && (
              <>
                <p className="tabular text-[44px] font-extrabold tracking-[-0.03em]">
                  {formatCents(model.monthlyCents, locale)}
                  <span className="ml-1.5 text-base font-semibold text-muted">{t("home.pricing.month")}</span>
                </p>
                <p className="font-semibold">
                  {t("home.pricing.plusCard", { percent: model.cardFeeBps / 100 })}
                </p>
              </>
            )}
            <p className="mt-2 text-sm text-muted">{t("home.pricing.athFree")}</p>
            <p className="mt-4 rounded-btn bg-ok-bg px-3 py-2 text-sm font-semibold text-ok">
              {t("home.pricing.trial")}
            </p>
          </Panel>
          <Panel className="p-7" data-m style={{ "--d": 1 } as CSSProperties}>
            <h3 className="mb-2 text-xl font-extrabold">{t("home.pricing.guided")}</h3>
            <p className="text-muted">
              {t("home.pricing.guidedBody", { price: formatCents(pricing.guidedSetupCents, locale) })}
            </p>
            <ButtonLink href={`/${locale}/precios`} variant="soft" className="mt-5">
              {t("home.pricing.seePricing")}
            </ButtonLink>
          </Panel>
        </div>
      </section>

      {/* 8. Pilot restaurant quotes: hidden until real quotes exist (no invented social proof). */}

      {/* 9. FAQ */}
      <section className="container-site pt-24">
        <SectionHead title={t("home.faq.title")} />
        <div className="mx-auto grid max-w-3xl gap-3">
          {(["1", "2", "3", "4"] as const).map((n) => (
            <details key={n} className="group rounded-card border border-line bg-surface px-6 py-1" data-m>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-bold">
                {t(`home.faq.q${n}`)}
                <span aria-hidden className="text-xl text-muted transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 text-[15.5px] leading-relaxed text-muted">{t(`home.faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Closing band (the FSQMS signup band: gradient + rotated sand diamond) */}
      <section className="container-site pt-24">
        <div className="on-navy bg-gradient-brand relative overflow-hidden rounded-band px-6 py-14 text-center text-white sm:px-16">
          <span
            aria-hidden
            className="absolute -right-16 -top-16 size-64 rotate-45 rounded-[56px] bg-[rgba(230,224,158,.16)]"
          />
          <h2 className="relative mb-3 text-[clamp(28px,3.2vw,38px)] font-extrabold tracking-[-0.02em]">
            {t("home.cta.title")}
          </h2>
          <p className="relative mx-auto mb-8 max-w-[38em] text-[17px] text-white/90">{t("home.cta.lead")}</p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <ButtonLink href={`/${locale}/registro`} variant="sand" size="lg">
              {t("hero.primary")}
            </ButtonLink>
            <ButtonLink
              href={`/${locale}/demo#solicitar`}
              size="lg"
              className="bg-white/15 text-white shadow-none hover:bg-white/25"
            >
              {t("hero.secondary")}
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}
