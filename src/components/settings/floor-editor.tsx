"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FloorPlan, defaultSpot, type PlanTable } from "@/components/staff/floor-plan";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { saveFloor, type FormResult } from "@/lib/settings/actions";

const inputClass =
  "min-h-11 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base text-ink focus:border-sky focus:outline-none";

/** Arrange tables: drag them (or select and use the arrow keys), set area, shape and seats, then save. */
export function FloorEditor({ slug, tables: initial }: { slug: string; tables: PlanTable[] }) {
  const t = useTranslations("staff.floor");
  const ts = useTranslations("settings");
  const [tables, setTables] = useState(() =>
    initial.map((tb, i) => (tb.x === null || tb.y === null ? { ...tb, ...defaultSpot(i) } : tb)),
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<FormResult>(null);
  const [saving, start] = useTransition();
  const current = tables.find((tb) => tb.id === selected);
  const patch = (id: string, p: Partial<PlanTable>) =>
    setTables((all) => all.map((tb) => (tb.id === id ? { ...tb, ...p } : tb)));
  const areaNames = [...new Set(tables.map((tb) => tb.area).filter(Boolean))] as string[];

  return (
    <Panel title={t("editTitle")} className="lg:col-span-2">
      <p className="mb-3 text-sm text-muted">{t("editLead")}</p>
      <p className="text-sm text-warn md:hidden">{t("phoneNote")}</p>
      <div className="hidden md:block">
        <FloorPlan
          tables={tables}
          editable
          selected={selected}
          onSelect={setSelected}
          onMove={(id, x, y) => patch(id, { x, y })}
        />
      </div>
      {current && (
        <div className="mt-3 grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-3">
          <p className="font-bold sm:col-span-3">{t("table", { label: current.label })}</p>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
            {t("area")}
            <input
              list="floor-areas"
              value={current.area ?? ""}
              maxLength={30}
              placeholder={t("mainArea")}
              onChange={(e) => patch(current.id, { area: e.target.value })}
              className={inputClass}
            />
            <datalist id="floor-areas">
              {areaNames.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
            {t("shape")}
            <select
              value={current.shape}
              onChange={(e) => patch(current.id, { shape: e.target.value as PlanTable["shape"] })}
              className={inputClass}
            >
              {(["square", "round", "long"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`shapes.${s}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
            {t("seatsLabel")}
            <input
              type="number"
              min={1}
              max={40}
              value={current.seats ?? ""}
              onChange={(e) => patch(current.id, { seats: e.target.value ? Number(e.target.value) : null })}
              className={inputClass}
            />
          </label>
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <Button
          disabled={saving}
          onClick={() =>
            start(async () =>
              setResult(
                await saveFloor(
                  slug,
                  tables.map((tb) => ({
                    id: tb.id,
                    area: tb.area ?? "",
                    shape: tb.shape,
                    seats: tb.seats,
                    x: tb.x ?? 50,
                    y: tb.y ?? 50,
                  })),
                ),
              ),
            )
          }
        >
          {t("save")}
        </Button>
        <p role="status" aria-live="polite" className="text-sm font-semibold">
          {result?.ok && <span className="text-ok">{ts("done.saved")}</span>}
          {result && !result.ok && <span className="text-bad">{ts(`errors.${result.error}`)}</span>}
        </p>
      </div>
    </Panel>
  );
}
