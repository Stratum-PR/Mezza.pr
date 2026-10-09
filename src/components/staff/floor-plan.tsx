"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type TableState = "free" | "open" | "paying" | "attention";

export interface PlanTable {
  id: string;
  label: string;
  seats: number | null;
  area: string | null;
  shape: "square" | "round" | "long";
  x: number | null;
  y: number | null;
  state?: TableState;
  total?: string;
  href?: string;
}

const STATE_CLASS: Record<TableState, string> = {
  free: "border-line bg-surface text-muted",
  open: "border-blue bg-soft text-ink",
  paying: "border-warn bg-sandsoft text-ink",
  attention: "border-bad bg-surface text-ink",
};

/** Where an unplaced table goes: a tidy grid, so a new floor plan is usable before anyone drags. */
export function defaultSpot(index: number): { x: number; y: number } {
  const col = index % 5;
  const row = Math.floor(index / 5);
  return { x: 12 + col * 19, y: 16 + row * 26 };
}

function areasOf(tables: PlanTable[], fallback: string): string[] {
  return [...new Set(tables.map((t) => t.area || fallback))];
}

/**
 * Tables drawn by area, shape and position (percent of the canvas). Read-only on Mesas, where colour
 * plus a text label give each table's state; editable in Ajustes (drag, or arrow keys on a selected table).
 */
export function FloorPlan({
  tables,
  editable = false,
  selected,
  onSelect,
  onMove,
}: {
  tables: PlanTable[];
  editable?: boolean;
  selected?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
}) {
  const t = useTranslations("staff.floor");
  const fallback = t("mainArea");
  const areas = areasOf(tables, fallback);
  const [area, setArea] = useState(areas[0] ?? fallback);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
  const inArea = tables.filter((tb) => (tb.area || fallback) === area);

  const place = (e: PointerEvent, id: string) => {
    const box = canvas.current?.getBoundingClientRect();
    if (!box) return;
    const clamp = (v: number) => Math.min(96, Math.max(4, Math.round(v * 10) / 10));
    onMove?.(
      id,
      clamp(((e.clientX - box.left) / box.width) * 100),
      clamp(((e.clientY - box.top) / box.height) * 100),
    );
  };
  const nudge = (e: KeyboardEvent, tb: PlanTable, x: number, y: number) => {
    const step = e.shiftKey ? 5 : 1;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onMove?.(tb.id, Math.min(96, Math.max(4, x + m[0])), Math.min(96, Math.max(4, y + m[1])));
  };

  return (
    <div>
      {areas.length > 1 && (
        <div role="tablist" aria-label={t("areas")} className="mb-3 flex gap-1.5">
          {areas.map((a) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={area === a}
              onClick={() => setArea(a)}
              className={cn(
                "min-h-10 rounded-full border px-4 text-sm font-bold",
                area === a ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      )}
      <div
        ref={canvas}
        className="relative aspect-[16/10] w-full touch-none overflow-hidden rounded-card border border-line bg-bg [background-image:radial-gradient(var(--line)_1px,transparent_1px)] [background-size:22px_22px]"
        onPointerMove={(e) => editable && drag.current && place(e, drag.current)}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <ul aria-label={t("plan", { area })} className="absolute inset-0">
          {inArea.map((tb) => {
            const index = tables.indexOf(tb);
            const { x, y } = tb.x !== null && tb.y !== null ? { x: tb.x, y: tb.y } : defaultSpot(index);
            const state = tb.state ?? "free";
            const body = (
              <>
                <b className="text-lg leading-none">{tb.label}</b>
                {!editable && <span className="text-[11px] font-bold">{t(`states.${state}`)}</span>}
                {tb.total && <span className="tabular text-[11px]">{tb.total}</span>}
                {editable && tb.seats ? (
                  <span className="text-[11px]">{t("seats", { n: tb.seats })}</span>
                ) : null}
              </>
            );
            const cls = cn(
              "absolute grid -translate-x-1/2 -translate-y-1/2 place-content-center justify-items-center gap-0.5 border-2 text-center shadow-sm",
              tb.shape === "round"
                ? "size-[72px] rounded-full"
                : tb.shape === "long"
                  ? "h-[68px] w-[136px] rounded-xl"
                  : "size-[76px] rounded-xl",
              editable
                ? cn(
                    "cursor-grab border-line bg-surface text-ink",
                    selected === tb.id && "border-accent ring-2 ring-accent/30",
                  )
                : STATE_CLASS[state],
              state === "attention" && !editable && "border-dashed",
            );
            const style = { left: `${x}%`, top: `${y}%` };
            return (
              <li key={tb.id} style={style} className="absolute">
                {editable ? (
                  <button
                    type="button"
                    aria-pressed={selected === tb.id}
                    aria-label={t("move", { label: tb.label })}
                    className={cls}
                    style={{ left: 0, top: 0 }}
                    onPointerDown={(e) => {
                      drag.current = tb.id;
                      onSelect?.(tb.id);
                      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                    }}
                    onClick={() => onSelect?.(tb.id)}
                    onKeyDown={(e) => nudge(e, tb, x, y)}
                  >
                    {body}
                  </button>
                ) : tb.href ? (
                  <Link
                    href={tb.href}
                    className={cls}
                    style={{ left: 0, top: 0 }}
                    aria-label={`${t("table", { label: tb.label })} · ${t(`states.${state}`)}`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={cls} style={{ left: 0, top: 0 }}>
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      {!editable && (
        <ul aria-label={t("legend")} className="mt-3 flex flex-wrap gap-3 text-sm text-ink-2">
          {(["free", "open", "paying", "attention"] as const).map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn(
                  "inline-block size-3.5 rounded border-2",
                  STATE_CLASS[s],
                  s === "attention" && "border-dashed",
                )}
              />
              {t(`states.${s}`)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
