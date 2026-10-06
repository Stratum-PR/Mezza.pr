"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { Segmented } from "./controls";

export type ThemeChoice = "auto" | "light" | "dark";
const COOKIE = "mezza-theme"; // read by src/components/shell/document.tsx

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "auto") {
    delete root.dataset.theme;
    document.cookie = `${COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    root.dataset.theme = choice;
    document.cookie = `${COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  }
}

/** Automático / Claro / Oscuro. Saved in a cookie so the server renders the right theme next time. */
export function ThemeSwitch({
  initial,
  className,
  fill,
}: {
  initial: ThemeChoice;
  className?: string;
  fill?: boolean;
}) {
  const t = useTranslations("theme");
  const [value, setValue] = useState<ThemeChoice>(initial);
  return (
    <Segmented
      label={t("label")}
      value={value}
      className={className}
      fill={fill}
      onChange={(v) => {
        setValue(v);
        apply(v);
      }}
      options={(["auto", "light", "dark"] as const).map((v) => ({ value: v, label: t(v) }))}
    />
  );
}

/** One-button version for tight headers (the guest page): cycles auto → light → dark. */
export function ThemeCycle({ initial, className }: { initial: ThemeChoice; className?: string }) {
  const t = useTranslations("theme");
  const [value, setValue] = useState<ThemeChoice>(initial);
  const next: Record<ThemeChoice, ThemeChoice> = { auto: "light", light: "dark", dark: "auto" };
  const icon = { auto: "◐", light: "☀", dark: "☾" }[value];
  return (
    <button
      type="button"
      onClick={() => {
        const v = next[value];
        setValue(v);
        apply(v);
      }}
      aria-label={t("current", { mode: t(value) })}
      title={t(value)}
      className={cn(
        "grid size-8 place-items-center rounded-[9px] bg-current/15 text-base leading-none",
        className,
      )}
    >
      <span aria-hidden>{icon}</span>
    </button>
  );
}
