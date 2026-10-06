"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteGroup, saveGroup } from "@/app/app/[restaurant]/menu/actions";
import type { ModifierGroup } from "@/components/menu/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { formatPlain } from "@/lib/money";

type OptionDraft = { nameEs: string; nameEn: string; price: string };
type Draft = {
  id?: string;
  nameEs: string;
  nameEn: string;
  min: number;
  max: number;
  options: OptionDraft[];
};

const input =
  "min-h-11 w-full rounded-btn border-[1.5px] border-line bg-bg px-3 text-base text-ink focus:border-sky focus:bg-surface focus:outline-none";

function toDraft(g?: ModifierGroup): Draft {
  return g
    ? {
        id: g.id,
        nameEs: g.nameEs,
        nameEn: g.nameEn,
        min: g.min,
        max: g.max,
        options: g.options.map((o) => ({
          nameEs: o.nameEs,
          nameEn: o.nameEn,
          price: formatPlain(o.priceCents),
        })),
      }
    : { nameEs: "", nameEn: "", min: 0, max: 1, options: [{ nameEs: "", nameEn: "", price: "0.00" }] };
}

/** Option groups (Leche, Azúcar…) with min/max and per-option prices. */
export function GroupEditor({
  slug,
  groups,
  usage,
  onSaved,
}: {
  slug: string;
  groups: ModifierGroup[];
  usage: Record<string, number>;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations("editor");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    if (!draft) return;
    setError(null);
    start(async () => {
      const result = await saveGroup(slug, draft);
      if (result.ok) {
        setDraft(null);
        onSaved(t("saved"));
      } else {
        const known = ["invalid", "price", "range"];
        setError(t(`errors.${known.includes(result.error) ? result.error : "save_failed"}`));
      }
    });
  }

  function remove(g: ModifierGroup) {
    if (!window.confirm(t("deleteGroupConfirm", { name: g.nameEs }))) return;
    start(async () => {
      const result = await deleteGroup(slug, g.id);
      if (result.ok) onSaved(t("saved"));
      else setError(t("errors.save_failed"));
    });
  }

  const setOption = (i: number, patch: Partial<OptionDraft>) =>
    setDraft((d) => d && { ...d, options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });

  return (
    <div className="grid gap-3">
      {groups.length === 0 && !draft && <p className="text-muted">{t("emptyGroups")}</p>}
      {groups.map((g) =>
        draft?.id === g.id ? null : (
          <Panel key={g.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold">
                  {g.nameEs} <span className="font-semibold text-muted">· {g.nameEn}</span>
                </h3>
                <p className="text-sm text-muted">
                  {t("groupSummary", { min: g.min, max: g.max, count: g.options.length })} ·{" "}
                  {t("usedBy", { count: usage[g.id] ?? 0 })}
                </p>
                <p className="mt-1 text-sm">{g.options.map((o) => o.nameEs).join(" · ")}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setDraft(toDraft(g))}>
                  {t("edit", { name: g.nameEs })}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-bad"
                  onClick={() => remove(g)}
                  disabled={pending}
                >
                  {t("deleteGroup")}
                </Button>
              </div>
            </div>
          </Panel>
        ),
      )}

      {draft ? (
        <Panel>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-[13px] font-bold text-ink-2">
              {t("groupNameEs")}
              <input
                className={input}
                value={draft.nameEs}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, nameEs: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-bold text-ink-2">
              {t("groupNameEn")}
              <input
                className={input}
                value={draft.nameEn}
                maxLength={80}
                onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-bold text-ink-2">
              {t("min")}
              <input
                type="number"
                min={0}
                max={20}
                className={input}
                value={draft.min}
                onChange={(e) => setDraft({ ...draft, min: Number(e.target.value) })}
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-bold text-ink-2">
              {t("max")}
              <input
                type="number"
                min={1}
                max={20}
                className={input}
                value={draft.max}
                onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) })}
              />
            </label>
          </div>
          <ul className="mt-4 grid gap-2">
            {draft.options.map((o, i) => (
              <li key={i} className="grid grid-cols-[1fr_1fr_110px_auto] items-end gap-2">
                <label className="grid gap-1 text-xs font-bold text-ink-2">
                  {t("optionNameEs")}
                  <input
                    className={input}
                    value={o.nameEs}
                    maxLength={80}
                    onChange={(e) => setOption(i, { nameEs: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold text-ink-2">
                  {t("optionNameEn")}
                  <input
                    className={input}
                    value={o.nameEn}
                    maxLength={80}
                    onChange={(e) => setOption(i, { nameEn: e.target.value })}
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold text-ink-2">
                  {t("optionPrice")}
                  <input
                    className={input}
                    inputMode="decimal"
                    value={o.price}
                    onChange={(e) => setOption(i, { price: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  aria-label={t("removeOption", { n: i + 1 })}
                  disabled={draft.options.length === 1}
                  onClick={() => setDraft({ ...draft, options: draft.options.filter((_, j) => j !== i) })}
                  className="grid size-11 place-items-center rounded-full border border-line text-lg disabled:opacity-40"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <Button
            size="sm"
            variant="soft"
            className="mt-3"
            onClick={() =>
              setDraft({ ...draft, options: [...draft.options, { nameEs: "", nameEn: "", price: "0.00" }] })
            }
          >
            {t("addOption")}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-bad">
              {error}
            </p>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="soft" onClick={() => setDraft(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={save} disabled={pending}>
              {t("save")}
            </Button>
          </div>
        </Panel>
      ) : (
        <div>
          <Button variant="soft" onClick={() => setDraft(toDraft())}>
            {t("addGroup")}
          </Button>
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-bad">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
