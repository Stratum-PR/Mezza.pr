import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { UploadForm } from "@/components/menu-import/upload-form";
import { Panel } from "@/components/ui/surface";
import { requireSection } from "@/lib/auth/staff";

export default async function ImportPage({ params }: PageProps<"/app/[restaurant]/menu/importar">) {
  const { restaurant } = await params;
  await requireSection(restaurant, "menu");
  const t = await getTranslations("importer");
  return (
    <div className="max-w-2xl">
      <Link href={`/app/${restaurant}/menu`} className="text-sm font-bold text-blue">
        ← {t("back")}
      </Link>
      <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <p className="mb-5 text-muted">{t("lead")}</p>
      <Panel>
        <UploadForm slug={restaurant} />
      </Panel>
    </div>
  );
}
