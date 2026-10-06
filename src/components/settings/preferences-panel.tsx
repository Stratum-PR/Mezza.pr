"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/ui/surface";
import { ThemeSwitch, type ThemeChoice } from "@/components/ui/theme-switch";

const LOCALE_COOKIE = "NEXT_LOCALE"; // src/i18n/locales.ts

/** This device's look and language: theme (cookie mezza-theme) and app language (cookie NEXT_LOCALE). */
export function PreferencesPanel({ theme, locale }: { theme: ThemeChoice; locale: "es" | "en" }) {
  const t = useTranslations("settings.preferences");
  const router = useRouter();
  const [lang, setLang] = useState(locale);
  return (
    <Panel title={t("title")}>
      <p className="mb-3 text-sm text-muted">{t("lead")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink-2">{t("theme")}</span>
          <ThemeSwitch initial={theme} />
        </div>
        <div className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink-2">{t("language")}</span>
          <Segmented
            label={t("language")}
            value={lang}
            onChange={(v) => {
              setLang(v);
              document.cookie = `${LOCALE_COOKIE}=${v}; path=/; max-age=31536000; samesite=lax`;
              router.refresh();
            }}
            options={[
              { value: "es", label: "Español" },
              { value: "en", label: "English" },
            ]}
          />
        </div>
      </div>
    </Panel>
  );
}
