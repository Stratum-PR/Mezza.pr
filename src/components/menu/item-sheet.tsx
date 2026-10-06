"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatCents } from "@/lib/money";
import { cn } from "@/lib/cn";
import { DishPhoto, DishTags, type MenuT } from "./menu-styles";
import { describe, pick, type MenuItem, type MenuLocale, type ModifierGroup } from "./types";

export interface CartLine {
  key: string;
  itemId: string;
  nameEs: string;
  nameEn: string;
  qty: number;
  unitCents: number;
  optionIds: string[];
  optionsEs: string[];
  optionsEn: string[];
  note?: string;
  /** "Para compartir": split among the people at the table who have ordered. */
  shared?: boolean;
}

function groupHint(g: ModifierGroup, t: MenuT): string {
  if (g.min === g.max) return t("chooseExactly", { count: g.max });
  if (g.min === 0) return t("chooseUpTo", { count: g.max });
  return t("chooseRange", { min: g.min, max: g.max });
}

/** Bottom sheet for one dish: photo, description, modifier groups (min/max enforced), quantity, note. */
export function ItemSheet({
  item,
  lang,
  t,
  onAdd,
  onClose,
  canShare = false,
}: {
  item: MenuItem;
  lang: MenuLocale;
  t: MenuT;
  onAdd: (line: CartLine) => void;
  onClose: () => void;
  /** Live table ordering offers "Para compartir". */
  canShare?: boolean;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [shared, setShared] = useState(false);
  // Required single-choice groups start on their first option.
  const [chosen, setChosen] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      item.modifierGroups.map((g) => [
        g.id,
        g.min >= 1 && g.max === 1 && g.options[0] ? [g.options[0].id] : [],
      ]),
    ),
  );

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const options = item.modifierGroups.flatMap((g) => g.options.filter((o) => chosen[g.id]?.includes(o.id)));
  const unitCents = item.priceCents + options.reduce((s, o) => s + o.priceCents, 0);
  const valid = item.modifierGroups.every((g) => {
    const n = chosen[g.id]?.length ?? 0;
    return n >= g.min && n <= g.max;
  });

  function toggle(g: ModifierGroup, optionId: string) {
    setChosen((prev) => {
      const current = prev[g.id] ?? [];
      if (g.max === 1) return { ...prev, [g.id]: current[0] === optionId && g.min === 0 ? [] : [optionId] };
      if (current.includes(optionId)) return { ...prev, [g.id]: current.filter((id) => id !== optionId) };
      if (current.length >= g.max) return prev;
      return { ...prev, [g.id]: [...current, optionId] };
    });
  }

  function add() {
    const ids = options.map((o) => o.id);
    onAdd({
      key: `${item.id}|${ids.join(",")}|${note.trim()}${shared ? "|shared" : ""}`,
      itemId: item.id,
      nameEs: item.nameEs,
      nameEn: item.nameEn,
      qty,
      unitCents,
      optionIds: ids,
      optionsEs: options.map((o) => o.nameEs),
      optionsEn: options.map((o) => o.nameEn),
      note: note.trim() || undefined,
      shared: shared || undefined,
    });
  }

  const stepper = (
    <div className="flex items-center gap-2" role="group" aria-label={t("quantity")}>
      <button
        type="button"
        onClick={() => setQty((q) => Math.max(1, q - 1))}
        aria-label={t("decrease")}
        className="grid size-10 place-items-center rounded-full border border-line text-lg font-bold"
      >
        −
      </button>
      <output className="tabular min-w-6 text-center text-lg font-bold" aria-live="polite">
        {qty}
      </output>
      <button
        type="button"
        onClick={() => setQty((q) => Math.min(99, q + 1))}
        aria-label={t("increase")}
        className="grid size-10 place-items-center rounded-full border border-line text-lg font-bold"
      >
        +
      </button>
    </div>
  );

  return (
    <div className="absolute inset-0 z-20 flex items-end bg-[rgba(10,14,40,.5)]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[92%] w-full flex-col overflow-hidden rounded-t-[18px] bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={cn("relative", item.photo ? "h-48" : "h-14")}>
            {item.photo && (
              <div className="size-full" aria-hidden>
                <DishPhoto item={item} />
              </div>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-surface/90 text-xl leading-none text-ink shadow-lift"
            >
              ×
            </button>
          </div>
          <div className="px-4 pb-4 pt-3">
            <h2 id={titleId} className="text-xl font-extrabold">
              {pick(item, lang)}
            </h2>
            <DishTags item={item} t={t} className="mt-1" />
            {describe(item, lang) && <p className="mt-1 text-sm text-muted">{describe(item, lang)}</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="tabular text-xl font-extrabold">{formatCents(item.priceCents, lang)}</p>
              {stepper}
            </div>

            {item.modifierGroups.map((g) => (
              <fieldset key={g.id} className="mt-4">
                <legend className="flex w-full items-center justify-between gap-2 text-sm font-bold">
                  <span>{pick(g, lang)}</span>
                  <span className={cn("text-xs font-semibold", g.min > 0 ? "text-blue" : "text-muted")}>
                    {g.min > 0 ? t("required") : t("optional")} · {groupHint(g, t)}
                  </span>
                </legend>
                {g.options.map((o) => {
                  const on = chosen[g.id]?.includes(o.id) ?? false;
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "my-1.5 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] border px-3",
                        on ? "border-blue bg-soft" : "border-line",
                      )}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type={g.max === 1 ? "radio" : "checkbox"}
                          name={g.id}
                          checked={on}
                          onChange={() => toggle(g, o.id)}
                          onClick={() => g.max === 1 && g.min === 0 && on && toggle(g, o.id)}
                          className="size-4 accent-[var(--blue)]"
                        />
                        {pick(o, lang)}
                      </span>
                      {o.priceCents > 0 && (
                        <span className="tabular text-sm text-muted">+{formatCents(o.priceCents, lang)}</span>
                      )}
                    </label>
                  );
                })}
              </fieldset>
            ))}

            <label className="mt-4 block text-[13px] font-bold text-ink-2">
              {t("note")}
              <input
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("notePlaceholder")}
                className="mt-1.5 block min-h-11 w-full rounded-btn border-[1.5px] border-line bg-bg px-3 text-base font-normal text-ink focus:border-sky focus:outline-none"
              />
            </label>

            {canShare && (
              <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[10px] border border-line px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={shared}
                  onChange={(e) => setShared(e.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--blue)]"
                />
                <span>
                  <b className="block text-sm">{t("people.shared")}</b>
                  <small className="text-muted">{t("people.sharedHint")}</small>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Always visible, however long the list of options. */}
        <div className="border-t border-line bg-surface px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!valid}
            onClick={add}
            className="min-h-12 w-full rounded-btn bg-accent px-4 font-bold text-accent-ink shadow-btn disabled:opacity-50"
          >
            {valid ? t("add", { price: formatCents(unitCents * qty, lang) }) : t("addMissing")}
          </button>
        </div>
      </div>
    </div>
  );
}
