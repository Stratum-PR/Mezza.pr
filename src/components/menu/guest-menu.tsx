"use client";

import { createTranslator } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/cn";
import { ItemSheet, type CartLine } from "./item-sheet";
import { menuFontStack, menuFontVariables } from "./menu-fonts";
import { HouseMenu, OriginalMenu, SimpleMenu, type MenuT } from "./menu-styles";
import { pick, type MenuData, type MenuItem, type MenuLocale, type MenuStyle } from "./types";
import "./menu.css";

type MenuMessages = Record<string, unknown>;

/** Live ordering (the real guest page). Without it the menu runs as the website demo. */
export interface LiveMode {
  /** localStorage key for the cart, per table. */
  storageKey: string;
  controlled?: { cart: CartLine[]; change: (cart: CartLine[]) => void; disabled: boolean };
  send: (
    cart: CartLine[],
    lang: MenuLocale,
    t: MenuT,
  ) => Promise<{ ok: true; message: string } | { ok: false; message: string }>;
  /** Extra UI from the page: actions above the menu, a screen that replaces it, and footer buttons. */
  render: (ctx: { lang: MenuLocale; t: MenuT; say: (message: string) => void }) => {
    top?: ReactNode;
    screen?: ReactNode;
    footer?: ReactNode;
  };
}

/**
 * The guest menu: navy header with the ES/EN switch, the three styles, section chips, the dish sheet
 * and the order. One component for the guest page, the editor preview and the website demo.
 * In pass 1's demo the order stays on the device and "Enviar a cocina" goes nowhere.
 */
