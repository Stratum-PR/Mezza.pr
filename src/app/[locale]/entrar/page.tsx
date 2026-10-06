import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { Link } from "@/i18n/navigation";
import { isLocale } from "@/i18n/locales";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

// Basic login so phase 3 route protection can be exercised; phase 5 adds signup and password reset.
export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/entrar">) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations("auth");
  return (
    <section className="container-site flex justify-center py-12 lg:py-20">
      <div className="w-full max-w-[440px] rounded-hero border border-line bg-surface p-6 shadow-hero sm:p-8">
        <h1 className="mb-2 text-3xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mb-6 text-muted">{t("lead")}</p>
        <LoginForm
          locale={isLocale(locale) ? locale : "es"}
          next={typeof query.next === "string" ? query.next : undefined}
          linkError={query.error === "link"}
        />
        <div className="mt-5 grid gap-1 text-center text-sm text-muted">
          <Link href="/recuperar" className="font-bold text-blue">
            {t("reset.forgot")}
          </Link>
          <p>
            {t("noAccount")}{" "}
            <Link href="/registro" className="font-bold text-blue">
              {t("createAccount")}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
