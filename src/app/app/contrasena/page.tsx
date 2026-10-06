import { getTranslations } from "next-intl/server";
import { NewPasswordForm } from "@/components/auth/signup-forms";
import { MezzaWordmark } from "@/components/ui/brand";

/** Landing page of the password-reset link (the callback has already signed the user in). */
export default async function NewPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <main className="mx-auto max-w-[440px] px-4 py-16">
      <MezzaWordmark byline={(await getTranslations("common"))("byStratum")} />
      <h1 className="mb-6 mt-8 text-3xl font-extrabold tracking-[-0.03em]">{t("reset.newTitle")}</h1>
      <NewPasswordForm />
    </main>
  );
}
