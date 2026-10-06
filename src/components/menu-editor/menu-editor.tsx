"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import {
  archiveSection,
  reorderSections,
  saveSection,
  setAvailability,
} from "@/app/app/[restaurant]/menu/actions";
import { GuestMenu } from "@/components/menu/guest-menu";
import type { MenuData, MenuLocale, MenuSection, ModifierGroup } from "@/components/menu/types";
import { Button, buttonClass } from "@/components/ui/button";
import { Segmented, Switch } from "@/components/ui/controls";
import { Panel } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import { GroupEditor } from "./group-editor";
import { ItemForm, type ItemDraft } from "./item-form";

const input =
  "min-h-11 w-full rounded-btn border-[1.5px] border-line bg-bg px-3 text-base text-ink focus:border-sky focus:bg-surface focus:outline-none";

function SectionForm({
  section,
  onSave,
  onCancel,
  pending,
}: {
  section?: MenuSection;
  onSave: (nameEs: string, nameEn: string) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const t = useTranslations("editor");
  return (
    <form
      className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      action={(f) => onSave(String(f.get("nameEs")), String(f.get("nameEn")))}
    >
      <label className="grid gap-1 text-xs font-bold text-ink-2">
        {t("nameEs")}
        <input name="nameEs" defaultValue={section?.nameEs} required maxLength={80} className={input} />
      </label>
      <label className="grid gap-1 text-xs font-bold text-ink-2">
        {t("nameEn")}
        <input name="nameEn" defaultValue={section?.nameEn} required maxLength={80} className={input} />
      </label>
      <div className="flex gap-2">
        <Button variant="soft" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

export function MenuEditor({
  slug,
  menu,
  groups,
  menuMessages,
  locale,
}: {
  slug: string;
  menu: MenuData;
  groups: ModifierGroup[];
  menuMessages: Record<MenuLocale, Record<string, unknown>>;
  locale: MenuLocale;
}) {
  const t = useTranslations("editor");
  const [tab, setTab] = useState<"dishes" | "options">("dishes");
  const [order, setOrder] = useState<string[] | null>(null); // optimistic section order while saving
  const [editingSection, setEditingSection] = useState<string | "new" | null>(null);
  const [item, setItem] = useState<ItemDraft | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const byId = new Map(menu.sections.map((s) => [s.id, s]));
  const sections = (order ?? menu.sections.map((s) => s.id)).flatMap((id) =>
    byId.has(id) ? [byId.get(id)!] : [],
  );
  const usage = Object.fromEntries(
    groups.map((g) => [g.id, menu.items.filter((i) => i.modifierGroups.some((m) => m.id === g.id)).length]),
  );

  const say = (message: string) => {
    setError(null);
    setStatus(message);
    window.setTimeout(() => setStatus((s) => (s === message ? null : s)), 2500);
  };
  const run = (action: () => Promise<{ ok: boolean }>) =>
    start(async () => {
      const result = await action();
      if (result.ok) say(t("saved"));
      else setError(t("errors.save_failed"));
    });

  function move(ids: string[], from: number, to: number) {
    if (to < 0 || to >= ids.length || from === to) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    setOrder(next);
    start(async () => {
      const result = await reorderSections(slug, next);
      if (result.ok) say(t("saved"));
      else setError(t("errors.save_failed"));
      setOrder(null);
    });
  }

  const ids = sections.map((s) => s.id);

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
            <p className="max-w-[60ch] text-muted">{t("lead")}</p>
          </div>
          <Link href={`/app/${slug}/menu/importar`} className={buttonClass({ variant: "soft" })}>
            {t("importMenu")}
          </Link>
        </div>

        <Segmented
          label={t("tabsLabel")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "dishes", label: t("tabs.dishes") },
            { value: "options", label: t("tabs.options") },
          ]}
          className="mb-4"
        />

        <div role="status" aria-live="polite" className="min-h-6 text-sm font-semibold text-ok">
          {status}
        </div>
        {error && (
          <p role="alert" className="mb-3 text-sm font-semibold text-bad">
            {error}
          </p>
        )}

        {tab === "options" ? (
          <GroupEditor slug={slug} groups={groups} usage={usage} onSaved={say} />
        ) : (
          <div className="grid gap-4">
            {sections.length === 0 && <p className="text-muted">{t("emptySections")}</p>}
            {sections.length > 1 && <p className="text-sm text-muted">{t("dragHint")}</p>}
            {sections.map((section, index) => {
              const items = menu.items.filter((i) => i.sectionId === section.id);
              return (
                <Panel
                  key={section.id}
                  draggable={editingSection !== section.id}
                  onDragStart={() => setDragging(section.id)}
                  onDragEnd={() => setDragging(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => dragging && move(ids, ids.indexOf(dragging), index)}
                  className={cn(dragging === section.id && "opacity-50")}
                >
                  {editingSection === section.id ? (
                    <SectionForm
                      section={section}
                      pending={pending}
                      onCancel={() => setEditingSection(null)}
                      onSave={(nameEs, nameEn) => {
                        setEditingSection(null);
                        run(() => saveSection(slug, { id: section.id, nameEs, nameEn }));
                      }}
                    />
                  ) : (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h2 className="flex items-center gap-2 text-lg font-extrabold">
                        <span aria-hidden className="cursor-grab select-none text-muted">
                          ⋮⋮
                        </span>
                        {section.nameEs}
                        <span className="text-sm font-semibold text-muted">· {section.nameEn}</span>
                      </h2>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          aria-label={t("moveUp", { name: section.nameEs })}
                          disabled={index === 0 || pending}
                          onClick={() => move(ids, index, index - 1)}
                          className="grid size-11 place-items-center rounded-btn border border-line disabled:opacity-40"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          aria-label={t("moveDown", { name: section.nameEs })}
                          disabled={index === sections.length - 1 || pending}
                          onClick={() => move(ids, index, index + 1)}
                          className="grid size-11 place-items-center rounded-btn border border-line disabled:opacity-40"
                        >
                          ↓
                        </button>
                        {/* Wider screens: both actions inline. Phones: tucked into a "⋯" menu. */}
                        <span className="hidden gap-1.5 sm:flex">
                          <Button size="sm" variant="ghost" onClick={() => setEditingSection(section.id)}>
                            {t("edit", { name: section.nameEs })}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-bad"
                            onClick={() =>
                              window.confirm(t("archiveConfirm", { name: section.nameEs })) &&
                              run(() => archiveSection(slug, section.id))
                            }
                          >
                            {t("archive")}
                          </Button>
                        </span>
                        <details className="relative sm:hidden">
                          <summary
                            aria-label={t("moreActions", { name: section.nameEs })}
                            className="grid size-11 cursor-pointer list-none place-items-center rounded-btn border border-line text-lg font-bold [&::-webkit-details-marker]:hidden"
                          >
                            ⋯
                          </summary>
                          <div className="absolute right-0 z-10 mt-1 grid min-w-44 gap-1 rounded-btn border border-line bg-surface p-1 shadow-lift">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.currentTarget.closest("details")?.removeAttribute("open");
                                setEditingSection(section.id);
                              }}
                              className="min-h-11 rounded-lg px-3 text-left text-sm font-bold hover:bg-soft"
                            >
                              {t("edit", { name: section.nameEs })}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.currentTarget.closest("details")?.removeAttribute("open");
                                if (window.confirm(t("archiveConfirm", { name: section.nameEs })))
                                  run(() => archiveSection(slug, section.id));
                              }}
                              className="min-h-11 rounded-lg px-3 text-left text-sm font-bold text-bad hover:bg-soft"
                            >
                              {t("archive")}
                            </button>
                          </div>
                        </details>
                      </div>
                    </div>
                  )}

                  {items.length === 0 ? (
                    <p className="py-2 text-sm text-muted">{t("emptyItems")}</p>
                  ) : (
                    <ul>
                      {items.map((dish) => (
                        <li
                          key={dish.id}
                          className="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 py-2.5"
                        >
                          <button
                            type="button"
                            onClick={() => setItem(dish)}
                            className="min-h-11 min-w-0 flex-1 text-left"
                            aria-label={t("edit", { name: dish.nameEs })}
                          >
                            <span className="block font-bold">{dish.nameEs}</span>
                            <span className="block text-sm text-muted">
                              {dish.nameEn}
                              {dish.modifierGroups.length > 0 &&
                                ` · ${dish.modifierGroups.map((g) => g.nameEs).join(", ")}`}
                            </span>
                          </button>
                          <span className="tabular font-bold">{formatCents(dish.priceCents, locale)}</span>
                          <Switch
                            checked={!dish.isAvailable}
                            danger
                            onChange={(soldOut) => run(() => setAvailability(slug, dish.id, !soldOut))}
                          >
                            <span className="sr-only">{t("soldOutSwitch", { name: dish.nameEs })}</span>
                            <span aria-hidden>{dish.isAvailable ? t("available") : t("soldOut")}</span>
                          </Switch>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    size="sm"
                    variant="soft"
                    className="mt-2"
                    onClick={() => setItem({ sectionId: section.id })}
                  >
                    {t("addItem")}
                  </Button>
                </Panel>
              );
            })}

            {editingSection === "new" ? (
              <Panel>
                <SectionForm
                  pending={pending}
                  onCancel={() => setEditingSection(null)}
                  onSave={(nameEs, nameEn) => {
                    setEditingSection(null);
                    run(() => saveSection(slug, { nameEs, nameEn }));
                  }}
                />
              </Panel>
            ) : (
              <div>
                <Button variant="soft" onClick={() => setEditingSection("new")}>
                  {t("addSection")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <aside aria-label={t("preview")} className="xl:sticky xl:top-6">
        <h2 className="mb-2 text-sm font-bold text-muted">{t("preview")}</h2>
        <GuestMenu menu={menu} messages={menuMessages} initialLang={locale} framed />
      </aside>

      {item && (
        <ItemForm
          slug={slug}
          item={item}
          sections={sections}
          groups={groups}
          onClose={() => setItem(null)}
          onSaved={say}
        />
      )}
    </div>
  );
}
