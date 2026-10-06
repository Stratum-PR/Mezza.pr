"use client";

import { useState } from "react";
import { formatCents, formatPlain } from "@/lib/money";
import { cn } from "@/lib/cn";
import { illustrationDataUrl } from "./illustrations";
import { describe, pick, type MenuData, type MenuItem, type MenuLocale } from "./types";

export type MenuT = (key: string, values?: Record<string, string | number>) => string;

interface StyleProps {
  menu: MenuData;
  lang: MenuLocale;
  t: MenuT;
  onOpen: (item: MenuItem) => void;
  /** Adds a dish with no required choices straight to the cart; others open the sheet. */
  onQuickAdd?: (item: MenuItem) => void;
}

export function DishPhoto({ item, className }: { item: MenuItem; className?: string }) {
  if (!item.photo) return null;
  const src = item.photo.kind === "illustration" ? illustrationDataUrl(item.photo.key) : item.photo.src;
  // eslint-disable-next-line @next/next/no-img-element -- data URLs and signed storage URLs
  return <img src={src} alt="" className={cn("block size-full object-cover", className)} />;
}

/** Vegetariano / Sin gluten / Picante: small text chips (never colour alone). */
export function DishTags({ item, t, className }: { item: MenuItem; t: MenuT; className?: string }) {
  if (!item.tags?.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {item.tags.map((tag) => (
        <span key={tag} className="rounded-full bg-ok-bg px-1.5 py-px text-[11px] font-bold text-ok">
          {t(`tags.${tag}`)}
        </span>
      ))}
    </span>
  );
}

function itemsBySection(menu: MenuData) {
  return menu.sections
    .map((s) => ({ section: s, items: menu.items.filter((i) => i.sectionId === s.id) }))
    .filter((g) => g.items.length > 0);
}

/** "De la casa": rebuilt for phones in the restaurant's own style. */
export function HouseMenu({ menu, lang, t, onOpen }: StyleProps) {
  return (
    <div className="mz-house">
      <h2 className="mz-house-name">{menu.restaurantName}</h2>
      {menu.tagline && <p className="mz-house-tagline">{menu.tagline[lang]}</p>}
      <div className="mz-ornament" aria-hidden>
        <i />
        {menu.theme.ornament ?? "◆"}
        <i />
      </div>
      {itemsBySection(menu).map(({ section, items }) => (
        <section key={section.id} aria-labelledby={`sec-${section.id}`}>
          <h3 id={`sec-${section.id}`} data-section={section.id} className="mz-house-section">
            {pick(section, lang)}
          </h3>
          {items.map((item) => {
            const out = !item.isAvailable;
            return (
              <button
                key={item.id}
                type="button"
                className="mz-house-item"
                aria-disabled={out || undefined}
                onClick={() => !out && onOpen(item)}
              >
                <span className="mz-house-thumb" aria-hidden>
                  <DishPhoto item={item} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mz-house-line">
                    <span className="mz-house-dish">{pick(item, lang)}</span>
                    <span className="mz-dots" aria-hidden />
                    <span className="mz-house-price">{formatPlain(item.priceCents)}</span>
                  </span>
                  <span className="mz-house-desc">
                    {out ? <span className="mz-house-soldout">{t("soldOut")} · </span> : null}
                    {describe(item, lang)}
                  </span>
                </span>
              </button>
            );
          })}
        </section>
      ))}
      {menu.footer && <p className="mz-house-footer">{menu.footer[lang]}</p>}
    </div>
  );
}

