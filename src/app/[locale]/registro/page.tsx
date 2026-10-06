import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "@/components/auth/signup-forms";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/locales";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("title") };
}

/** Onboarding step 1 (account): creates the user and the restaurant, then opens the wizard. */
export default async function SignupPage({ params }: PageProps<"/[locale]/registro">) {
  const { locale } = await params;
  const t = await getTranslations("auth.signup");
  return (
    <section className="container-site flex justify-center py-12 lg:py-16">
      <div className="w-full max-w-[480px] rounded-hero border border-line bg-surface p-6 shadow-hero sm:p-8">
        <h1 className="mb-1 text-3xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mb-6 font-semibold text-ok">{t("lead")}</p>
        <SignupForm locale={isLocale(locale) ? locale : "es"} />
        <p className="mt-5 text-center text-sm text-muted">
          {t("haveAccount")}{" "}
          <Link href="/entrar" className="font-bold text-blue">
            {t("login")}
          </Link>
        </p>
      </div>
    </section>
  );
}
