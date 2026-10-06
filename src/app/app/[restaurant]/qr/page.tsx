import { getTranslations } from "next-intl/server";
import { QrStudio } from "@/components/qr/qr-studio";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { loadQrStudio } from "@/lib/qr/load";

export default async function QrPage({ params }: PageProps<"/app/[restaurant]/qr">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "qr");
  const studio = await loadQrStudio(await createClient(), ctx.restaurant);
  const t = await getTranslations("qr");
  return (
    <div>
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <p className="mb-5 max-w-[65ch] text-muted">{t("lead")}</p>
      <QrStudio slug={restaurant} initial={studio.design} tables={studio.tables} />
    </div>
  );
}
