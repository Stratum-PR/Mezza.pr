"use client";

import { useTranslations } from "next-intl";
import { DISH_TAGS, type DishTag } from "@/components/menu/types";
import { useEffect, useRef, useState, useTransition } from "react";
import { archiveItem, saveItem, uploadPhoto, type ActionResult } from "@/app/app/[restaurant]/menu/actions";
import type { MenuItem, MenuSection, ModifierGroup } from "@/components/menu/types";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/controls";
import { formatPlain } from "@/lib/money";

export type ItemDraft = Partial<MenuItem> & { sectionId: string };

/** Add or edit one dish in a modal dialog. */
export function ItemForm({
  slug,
  item,
  sections,
  groups,
  onClose,
  onSaved,
}: {
  slug: string;
  item: ItemDraft;
  sections: MenuSection[];
  groups: ModifierGroup[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const t = useTranslations("editor");
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>(item.modifierGroups?.map((g) => g.id) ?? []);
  const [tags, setTags] = useState<DishTag[]>(item.tags ?? []);
  const tm = useTranslations("menu");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const report = (result: ActionResult) => {
    if (result.ok) {
      onSaved(t("saved"));
      return true;
    }
    const known = ["invalid", "price", "photo_type", "photo_size", "range"];
    setError(t(`errors.${known.includes(result.error) ? result.error : "save_failed"}`));
    return false;
  };

  function submit(form: FormData) {
    setError(null);
    start(async () => {
      const result = await saveItem(slug, {
        id: item.id,
        sectionId: String(form.get("sectionId")),
        nameEs: String(form.get("nameEs")),
        nameEn: String(form.get("nameEn")),
        descriptionEs: String(form.get("descriptionEs") ?? ""),
        descriptionEn: String(form.get("descriptionEn") ?? ""),
        price: String(form.get("price")),
        groupIds,
        tags,
      });
      if (!report(result)) return;
      const photo = form.get("photo");
      if (photo instanceof File && photo.size > 0 && result.ok && result.id) {
        const fd = new FormData();
        fd.set("photo", photo);
        if (!report(await uploadPhoto(slug, result.id, fd))) return;
      }
      onClose();
    });
  }

  function archive() {
    if (!item.id || !window.confirm(t("archiveConfirm", { name: item.nameEs ?? "" }))) return;
    start(async () => {
      if (report(await archiveItem(slug, item.id!))) onClose();
    });
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="item-form-title"
      className="m-auto w-[min(560px,calc(100vw-32px))] max-h-[calc(100dvh-32px)] rounded-hero bg-surface p-0 text-ink shadow-dialog backdrop:bg-[rgba(22,32,79,.45)] backdrop:backdrop-blur-[3px]"
    >
      <form action={submit} className="grid gap-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="item-form-title" className="text-2xl font-extrabold">
            {item.id ? t("edit", { name: item.nameEs ?? "" }) : t("addItem")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("cancel")}
            className="grid size-10 place-items-center rounded-[10px] bg-soft text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("nameEs")} name="nameEs" defaultValue={item.nameEs} required maxLength={80} />
          <Field label={t("nameEn")} name="nameEn" defaultValue={item.nameEn} required maxLength={80} />
          <Field
            label={t("descriptionEs")}
            name="descriptionEs"
            defaultValue={item.descriptionEs}
            maxLength={240}
          />
          <Field
            label={t("descriptionEn")}
            name="descriptionEn"
            defaultValue={item.descriptionEn}
            maxLength={240}
          />
          <Field
            label={t("price")}
            hint={t("priceHint")}
            name="price"
            inputMode="decimal"
            defaultValue={item.priceCents !== undefined ? formatPlain(item.priceCents) : ""}
            required
          />
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
            {t("section")}
            <select
              name="sectionId"
              defaultValue={item.sectionId}
              className="min-h-11 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base font-normal text-ink"
            >
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameEs}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-bold text-ink-2">{t("tags")}</legend>
          <div className="flex flex-wrap gap-2">
            {DISH_TAGS.map((tag) => {
              const on = tags.includes(tag);
              return (
                <label
                  key={tag}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold ${on ? "border-blue bg-soft text-blue" : "border-line"}`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setTags((x) => (on ? x.filter((v) => v !== tag) : [...x, tag]))}
                    className="size-4 accent-[var(--blue)]"
                  />
                  {tm(`tags.${tag}`)}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-bold text-ink-2">{t("modifierGroups")}</legend>
          {groups.length === 0 ? (
            <p className="text-sm text-muted">{t("noGroups")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const on = groupIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold ${on ? "border-blue bg-soft text-blue" : "border-line"}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() =>
                        setGroupIds((ids) => (on ? ids.filter((id) => id !== g.id) : [...ids, g.id]))
                      }
                      className="size-4 accent-[var(--blue)]"
                    />
                    {g.nameEs}
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>

        <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
          {t("photo")}
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm font-normal file:mr-3 file:min-h-10 file:rounded-btn file:border-0 file:bg-soft file:px-4 file:font-bold file:text-ink"
          />
          <span className="font-normal text-muted">{t("photoHint")}</span>
        </label>

        {error && (
          <p role="alert" className="text-sm font-semibold text-bad">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {item.id ? (
            <Button variant="ghost" onClick={archive} disabled={pending} className="text-bad">
              {t("archive")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="soft" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {t("save")}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
