"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { MezzaWordmark, StratumMark } from "@/components/ui/brand";
import { cn } from "@/lib/cn";
import type { AppNavGroup, AppNavItem } from "./app-nav";
import { NAV_ICONS } from "./nav-icons";

export interface QuickItem {
  key: AppNavItem["key"];
  href: string;
  label: string;
  badge?: number;
}

/**
 * Staff navigation at every size:
 * - desktop (lg+): full grouped sidebar;
 * - tablet (md–lg): icon rail with short labels;
 * - phone: top bar with the menu button (opens the same grouped menu as a drawer) and a bottom bar
 *   with the person's main screens.
 * One nav element holds every link, so screen readers and tests see the same menu everywhere.
 */
export function AppFrame({
  groups,
  quick,
  exactHref,
  restaurantName,
  homeHref,
  labels,
  signOutAction,
  children,
}: {
  groups: AppNavGroup[];
  quick: QuickItem[];
  exactHref: string;
  restaurantName: string;
  homeHref: string;
  labels: { nav: string; quick: string; open: string; close: string; more: string; signOut: string };
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // The deepest matching link wins, so Servicio isn't lit up on Tomar orden (/servicio/orden).
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const isActive = (href: string) => {
    if (href === exactHref) return pathname === exactHref;
    if (!pathname.startsWith(href)) return false;
    return !allHrefs.some((h) => h !== href && h.startsWith(href) && pathname.startsWith(h));
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[92px_minmax(0,1fr)] lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* Phone: top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 pb-2.5 pt-[calc(10px+env(safe-area-inset-top))] backdrop-blur-[10px] md:hidden">
        <Link href={homeHref} className="text-ink">
          <MezzaWordmark byline={restaurantName} />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="app-drawer"
          aria-label={labels.open}
          className="grid size-11 place-items-center rounded-btn border border-line bg-surface text-ink"
        >
          {NAV_ICONS.more}
        </button>
      </header>

      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-40 bg-[rgba(10,14,40,.45)] md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        id="app-drawer"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[288px] max-w-[85vw] flex-col overflow-y-auto overflow-x-hidden border-r border-line bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] shadow-dialog transition-transform duration-200 motion-reduce:transition-none",
          "md:sticky md:top-0 md:z-auto md:h-dvh md:w-auto md:max-w-none md:translate-x-0 md:bg-bg md:px-2 md:py-5 md:shadow-none lg:px-4",
          open ? "translate-x-0" : "-translate-x-full max-md:invisible",
        )}
      >
        {/* Phone drawer header */}
        <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
          <MezzaWordmark byline={restaurantName} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={labels.close}
            className="grid size-10 place-items-center rounded-btn bg-soft text-ink"
          >
            {NAV_ICONS.close}
          </button>
        </div>
        {/* Tablet: mark only. Desktop: wordmark. */}
        <Link
          href={homeHref}
          className="hidden text-ink md:mb-4 md:grid md:place-items-center lg:block"
          aria-label="Mezza"
        >
          <span className="lg:hidden">
            <StratumMark className="h-8 w-11" />
          </span>
          <span className="hidden lg:block">
            <MezzaWordmark byline={restaurantName} />
          </span>
        </Link>

        <nav aria-label={labels.nav} className="grid gap-0.5">
          {groups.map((group, gi) => (
            <Fragment key={group.key}>
              <span
                aria-hidden
                className={cn(
                  "px-3 pb-1 text-[12px] font-bold text-muted md:hidden lg:block",
                  gi > 0 && "mt-4",
                )}
              >
                {group.label}
              </span>
              {gi > 0 && (
                <span aria-hidden className="mx-3 my-2 hidden border-t border-line md:block lg:hidden" />
              )}
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className={cn(
                      "relative flex min-h-11 items-center gap-3 rounded-btn px-3 text-[15px] font-bold",
                      "md:flex-col md:justify-center md:gap-1 md:px-1 md:py-2 md:text-center md:text-[11px] md:leading-tight",
                      "lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-0 lg:text-left lg:text-[15px]",
                      active ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-soft",
                    )}
                  >
                    {NAV_ICONS[item.key]}
                    <span className="min-w-0 truncate md:w-full lg:w-auto lg:flex-1">{item.label}</span>
                    {item.badge ? (
                      <span
                        aria-label={item.badgeLabel}
                        className={cn(
                          "tabular inline-grid min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-extrabold",
                          "md:absolute md:right-2 md:top-1 lg:static",
                          active ? "bg-accent-ink text-accent" : "bg-bad text-white",
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </Fragment>
          ))}
        </nav>

        <div className="mt-auto grid gap-2 pt-6">
          <form action={signOutAction}>
            <button
              type="submit"
              title={labels.signOut}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-btn border border-line bg-surface px-3 text-sm font-bold text-ink-2 lg:justify-start"
            >
              {NAV_ICONS.signOut}
              <span className="md:sr-only lg:not-sr-only">{labels.signOut}</span>
            </button>
          </form>
        </div>
      </aside>

      <main
        id="main"
        className="min-w-0 px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 md:px-6 md:pb-12 md:pt-7 lg:px-8"
      >
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      {/* Phone: the person's main screens, plus the full menu */}
      <nav
        aria-label={labels.quick}
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-[10px] md:hidden"
        style={{ gridTemplateColumns: `repeat(${quick.length + 1}, minmax(0, 1fr))` }}
      >
        {quick.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold",
                active ? "text-accent" : "text-muted",
              )}
            >
              {NAV_ICONS[item.key]}
              <span className="max-w-full truncate px-1">{item.label}</span>
              {item.badge ? (
                <span className="tabular absolute right-[calc(50%-22px)] top-1.5 min-w-4 rounded-full bg-bad px-1 text-[10px] text-white">
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-controls="app-drawer"
          aria-expanded={open}
          className="flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-muted"
        >
          {NAV_ICONS.more}
          {labels.more}
        </button>
      </nav>
    </div>
  );
}
