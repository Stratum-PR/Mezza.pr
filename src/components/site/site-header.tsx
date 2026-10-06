"use client";

import NextLink from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { buttonClass } from "@/components/ui/button";
import { MezzaWordmark } from "@/components/ui/brand";
import { cn } from "@/lib/cn";
import { ThemeCycle, type ThemeChoice } from "@/components/ui/theme-switch";
import { SiteLangToggle } from "./lang-toggle";

const LINKS = [
  { href: "/#producto", key: "product" },
  { href: "/como-funciona", key: "how" },
  { href: "/precios", key: "pricing" },
  { href: "/demo", key: "demo" },
] as const;

/** Sticky, translucent header like the FSQMS site; collapses into a menu below 1024 px. */
export function SiteHeader({ theme = "auto" }: { theme?: ThemeChoice }) {
  const t = useTranslations("site.nav");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-bg/90 pt-[env(safe-area-inset-top)] backdrop-blur-[10px] backdrop-saturate-[1.4]">
      <div className="container-site flex h-[68px] items-center gap-6 lg:h-[84px]">
        <Link href="/" className="text-ink" aria-label="Mezza">
          <MezzaWordmark byline={tc("byStratum")} />
        </Link>

        <nav
          id="site-menu"
          aria-label={t("label")}
          className={cn(
            "absolute inset-x-0 top-full flex-col gap-0 border-b border-line bg-bg px-[var(--gutter)] pb-5 pt-2",
            "lg:static lg:ml-auto lg:flex lg:flex-row lg:items-center lg:gap-7 lg:border-0 lg:bg-transparent lg:p-0",
            open ? "flex" : "hidden",
          )}
        >
          {LINKS.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              onClick={() => setOpen(false)}
              className="border-b border-line-2 py-3.5 text-[15px] font-semibold text-ink-2 hover:text-accent lg:border-0 lg:py-0"
            >
              {t(l.key)}
            </Link>
          ))}
          {/* /app has no locale prefix, so this uses next/link rather than the locale-aware Link. */}
          <NextLink
            href="/app"
            className="border-b border-line-2 py-3.5 text-[15px] font-semibold text-ink-2 hover:text-accent lg:border-0 lg:py-0"
          >
            {t("login")}
          </NextLink>
          <Link href="/registro" className={cn(buttonClass(), "mt-4 lg:mt-0")}>
            {t("cta")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <ThemeCycle
            initial={theme}
            className="size-11 rounded-btn border border-line bg-surface text-ink"
          />
          <SiteLangToggle />
          <button
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex size-11 flex-col items-center justify-center gap-[5px] rounded-btn border border-line bg-surface lg:hidden"
          >
            <span className="sr-only">{open ? t("closeMenu") : t("openMenu")}</span>
            <span
              className={cn(
                "block h-0.5 w-5 rounded bg-ink transition-transform",
                open && "translate-y-[7px] rotate-45",
              )}
            />
            <span className={cn("block h-0.5 w-5 rounded bg-ink transition-opacity", open && "opacity-0")} />
            <span
              className={cn(
                "block h-0.5 w-5 rounded bg-ink transition-transform",
                open && "-translate-y-[7px] -rotate-45",
              )}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
