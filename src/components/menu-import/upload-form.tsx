"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { startImport, type ImportState } from "@/app/app/[restaurant]/menu/importar/actions";
import { Button } from "@/components/ui/button";

export function UploadForm({ slug }: { slug: string }) {
  const t = useTranslations("importer");
  const [state, action, pending] = useActionState(startImport.bind(null, slug), {} as ImportState);
  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-1.5 text-[13px] font-bold text-ink-2">
        {t("file")}
        <input
          type="file"
          name="menu"
          required
          accept="image/jpeg,image/png"
          className="min-h-11 text-sm font-normal file:mr-3 file:min-h-11 file:rounded-btn file:border-0 file:bg-soft file:px-4 file:font-bold file:text-ink"
        />
        <span className="font-normal text-muted">{t("fileHint")}</span>
      </label>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {t("upload")}
        </Button>
      </div>
    </form>
  );
}

/** Refreshes the server-rendered page until the importer is done. */
export function ProcessingRefresher() {
  const t = useTranslations("importer");
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3">
      <span aria-hidden className="size-5 animate-spin rounded-full border-[3px] border-line border-t-blue" />
      <span>
        <b className="block">{t("processing")}</b>
        <span className="text-sm text-muted">{t("processingHint")}</span>
      </span>
      <meta httpEquiv="refresh" content="2" />
    </div>
  );
}
