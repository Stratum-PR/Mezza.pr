import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { menuImporter } from "@/connectors/menu-import";
import { isNotImplemented, mocksAllowed } from "@/connectors/shared";
import { ReviewScreen } from "@/components/menu-import/review-screen";
import { ProcessingRefresher } from "@/components/menu-import/upload-form";
import { ComingSoon, Panel } from "@/components/ui/surface";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { readOriginalUpload } from "@/lib/menu/original";
import { OriginalReview } from "@/components/menu-import/original-review";

export default async function ImportReviewPage({
  params,
}: PageProps<"/app/[restaurant]/menu/importar/[upload]">) {
  const { restaurant, upload } = await params;
  const ctx = await requireSection(restaurant, "menu");
  const t = await getTranslations("importer");
  const tc = await getTranslations("common");

  if (!mocksAllowed()) {
    const db = await createClient();
    let original: Awaited<ReturnType<typeof readOriginalUpload>>;
    let src: string | null = null;
    try {
      original = await readOriginalUpload(db, ctx.restaurant.id, upload);
      if (original) {
        const signed = await db.storage.from("menus").createSignedUrl(original.storage_path, 3600);
        if (signed.error) throw new Error("original image signing failed");
        src = signed.data?.signedUrl ?? null;
      }
    } catch {
      return (
        <p role="alert" className="text-bad">
          {t("errors.image_load")}
        </p>
      );
    }
    if (!original) notFound();
    return (
      <div>
        <Link href={`/app/${restaurant}/menu`} className="text-sm font-bold text-blue">
          {t("back")}
        </Link>
        <h1 className="my-4 text-[28px] font-extrabold">{t("imageReviewTitle")}</h1>
        {src ? (
          <OriginalReview
            slug={restaurant}
            uploadId={upload}
            src={src}
            width={original.width}
            height={original.height}
          />
        ) : (
          <p role="alert" className="text-bad">
            {t("errors.image_load")}
          </p>
        )}
      </div>
    );
  }

  let state: Awaited<ReturnType<ReturnType<typeof menuImporter>["result"]>>;
  try {
    state = await menuImporter().result(
      { restaurantId: ctx.restaurant.id, actorUserId: ctx.userId, locale: "es" },
      upload,
    );
  } catch (error) {
    if (isNotImplemented(error))
      return <ComingSoon title={tc("comingSoon")} body={t("errors.coming_soon")} />;
    throw error;
  }
  if (state.status === "failed" && state.error === "upload_not_found") notFound();

  let pageUrl: string | null = null;
  if (state.status === "review" && state.result.pages[0]) {
    const db = await createClient();
    const { data } = await db.storage.from("menus").createSignedUrl(state.result.pages[0].storagePath, 3600);
    pageUrl = data?.signedUrl ?? null;
  }

  return (
    <div>
      <Link href={`/app/${restaurant}/menu`} className="text-sm font-bold text-blue">
        ← {t("back")}
      </Link>
      <h1 className="mt-2 text-[28px] font-extrabold tracking-[-0.02em]">
        {state.status === "review" ? t("reviewTitle") : t("title")}
      </h1>
      {state.status === "review" && <p className="mb-5 max-w-[70ch] text-muted">{t("reviewLead")}</p>}
      {state.status === "processing" && (
        <Panel className="mt-4 max-w-xl">
          <ProcessingRefresher />
        </Panel>
      )}
      {state.status === "failed" && (
        <p role="alert" className="mt-4 font-semibold text-bad">
          {t("errors.failed")}
        </p>
      )}
      {state.status === "review" && (
        <ReviewScreen slug={restaurant} uploadId={upload} result={state.result} pageUrl={pageUrl} />
      )}
    </div>
  );
}