export function GuestMenu({
  menu,
  messages,
  initialLang,
  tableLabel,
  framed = false,
  className,
  live,
  headerExtra,
}: {
  menu: MenuData;
  messages: Record<MenuLocale, MenuMessages>;
  initialLang: MenuLocale;
  tableLabel?: string;
  framed?: boolean;
  className?: string;
  live?: LiveMode;
  /** Extra control in the header, e.g. the light/dark toggle on the real guest page. */
  headerExtra?: ReactNode;
}) {
  const [lang, setLang] = useState<MenuLocale>(initialLang);
  const [style, setStyle] = useState<MenuStyle>(menu.defaultStyle);
  const [open, setOpen] = useState<MenuItem | null>(null);
  const [localCart, setLocalCart] = useState<CartLine[]>([]);
  const cart = live?.controlled?.cart ?? localCart;
  function setCart(next: CartLine[] | ((prev: CartLine[]) => CartLine[])) {
    if (live?.controlled) {
      if (live.controlled.disabled) return;
      live.controlled.change(typeof next === "function" ? next(cart) : next);
    } else setLocalCart(next);
  }
  const [showOrder, setShowOrder] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLElement>(null);

  // The section chips follow the scroll: the last heading above the sticky chips is the active one.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || style === "original") return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = box.getBoundingClientRect().top + (chipsRef.current?.offsetHeight ?? 0) + 12;
        let current: string | null = null;
        for (const h of box.querySelectorAll<HTMLElement>("[data-section]")) {
          if (h.getBoundingClientRect().top <= top) current = h.dataset.section ?? null;
        }
        setActiveSection(current);
      });
    };
    onScroll();
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener("scroll", onScroll);
    };
  }, [style, menu]);
  useEffect(() => {
    const nav = chipsRef.current;
    const chip = activeSection ? nav?.querySelector<HTMLElement>(`[data-chip="${activeSection}"]`) : null;
    if (nav && chip) nav.scrollTo({ left: chip.offsetLeft - 16, behavior: "smooth" });
  }, [activeSection]);

  // Live mode keeps the cart on the device, per table, so a reload or a lost connection keeps it.
  const storageKey = live?.controlled ? undefined : live?.storageKey;
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (saved) setLocalCart(JSON.parse(saved) as CartLine[]);
    } catch {
      // Storage unavailable (private mode): the cart just isn't kept.
    }
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [storageKey, cart]);

  const t = useMemo(
    () =>
      createTranslator({
        locale: lang,
        messages: { menu: messages[lang] },
        namespace: "menu",
      }) as unknown as MenuT,
    [lang, messages],
  );

  const say = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((m) => (m === msg ? null : m)), 2600);
  }, []);

  const count = cart.reduce((n, l) => n + l.qty, 0);
  const subtotal = cart.reduce((s, l) => s + l.qty * l.unitCents, 0);
  const vars = {
    "--m-ink": menu.theme.palette.ink,
    "--m-paper": menu.theme.palette.paper,
    "--m-accent": menu.theme.palette.accent,
    "--m-muted": menu.theme.palette.muted,
    "--m-display": menuFontStack(menu.theme.displayFont),
    "--m-body": menuFontStack(menu.theme.bodyFont),
    // The restaurant's colour on the header and main buttons (readableOn already checked contrast).
    ...(menu.brand && { "--accent": menu.brand.background, "--accent-ink": menu.brand.ink }),
  } as React.CSSProperties;

  function addLine(line: CartLine) {
    if (live?.controlled?.disabled) return;
    setCart((prev) => {
      const same = prev.find((l) => l.key === line.key);
      return same
        ? prev.map((l) => (l === same ? { ...l, qty: Math.min(99, l.qty + line.qty) } : l))
        : [...prev, line];
    });
    setOpen(null);
    say(t("added", { name: lang === "es" ? line.nameEs : line.nameEn }));
  }

  /** Dishes without required choices go straight into the cart; the rest open the sheet. */
  function quickAdd(item: MenuItem) {
    if (live?.controlled?.disabled) return;
    if (item.modifierGroups.some((g) => g.min > 0)) {
      setOpen(item);
      return;
    }
    addLine({
      key: `${item.id}||`,
      itemId: item.id,
      nameEs: item.nameEs,
      nameEn: item.nameEn,
      qty: 1,
      unitCents: item.priceCents,
      optionIds: [],
      optionsEs: [],
      optionsEn: [],
    });
  }

  function changeQty(key: string, delta: number) {
    setCart((c) =>
      c.flatMap((l) =>
        l.key !== key ? [l] : l.qty + delta <= 0 ? [] : [{ ...l, qty: Math.min(99, l.qty + delta) }],
      ),
    );
  }

  async function sendToKitchen() {
    if (!live) {
      setShowOrder(false);
      setCart([]);
      say(t("demoSent"));
      return;
    }
    setSending(true);
    setSendError(null);
    try {
      const result = await live.send(cart, lang, t);
      if (result.ok) {
        if (!live.controlled) setCart([]);
        setShowOrder(false);
        say(result.message);
      } else {
        setSendError(result.message);
      }
    } finally {
      setSending(false);
    }
  }

  const extra = live?.render({ lang, t, say });
  const styles: MenuStyle[] = ["house", "original", "simple"];
  const Body = style === "house" ? HouseMenu : style === "original" ? OriginalMenu : SimpleMenu;

  return (
    <div
      role="region"
      aria-label={menu.restaurantName}
      lang={lang}
      style={vars}
      className={cn(
        menuFontVariables,
        "relative flex flex-col overflow-hidden bg-surface text-ink",
        framed &&
          "mx-auto h-[680px] w-full max-w-[350px] rounded-[36px] border-[9px] border-[#16204F] shadow-hero",
        className,
      )}
    >
      {menu.brand?.coverSrc && (
        // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
        <img src={menu.brand.coverSrc} alt="" className="h-24 w-full shrink-0 object-cover" />
      )}
      <header
        className="on-navy bg-navy px-4 pb-2.5 pt-3 text-white"
        style={menu.brand ? { background: menu.brand.background, color: menu.brand.ink } : undefined}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            {menu.brand?.logoSrc && (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img
                src={menu.brand.logoSrc}
                alt=""
                className="size-8 shrink-0 rounded-full bg-white object-contain"
              />
            )}
            <b className="truncate text-lg">{menu.restaurantName}</b>
          </span>
          <div className="flex items-center gap-1.5">
            {headerExtra}
            <div
              role="group"
              aria-label={t("languageLabel")}
              className="flex gap-0.5 rounded-[9px] bg-current/15 p-0.5"
            >
              {(["es", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  lang={l}
                  aria-pressed={lang === l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "min-h-8 min-w-9 rounded-[7px] px-2 text-xs font-bold uppercase",
                    lang === l ? "bg-sand text-navy" : "text-current",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>
        {tableLabel && <small className="text-[13px] opacity-85">{t("table", { label: tableLabel })}</small>}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 pt-3">
        {extra?.top}
        {extra?.screen ? (
          extra.screen
        ) : (
          <>
            <div role="group" aria-label={t("styleLabel")} className="mb-2.5 flex gap-1.5 overflow-x-auto">
              {styles.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={style === s}
                  onClick={() => setStyle(s)}
                  className={cn(
                    "min-h-9 whitespace-nowrap rounded-full border px-3 text-sm font-semibold",
                    style === s ? "border-blue bg-soft text-blue" : "border-line text-ink",
                  )}
                >
                  {t(`styles.${s}`)}
                </button>
              ))}
            </div>

            {style !== "original" && (
              <nav
                ref={chipsRef}
                aria-label={t("sectionsLabel")}
                className="sticky -top-3 z-10 -mx-3.5 mb-2 flex gap-1.5 overflow-x-auto bg-surface px-3.5 py-1.5"
              >
                {menu.sections.map((s) => {
                  const on = activeSection === s.id;
                  return (
                    <a
                      key={s.id}
                      data-chip={s.id}
                      href={`#${style === "house" ? "sec" : "sim"}-${s.id}`}
                      aria-current={on ? "location" : undefined}
                      className={cn(
                        "inline-flex min-h-8 items-center whitespace-nowrap rounded-full px-3 text-[13px] font-semibold",
                        on ? "bg-accent text-accent-ink" : "bg-soft text-ink",
                      )}
                    >
                      {pick(s, lang)}
                    </a>
                  );
                })}
              </nav>
            )}

            <div className={cn(style === "house" && "-mx-3.5")}>
              <Body menu={menu} lang={lang} t={t} onOpen={setOpen} onQuickAdd={quickAdd} />
            </div>
          </>
        )}
        <div className="h-4" />
      </div>

      {(count > 0 || extra?.footer) && !extra?.screen && (
        <div className="grid gap-2 border-t border-line bg-surface px-3.5 py-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
          {extra?.footer}
          {count > 0 && (
            <button
              type="button"
              onClick={() => setShowOrder(true)}
              className="tabular min-h-12 w-full rounded-btn bg-accent font-bold text-accent-ink shadow-btn"
            >
              {t("viewOrder", { count, price: formatCents(subtotal, lang) })}
            </button>
          )}
        </div>
      )}

      <div
        role="status"
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute inset-x-3 bottom-20 z-30 rounded-xl bg-ink px-3 py-2.5 text-sm text-bg transition-[opacity,transform]",
          toast && !showOrder && !open ? "opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        {toast}
      </div>

      {open && <ItemSheet item={open} lang={lang} t={t} onAdd={addLine} onClose={() => setOpen(null)} />}

      {showOrder && (
        <div
          className="absolute inset-0 z-20 flex items-end bg-[rgba(10,14,40,.5)]"
          onClick={() => setShowOrder(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("yourOrder")}
            className="max-h-[88%] w-full overflow-y-auto rounded-t-[18px] bg-surface p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">{t("yourOrder")}</h2>
              <button
                type="button"
                onClick={() => setShowOrder(false)}
                aria-label={t("close")}
                className="grid size-10 place-items-center rounded-[10px] bg-soft text-xl leading-none"
              >
                ×
              </button>
            </div>
            {cart.length === 0 ? (
              <p className="text-muted">{t("emptyOrder")}</p>
            ) : (
              <ul>
                {cart.map((l) => {
                  const name = lang === "es" ? l.nameEs : l.nameEn;
                  const opts = (lang === "es" ? l.optionsEs : l.optionsEn).join(", ");
                  return (
                    <li
                      key={l.key}
                      className="flex items-start justify-between gap-3 border-b border-line py-2.5"
                    >
                      <span className="min-w-0">
                        <b>{name}</b>
                        {opts && <small className="block text-muted">{opts}</small>}
                        {l.note && <small className="block text-muted">“{l.note}”</small>}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="tabular font-bold">{formatCents(l.qty * l.unitCents, lang)}</span>
                        <span className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => changeQty(l.key, -1)}
                            aria-label={l.qty === 1 ? t("remove", { name }) : t("decreaseItem", { name })}
                            className="grid size-9 place-items-center rounded-full border border-line font-bold"
                          >
                            {l.qty === 1 ? "×" : "−"}
                          </button>
                          <span className="tabular min-w-5 text-center font-bold">{l.qty}</span>
                          <button
                            type="button"
                            onClick={() => changeQty(l.key, 1)}
                            aria-label={t("increaseItem", { name })}
                            className="grid size-9 place-items-center rounded-full border border-line font-bold"
                          >
                            +
                          </button>
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="tabular mt-3 flex justify-between font-bold">
              <span>{t("subtotal")}</span>
              <span>{formatCents(subtotal, lang)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">{t("ivuNote")}</p>
            {sendError && (
              <p role="alert" className="mt-3 text-sm font-semibold text-bad">
                {sendError}
              </p>
            )}
            <button
              type="button"
              disabled={cart.length === 0 || sending || live?.controlled?.disabled}
              onClick={sendToKitchen}
              className="mt-3 min-h-12 w-full rounded-btn bg-accent font-bold text-accent-ink shadow-btn disabled:opacity-50"
            >
              {sending ? t("flow.sending") : t("sendToKitchen")}
            </button>
            <button
              type="button"
              onClick={() => setShowOrder(false)}
              className="mt-2 min-h-11 w-full rounded-btn bg-soft font-bold text-ink"
            >
              {t("keepOrdering")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
