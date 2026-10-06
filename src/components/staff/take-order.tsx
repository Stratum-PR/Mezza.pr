"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ItemSheet, type CartLine } from "@/components/menu/item-sheet";
import { DishPhoto, DishTags, type MenuT } from "@/components/menu/menu-styles";
import { pick, type MenuData, type MenuItem } from "@/components/menu/types";
import { Button } from "@/components/ui/button";
import { newClientOrderId } from "@/connectors/orders";
import { flags } from "@/config/flags";
import { cn } from "@/lib/cn";
import { participantLabel } from "@/lib/guest/names";
import { computeIvu, formatCents } from "@/lib/money";
import { staffPlaceOrder } from "@/lib/staff/actions";

/**
 * Tablet-first order taking for guests who don't scan: dishes as photo cards with − / + on the left,
 * the table's ticket with IVU on the right. Sends through staffPlaceOrder (same rules as QR orders).
 */
export function TakeOrder({
  slug,
  tables,
  people,
  menu,
  locale,
  rates,
}: {
  slug: string;
  tables: { id: string; label: string }[];
  /** People at each table's live tab, by table id. */
  people: Record<string, { id: string; number: number; name: string | null }[]>;
  menu: MenuData;
  locale: "es" | "en";
  rates: { stateBps: number; municipalBps: number };
}) {
  const t = useTranslations("staff.take");
  const ts = useTranslations("staff");
  const tm = useTranslations("menu") as unknown as MenuT;
  const [tableId, setTableId] = useState<string | null>(null);
  const [forId, setForId] = useState<string | null>(null); // null: the whole table
  const tablePeople = (tableId && people[tableId]) || [];
  const [section, setSection] = useState<string | null>(null);
  const [ticket, setTicket] = useState<CartLine[]>([]);
  const [sheet, setSheet] = useState<MenuItem | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const orderId = useRef<string | null>(null);
  const money = (c: number) => formatCents(c, locale);

  const items = menu.items.filter((i) => !section || i.sectionId === section);
  const qtyOf = (itemId: string) => ticket.filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0);
  const subtotal = ticket.reduce((s, l) => s + l.qty * l.unitCents, 0);
  const ivu = computeIvu(subtotal, rates);

  function add(line: CartLine) {
    setTicket((prev) => {
      const same = prev.find((l) => l.key === line.key);
      return same
        ? prev.map((l) => (l === same ? { ...l, qty: Math.min(99, l.qty + line.qty) } : l))
        : [...prev, line];
    });
    setSheet(null);
  }

  function plus(item: MenuItem) {
    if (!item.isAvailable) return;
    if (item.modifierGroups.length > 0) return setSheet(item);
    add({
      key: item.id,
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

  /** Removes one from a line (by key), or from the item's most recent line. */
  function minus(match: { key?: string; itemId?: string }) {
    setTicket((prev) => {
      const idx = match.key
        ? prev.findIndex((l) => l.key === match.key)
        : prev.findLastIndex((l) => l.itemId === match.itemId);
      if (idx < 0) return prev;
      const l = prev[idx]!;
      return l.qty > 1
        ? prev.map((x, i) => (i === idx ? { ...x, qty: x.qty - 1 } : x))
        : prev.filter((_, i) => i !== idx);
    });
  }

  /** "Para compartir" on a ticket line, merging with an identical line. */
  function toggleShared(key: string) {
    setTicket((c) => {
      const line = c.find((l) => l.key === key);
      if (!line) return c;
      const base = key.replace(/\|shared$/, "");
      const next = { ...line, shared: !line.shared || undefined, key: line.shared ? base : `${base}|shared` };
      const twin = c.find((l) => l.key === next.key);
      return twin
        ? c
            .filter((l) => l !== line)
            .map((l) => (l === twin ? { ...l, qty: Math.min(99, l.qty + line.qty) } : l))
        : c.map((l) => (l === line ? next : l));
    });
  }

  function send() {
    if (!tableId || ticket.length === 0) return;
    orderId.current ??= newClientOrderId(); // reused on retries: one order per send
    const id = orderId.current;
    start(async () => {
      const r = await staffPlaceOrder(
        slug,
        tableId,
        id,
        ticket.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          modifierOptionIds: l.optionIds,
          note: l.note,
          shared: l.shared,
        })),
        forId,
      );
      if (r.ok) {
        orderId.current = null;
        setTicket([]);
        setMessage({ ok: true, text: ts("service.sent", { number: r.number ?? 0 }) });
      } else {
        if (r.error !== "failed") orderId.current = null;
        setMessage({ ok: false, text: ts(`errors.${r.error}`) });
      }
    });
  }

  const chip = (on: boolean) =>
    cn(
      "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-bold",
      on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2",
    );

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-label={t("dishes")} className="min-w-0">
        <div role="tablist" aria-label={t("sections")} className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            role="tab"
            aria-selected={!section}
            onClick={() => setSection(null)}
            className={chip(!section)}
          >
            {t("all")} <span className="tabular text-xs opacity-80">{menu.items.length}</span>
          </button>
          {menu.sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              onClick={() => setSection(s.id)}
              className={chip(section === s.id)}
            >
              {pick(s, locale)}{" "}
              <span className="tabular text-xs opacity-80">
                {menu.items.filter((i) => i.sectionId === s.id).length}
              </span>
            </button>
          ))}
        </div>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {items.map((item) => {
            const qty = qtyOf(item.id);
            const name = pick(item, locale);
            return (
              <li
                key={item.id}
                className={cn(
                  "flex flex-col overflow-hidden rounded-card border bg-surface",
                  qty > 0 ? "border-accent" : "border-line",
                  !item.isAvailable && "opacity-50",
                )}
              >
                <div className="h-24 bg-soft" aria-hidden>
                  <DishPhoto item={item} />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <p className="font-bold leading-tight">{name}</p>
                  <DishTags item={item} t={tm} />
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="tabular font-extrabold">{money(item.priceCents)}</span>
                    {!item.isAvailable ? (
                      <span className="text-xs font-bold text-olive">{tm("soldOut")}</span>
                    ) : qty === 0 ? (
                      <button
                        type="button"
                        onClick={() => plus(item)}
                        aria-label={t("add", { name })}
                        className="grid size-10 place-items-center rounded-full bg-accent text-xl font-bold text-accent-ink"
                      >
                        +
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => minus({ itemId: item.id })}
                          aria-label={t("less", { name })}
                          className="grid size-9 place-items-center rounded-full border border-line font-bold"
                        >
                          −
                        </button>
                        <span className="tabular min-w-5 text-center font-bold">{qty}</span>
                        <button
                          type="button"
                          onClick={() => plus(item)}
                          aria-label={t("add", { name })}
                          className="grid size-9 place-items-center rounded-full bg-accent font-bold text-accent-ink"
                        >
                          +
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside
        aria-label={t("ticket")}
        className="relative grid min-w-0 gap-3 overflow-hidden rounded-card border border-line bg-surface p-4 lg:sticky lg:top-6"
      >
        <div>
          <p className="mb-1.5 text-sm font-bold">{ts("service.chooseTable")}</p>
          <div role="group" aria-label={ts("service.chooseTableHint")} className="flex flex-wrap gap-1.5">
            {tables.map((tb) => (
              <button
                key={tb.id}
                type="button"
                aria-pressed={tableId === tb.id}
                onClick={() => {
                  setTableId(tb.id);
                  setForId(null);
                }}
                className={cn(
                  "min-h-11 min-w-11 rounded-[8px] border px-2 font-bold",
                  tableId === tb.id ? "border-accent bg-accent text-accent-ink" : "border-line",
                )}
              >
                {tb.label}
              </button>
            ))}
          </div>
        </div>
        {flags.sharedTab && tablePeople.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-bold">{t("forLabel")}</p>
            <p className="mb-1.5 text-xs text-muted">{t("forHint")}</p>
            <div role="group" aria-label={t("forLabel")} className="flex flex-wrap gap-1.5">
              {[null, ...tablePeople].map((p) => (
                <button
                  key={p?.id ?? "table"}
                  type="button"
                  aria-pressed={forId === (p?.id ?? null)}
                  onClick={() => setForId(p?.id ?? null)}
                  className={cn(
                    "min-h-11 rounded-[8px] border px-3 text-sm font-bold",
                    forId === (p?.id ?? null) ? "border-accent bg-accent text-accent-ink" : "border-line",
                  )}
                >
                  {p ? participantLabel(p, (number) => t("guest", { number })) : t("forTable")}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="border-t border-line pt-3">
          {ticket.length === 0 ? (
            <p className="text-sm text-muted">{ts("service.ticketEmpty")}</p>
          ) : (
            <ul className="grid gap-2">
              {ticket.map((l) => {
                const name = locale === "es" ? l.nameEs : l.nameEn;
                return (
                  <li key={l.key} className="flex items-start justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      <b className="block">{name}</b>
                      {l.optionsEs.length > 0 && (
                        <small className="block text-muted">
                          {(locale === "es" ? l.optionsEs : l.optionsEn).join(", ")}
                        </small>
                      )}
                      <span className="tabular text-muted">
                        {l.qty} × {money(l.unitCents)}
                      </span>
                      {flags.sharedTab && (
                        <label className="mt-1 flex min-h-8 cursor-pointer items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={!!l.shared}
                            onChange={() => toggleShared(l.key)}
                            aria-label={t("sharedItem", { name })}
                            className="size-4 accent-[var(--blue)]"
                          />
                          {t("shared")}
                        </label>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => minus({ key: l.key })}
                        aria-label={ts("service.remove", { name })}
                        className="grid size-8 place-items-center rounded-full border border-line"
                      >
                        −
                      </button>
                      <b className="tabular w-16 text-right">{money(l.qty * l.unitCents)}</b>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <dl className="tabular grid gap-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">{t("subtotal")}</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("ivuState", { rate: rates.stateBps / 100 })}</dt>
            <dd>{money(ivu.state)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">{t("ivuMunicipal", { rate: rates.municipalBps / 100 })}</dt>
            <dd>{money(ivu.municipal)}</dd>
          </div>
          <div className="flex justify-between text-base font-extrabold">
            <dt>{t("total")}</dt>
            <dd>{money(subtotal + ivu.total)}</dd>
          </div>
        </dl>
        <Button size="lg" block disabled={!tableId || ticket.length === 0 || pending} onClick={send}>
          {ts("service.send")}
          {ticket.length > 0 && ` · ${money(subtotal)}`}
        </Button>
        {!tableId && ticket.length > 0 && <p className="text-sm text-warn">{t("pickTable")}</p>}
        <p
          role="status"
          aria-live="polite"
          className={cn("min-h-5 text-sm font-semibold", message?.ok === false ? "text-bad" : "text-ok")}
        >
          {message?.text}
        </p>
        {sheet && (
          <ItemSheet
            item={sheet}
            lang={locale}
            t={tm}
            onAdd={add}
            onClose={() => setSheet(null)}
            canShare={flags.sharedTab}
          />
        )}
      </aside>
    </div>
  );
}
