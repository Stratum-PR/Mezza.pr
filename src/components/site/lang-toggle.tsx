"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, type Locale } from "@/i18n/locales";
import { cn } from "@/lib/cn";

/** ES/EN switch for the marketing site; keeps the current page. */
export function SiteLangToggle() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t("language")} className="inline-flex rounded-[10px] bg-line p-[3px]">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          disabled={pending}
          onClick={() => startTransition(() => router.replace(pathname, { locale: l }))}
          className={cn(
            "min-h-9 min-w-10 rounded-lg px-2.5 text-[13px] font-bold uppercase",
            l === locale ? "bg-surface text-accent shadow-[0_1px_3px_rgba(22,32,79,.15)]" : "text-muted",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
