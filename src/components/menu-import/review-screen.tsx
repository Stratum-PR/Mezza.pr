"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, useTransition, type PointerEvent as ReactPointerEvent } from "react";
import { publishImport } from "@/app/app/[restaurant]/menu/importar/actions";
import type { MenuImportResult } from "@/connectors/menu-import";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { dollarsToCents, formatPlain } from "@/lib/money";

type Box = { x: number; y: number; width: number; height: number };
const MIN = 0.02;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function fit(b: Box): Box {
  const width = clamp(b.width, MIN, 1);
  const height = clamp(b.height, MIN, 1);
  return { width, height, x: clamp(b.x, 0, 1 - width), y: clamp(b.y, 0, 1 - height) };
}

export function ReviewScreen({
  slug,
  uploadId,
  result,
  pageUrl,
}: {
  slug: string;
  uploadId: string;
  result: MenuImportResult;
  pageUrl: string | null;
}) {
  const t = useTranslations("importer");
  const page = result.pages[0];
  const flaggedAtStart = result.items.map((i) => i.priceCents === null || i.confidence < 0.8);

  const [prices, setPrices] = useState(
    result.items.map((i) => (i.priceCents === null ? "" : formatPlain(i.priceCents))),
  );
  const [confirmed, setConfirmed] = useState(result.items.map(() => false));
  const [boxes, setBoxes] = useState<(Box | null)[]>(result.items.map((i) => i.hotspot ?? null));
  const [selected, setSelected] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const pageRef = useRef<HTMLDivElement>(null);

  const open = flaggedAtStart.filter((f, i) => f && !confirmed[i]).length;
  const pricesValid = prices.every((p) => dollarsToCents(p) !== null);

  function setBox(i: number, box: Box) {
    setBoxes((all) => all.map((b, j) => (j === i ? fit(box) : b)));
  }

  function drag(i: number, mode: "move" | "resize", e: ReactPointerEvent) {
    const rect = pageRef.current?.getBoundingClientRect();
    const start = boxes[i];
    if (!rect || !start) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(i);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - x0) / rect.width;
      const dy = (ev.clientY - y0) / rect.height;
      setBox(
        i,
        mode === "move"
          ? { ...start, x: start.x + dx, y: start.y + dy }
          : { ...start, width: start.width + dx, height: start.height + dy },
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function nudge(i: number, e: React.KeyboardEvent) {
    const b = boxes[i];
    const step = 0.005;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[
      e.key
    ];
    if (!b || !d) return;
    e.preventDefault();
    setBox(
      i,
      e.shiftKey
        ? { ...b, width: b.width + d[0]!, height: b.height + d[1]! }
        : { ...b, x: b.x + d[0]!, y: b.y + d[1]! },
    );
  }

  function publish() {
    setError(null);
    start(async () => {
      const response = await publishImport(slug, uploadId, {
        ...result,
        items: result.items.map((item, i) => ({
          ...item,
          priceCents: dollarsToCents(prices[i]!)!,
          hotspot: boxes[i] ? { page: 1, ...boxes[i]! } : undefined,
        })),
      });
      if (response && !response.ok)
        setError(t(response.error === "invalid" ? "errors.invalid" : "errors.publish"));
    });
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <section aria-labelledby="page-title" className="lg:sticky lg:top-6">
        <h2 id="page-title" className="mb-1 text-lg font-extrabold">
          {t("sourcePage")}
        </h2>
        <p className="mb-2 text-sm text-muted">{t("zoneHelp")}</p>
        {page && pageUrl ? (
          <div
            ref={pageRef}
            className="relative touch-none select-none overflow-hidden rounded-md shadow-[0_0_0_1px_var(--line)]"
            style={{ aspectRatio: `${page.width} / ${page.height}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
            <img src={pageUrl} alt={t("sourcePage")} className="block size-full" draggable={false} />
            {boxes.map((b, i) =>
              b ? (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-label={t("zone", { name: result.items[i]!.nameEs })}
                  aria-pressed={selected === i}
                  onPointerDown={(e) => drag(i, "move", e)}
                  onKeyDown={(e) => nudge(i, e)}
                  onFocus={() => setSelected(i)}
                  className={cn(
                    "absolute cursor-move rounded-[4px] outline-dashed outline-[1.5px] outline-blue",
                    selected === i
                      ? "bg-blue/20"
                      : flaggedAtStart[i] && !confirmed[i]
                        ? "bg-warn/20"
                        : "bg-blue/5",
                  )}
                  style={{
                    left: `${b.x * 100}%`,
                    top: `${b.y * 100}%`,
                    width: `${b.width * 100}%`,
                    height: `${b.height * 100}%`,
                  }}
                >
                  <span
                    aria-label={t("resize", { name: result.items[i]!.nameEs })}
                    onPointerDown={(e) => drag(i, "resize", e)}
                    className="absolute -bottom-1.5 -right-1.5 size-3.5 cursor-se-resize rounded-full border-2 border-white bg-blue"
                  />
                </div>
              ) : null,
            )}
          </div>
        ) : null}

        <Panel className="mt-4" title={t("theme")}>
          <div className="flex gap-2">
            {Object.entries(result.theme.palette).map(([k, v]) => (
              <span
                key={k}
                title={`${k} ${v}`}
                className="size-9 rounded-lg shadow-[0_0_0_1px_var(--line)]"
                style={{ background: v }}
              />
            ))}
          </div>
          <p className="mt-2 text-sm text-muted">
            {t("themeFonts", { display: result.theme.displayFont, body: result.theme.bodyFont })}
          </p>
        </Panel>
      </section>

      <section aria-labelledby="dishes-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="dishes-title" className="text-lg font-extrabold">
            {t("dishes")}
          </h2>
          <span
            role="status"
            className={cn(
              "rounded-full px-3 py-1 text-sm font-bold",
              open ? "bg-warn-bg text-warn" : "bg-ok-bg text-ok",
            )}
          >
            {t("flagged", { count: open })}
          </span>
        </div>

        {result.sections.map((section) => (
          <Panel key={section.key} title={section.nameEs} className="mb-3">
            <ul>
              {result.items.map((item, i) => {
                if (item.sectionKey !== section.key) return null;
                const flagged = flaggedAtStart[i]!;
                const needs = flagged && !confirmed[i];
                return (
                  <li
                    key={item.nameEs}
                    className={cn(
                      "grid gap-2 border-t border-line-2 py-2.5 sm:grid-cols-[1fr_auto_auto] sm:items-center",
                      needs && "-mx-2 rounded-lg bg-warn-bg px-2",
                      selected === i && "ring-2 ring-blue",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(i)}
                      aria-label={t("selectZone", { name: item.nameEs })}
                      className="min-h-11 text-left"
                    >
                      <b className="block">{item.nameEs}</b>
                      <span className="block text-sm text-muted">{item.nameEn}</span>
                      {flagged && (
                        <span className={cn("block text-xs font-bold", needs ? "text-warn" : "text-ok")}>
                          {confirmed[i]
                            ? t("confirmed")
                            : item.priceCents === null
                              ? t("missingPrice")
                              : t("lowConfidence")}
                        </span>
                      )}
                    </button>
                    <label className="flex items-center gap-1 font-bold">
                      $
                      <input
                        aria-label={t("price", { name: item.nameEs })}
                        inputMode="decimal"
                        value={prices[i]}
                        onChange={(e) => {
                          setPrices((p) => p.map((v, j) => (j === i ? e.target.value : v)));
                          setConfirmed((c) => c.map((v, j) => (j === i ? false : v)));
                        }}
                        aria-invalid={dollarsToCents(prices[i]!) === null || undefined}
                        className="tabular min-h-11 w-24 rounded-btn border-[1.5px] border-line bg-surface px-2 text-right text-ink aria-[invalid]:border-bad"
                      />
                    </label>
                    {flagged ? (
                      <Button
                        size="sm"
                        variant={confirmed[i] ? "soft" : "primary"}
                        disabled={dollarsToCents(prices[i]!) === null || confirmed[i]}
                        onClick={() => setConfirmed((c) => c.map((v, j) => (j === i ? true : v)))}
                      >
                        {confirmed[i] ? t("confirmed") : t("confirm")}
                      </Button>
                    ) : (
                      <span />
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        ))}

        <Panel>
          <p className="mb-3 text-sm text-muted">{t("publishNote")}</p>
          {(open > 0 || !pricesValid) && (
            <p className="mb-3 text-sm font-semibold text-warn">{t("publishBlocked")}</p>
          )}
          {error && (
            <p role="alert" className="mb-3 text-sm font-semibold text-bad">
              {error}
            </p>
          )}
          <Button size="lg" onClick={publish} disabled={open > 0 || !pricesValid || pending}>
            {t("publish")}
          </Button>
        </Panel>
      </section>
    </div>
  );
}
