import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetRequestForm } from "@/components/auth/signup-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

export default async function ResetPage() {
  const t = await getTranslations("auth.reset");
  return (
    <section className="container-site flex justify-center py-12 lg:py-20">
      <div className="w-full max-w-[440px] rounded-hero border border-line bg-surface p-6 shadow-hero sm:p-8">
        <h1 className="mb-2 text-3xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
        <p className="mb-6 text-muted">{t("lead")}</p>
        <ResetRequestForm />
      </div>
    </section>
  );
}
