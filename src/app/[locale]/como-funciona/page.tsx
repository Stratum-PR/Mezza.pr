import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { isLocale } from "@/i18n/locales";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site.how");
  return { title: t("title") };
}

export default async function HowItWorksPage({ params }: PageProps<"/[locale]/como-funciona">) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : "es";
  const t = await getTranslations("site");
  const steps = t.raw("how.steps") as { title: string; body: string }[];
  return (
    <div className="container-site py-10 lg:py-14">
      <header className="mb-10 max-w-2xl">
        <h1 className="mb-3 text-[clamp(32px,3.6vw,46px)] font-extrabold tracking-[-0.03em]">
          {t("how.title")}
        </h1>
        <p className="text-[17px] leading-relaxed text-muted">{t("how.lead")}</p>
      </header>
      <ol className="grid max-w-3xl gap-4">
        {steps.map((s, i) => (
          <li key={s.title}>
            <Panel className="flex gap-5 p-6">
              <span className="grid size-11 shrink-0 place-items-center rounded-[12px] bg-soft text-lg font-extrabold text-accent">
                {i + 1}
              </span>
              <div>
                <h2 className="mb-1 text-xl font-bold">{s.title}</h2>
                <p className="leading-relaxed text-muted">{s.body}</p>
              </div>
            </Panel>
          </li>
        ))}
      </ol>
      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href={`/${locale}/registro`} size="lg">
          {t("hero.primary")}
        </ButtonLink>
        <ButtonLink href={`/${locale}/demo`} size="lg" variant="soft">
          {t("nav.demo")}
        </ButtonLink>
      </div>
    </div>
  );
}
