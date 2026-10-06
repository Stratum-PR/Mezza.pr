"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { publishOriginalImage, type ImportState } from "@/app/app/[restaurant]/menu/importar/actions";
import { Button } from "@/components/ui/button";

export function OriginalReview({
  slug,
  uploadId,
  src,
  width,
  height,
}: {
  slug: string;
  uploadId: string;
  src: string;
  width: number;
  height: number;
}) {
  const t = useTranslations("importer");
  const [state, action, pending] = useActionState(
    publishOriginalImage.bind(null, slug, uploadId),
    {} as ImportState,
  );
  return (
    <form action={action} className="grid max-w-3xl gap-4">
      <p>{t("imageOnlyNote")}</p>
      {/* Private signed image; preserve the actual uploaded picture. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        width={width}
        height={height}
        alt={t("sourcePage")}
        className="h-auto w-full rounded-md"
      />
      {state.error && (
        <p role="alert" className="text-bad">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {t("publishImage")}
        </Button>
      </div>
    </form>
  );
}