/** "Original": the printed page itself, with tap zones. */
export function OriginalMenu({ menu, lang, t, onOpen }: StyleProps) {
  const [zones, setZones] = useState(false);
  const byId = new Map(menu.items.map((i) => [i.id, i]));
  if (menu.originalError)
    return (
      <p role="alert" className="py-6 text-muted">
        {t("originalLoadError")}
      </p>
    );
  if (menu.pages.length === 0)
    return (
      <p role="status" className="py-6 text-muted">
        {t("originalEmpty")}
      </p>
    );
  const hasHotspots = menu.pages.some((page) => page.hotspots.length > 0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{t(hasHotspots ? "tapHint" : "originalImageHint")}</p>
        {hasHotspots && (
          <button
            type="button"
            aria-pressed={zones}
            onClick={() => setZones((z) => !z)}
            className={cn(
              "min-h-9 shrink-0 rounded-full border px-3 text-xs font-semibold",
              zones ? "border-blue bg-soft text-blue" : "border-line text-ink",
            )}
          >
            {zones ? t("hideZones") : t("showZones")}
          </button>
        )}
      </div>
      {menu.pages.map((page, i) => (
        <div
          key={page.src}
          className={cn(
            "relative overflow-hidden rounded-md shadow-[0_0_0_1px_var(--line)]",
            zones && "mz-zones",
          )}
          style={{ aspectRatio: `${page.width} / ${page.height}`, containerType: "inline-size" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- printed page, data or signed URL */}
          <img src={page.src} alt={`${menu.restaurantName} · ${i + 1}`} className="block size-full" />
          {page.hotspots.map((h) => {
            const item = byId.get(h.itemId);
            if (!item) return null;
            const out = !item.isAvailable;
            const box = {
              left: `${h.x * 100}%`,
              top: `${h.y * 100}%`,
              width: `${h.width * 100}%`,
              height: `${h.height * 100}%`,
            };
            return (
              <div key={h.itemId}>
                {out && (
                  <span className="mz-stamp" style={{ ...box, inset: "auto" }}>
                    <span>{t("soldOut")}</span>
                  </span>
                )}
                <button
                  type="button"
                  className="mz-hot"
                  style={box}
                  aria-label={`${pick(item, lang)} · ${out ? t("soldOut") : formatCents(item.priceCents, lang)}`}
                  aria-disabled={out || undefined}
                  onClick={() => !out && onOpen(item)}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** "Simple": a clean list in Mezza's own style, with photos and a quick "+" per dish. */
export function SimpleMenu({ menu, lang, t, onOpen, onQuickAdd }: StyleProps) {
  return (
    <div>
      {itemsBySection(menu).map(({ section, items }) => (
        <section key={section.id} aria-labelledby={`sim-${section.id}`} className="mb-4">
          <h3
            id={`sim-${section.id}`}
            data-section={section.id}
            className="mb-1 mt-2 scroll-mt-14 text-base font-extrabold"
          >
            {pick(section, lang)}
          </h3>
          {items.map((item) => {
            const out = !item.isAvailable;
            return (
              <div
                key={item.id}
                className={cn("flex items-center gap-2 border-b border-line", out && "opacity-50")}
              >
                <button
                  type="button"
                  aria-disabled={out || undefined}
                  onClick={() => !out && onOpen(item)}
                  className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 text-left"
                >
                  {item.photo && (
                    <span className="size-14 shrink-0 overflow-hidden rounded-xl bg-soft" aria-hidden>
                      <DishPhoto item={item} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">
                      {pick(item, lang)}
                      {out && (
                        <span className="ml-1.5 inline-flex rounded-full bg-sandsoft px-2 py-px align-[1px] text-[11px] font-bold text-olive">
                          {t("soldOut")}
                        </span>
                      )}
                    </span>
                    <DishTags item={item} t={t} className="my-0.5" />
                    <span className="line-clamp-2 block text-[13px] leading-snug text-muted">
                      {describe(item, lang)}
                    </span>
                    <span className="tabular mt-0.5 block font-bold">
                      {formatCents(item.priceCents, lang)}
                    </span>
                  </span>
                </button>
                {onQuickAdd && !out && (
                  <button
                    type="button"
                    onClick={() => onQuickAdd(item)}
                    aria-label={t("quickAdd", { name: pick(item, lang) })}
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-xl font-bold leading-none text-accent-ink shadow-btn"
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
