"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import {
  rotateTableCode,
  saveQrDesign,
  uploadQrLogo,
  type QrActionResult,
} from "@/app/app/[restaurant]/qr/actions";
import { menuFontStack, menuFontVariables } from "@/components/menu/menu-fonts";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/ui/surface";
import { QR_PRESETS, type QrPresetId } from "@/config/qr-presets";
import { cn } from "@/lib/cn";
import { qrDesignOf, type CardDesign, type CardTable, type PdfFormat } from "@/lib/qr/card";
import { qrSafety, renderQr, type DotStyle, type EyeStyle, type LogoMode } from "@/lib/qr/render";
import { QrSvg } from "./qr-svg";

type Design = CardDesign & { preset: string };
type Table = CardTable & { tokenVersion: number };

/** The printed card, drawn in HTML with the same proportions as the PDF card. */
function QrCardPreview({
  design,
  table,
  width = 280,
}: {
  design: CardDesign;
  table: CardTable;
  width?: number;
}) {
  const render = useMemo(() => renderQr(table.url, qrDesignOf(design)), [design, table.url]);
  const font = design.font === "menu" ? menuFontStack("Playfair Display") : "var(--font-sans)";
  return (
    <div
      className={cn(menuFontVariables, "mx-auto text-center")}
      style={{
        width,
        padding: width * 0.06,
        background: design.frame,
        color: design.frameInk,
        borderRadius: width * 0.06,
        fontFamily: font,
        boxShadow: "0 0 0 1px var(--line)",
      }}
    >
      <p style={{ fontSize: width * 0.06, fontWeight: 700, lineHeight: 1.2 }}>{design.frameTextEs}</p>
      <p style={{ fontSize: width * 0.045, marginBottom: width * 0.04 }}>{design.frameTextEn}</p>
      <div style={{ background: design.bg, padding: width * 0.03, borderRadius: width * 0.04 }}>
        <QrSvg render={render} label={`QR · Mesa ${table.label}`} className="block w-full" />
      </div>
      <p style={{ fontSize: width * 0.095, fontWeight: 700, marginTop: width * 0.03, lineHeight: 1.1 }}>
        Mesa {table.label}
      </p>
      <p style={{ fontSize: width * 0.042, opacity: 0.85 }}>
        {design.restaurantName} · {design.displayHost}
      </p>
    </div>
  );
}

const colorKeys = ["fg", "bg", "frame", "frameInk"] as const;

export function QrStudio({ slug, initial, tables }: { slug: string; initial: Design; tables: Table[] }) {
  const t = useTranslations("qr");
  const [design, setDesign] = useState<Design>(initial);
  const [previewId, setPreviewId] = useState(tables[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>(tables.map((x) => x.id));
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const previewTable = tables.find((x) => x.id === previewId) ??
    tables[0] ?? { id: "x", label: "4", url: "https://mezza.pr" };
  const safety = qrSafety(design.fg, design.bg);
  const set = (patch: Partial<Design>) =>
    setDesign((d) => ({ ...d, ...patch, preset: patch.preset ?? "custom" }));
  const report = (result: QrActionResult, ok: string) => {
    if (result.ok) {
      setError(null);
      setStatus(ok);
    } else setError(t(`errors.${result.error}`));
  };

  function applyPreset(id: QrPresetId) {
    const p = QR_PRESETS[id];
    setDesign((d) => ({
      ...d,
      preset: id,
      fg: p.fg,
      bg: p.bg,
      frame: p.frame,
      frameInk: p.frame_ink,
      dotStyle: p.dot_style,
      eyeStyle: p.eye_style,
      logoMode: p.logo_mode === "mono" && d.logoMode === "upload" ? "upload" : p.logo_mode,
      font: p.font,
    }));
  }

  function save() {
    start(async () =>
      report(
        await saveQrDesign(slug, {
          preset: design.preset as "house" | "bold" | "clean" | "custom",
          fg: design.fg,
          bg: design.bg,
          frame: design.frame,
          frameInk: design.frameInk,
          dotStyle: design.dotStyle,
          eyeStyle: design.eyeStyle,
          logoMode: design.logoMode,
          frameTextEs: design.frameTextEs,
          frameTextEn: design.frameTextEn,
          font: design.font,
        }),
        t("saved"),
      ),
    );
  }

  function rotate(table: Table) {
    if (!window.confirm(t("rotateConfirm", { label: table.label }))) return;
    start(async () => report(await rotateTableCode(slug, table.id), t("rotated", { label: table.label })));
  }

  const pdfHref = (format: PdfFormat) => {
    const all = selected.length === tables.length;
    return `/app/${slug}/qr/pdf?format=${format}${all ? "" : `&tables=${selected.join(",")}`}`;
  };

  const label = "text-[13px] font-bold text-ink-2";
  const input =
    "min-h-11 w-full rounded-btn border-[1.5px] border-line bg-bg px-3 text-base text-ink focus:border-sky focus:bg-surface focus:outline-none";

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid min-w-0 gap-5">
        <Panel title={t("design")}>
          <div className="grid gap-5">
            <fieldset>
              <legend className={cn(label, "mb-2")}>{t("presets")}</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(QR_PRESETS) as QrPresetId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={design.preset === id}
                    onClick={() => applyPreset(id)}
                    className={cn(
                      "flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-semibold",
                      design.preset === id ? "border-blue bg-soft text-blue" : "border-line",
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-4 rounded-full"
                      style={{ background: QR_PRESETS[id].fg, boxShadow: `0 0 0 3px ${QR_PRESETS[id].bg}` }}
                    />
                    {t(`presetNames.${id}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className={cn(label, "mb-2")}>{t("colors")}</legend>
              <div className="grid grid-cols-2 gap-2">
                {colorKeys.map((k) => (
                  <label
                    key={k}
                    className="flex min-h-11 items-center gap-2 rounded-btn border border-line px-2.5 text-sm font-semibold"
                  >
                    <input
                      type="color"
                      value={design[k]}
                      onChange={(e) => set({ [k]: e.target.value.toUpperCase() })}
                      className="h-7 w-9 cursor-pointer border-0 bg-transparent p-0"
                    />
                    {t(k)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <span className={label}>{t("dots")}</span>
                <Segmented<DotStyle>
                  label={t("dots")}
                  value={design.dotStyle}
                  onChange={(v) => set({ dotStyle: v })}
                  options={(["square", "rounded", "dots"] as const).map((v) => ({
                    value: v,
                    label: t(`dotStyles.${v}`),
                  }))}
                />
              </div>
              <div className="grid gap-1.5">
                <span className={label}>{t("eyes")}</span>
                <Segmented<EyeStyle>
                  label={t("eyes")}
                  value={design.eyeStyle}
                  onChange={(v) => set({ eyeStyle: v })}
                  options={(["square", "rounded", "circle"] as const).map((v) => ({
                    value: v,
                    label: t(`eyeStyles.${v}`),
                  }))}
                />
              </div>
              <div className="grid gap-1.5">
                <span className={label}>{t("logo")}</span>
                <Segmented<LogoMode>
                  label={t("logo")}
                  value={design.logoMode}
                  onChange={(v) => set({ logoMode: v })}
                  options={(["none", "mono", "upload"] as const).map((v) => ({
                    value: v,
                    label: t(`logoModes.${v}`),
                  }))}
                />
              </div>
              <div className="grid gap-1.5">
                <span className={label}>{t("font")}</span>
                <Segmented<"menu" | "modern">
                  label={t("font")}
                  value={design.font}
                  onChange={(v) => set({ font: v })}
                  options={(["menu", "modern"] as const).map((v) => ({ value: v, label: t(`fonts.${v}`) }))}
                />
              </div>
            </div>

            {design.logoMode === "upload" && (
              <label className={cn(label, "grid gap-1.5")}>
                {t("logoFile")}
                {design.logoSrc ? (
                  <span className="font-normal text-ok">{t("logoCurrent")}</span>
                ) : (
                  <span className="font-normal text-muted">{t("logoMissing")}</span>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.set("logo", file);
                    start(async () => {
                      const result = await uploadQrLogo(slug, fd);
                      if (result.ok && result.logoSrc) {
                        setDesign((d) => ({ ...d, logoMode: "upload", logoSrc: result.logoSrc }));
                      }
                      report(result, t("logoSaved"));
                    });
                  }}
                  className="text-sm font-normal file:mr-3 file:min-h-10 file:rounded-btn file:border-0 file:bg-soft file:px-4 file:font-bold file:text-ink"
                />
              </label>
            )}

            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className={cn(label, "mb-2")}>{t("message")}</legend>
              <label className={cn(label, "grid gap-1")}>
                {t("messageEs")}
                <input
                  className={input}
                  maxLength={60}
                  value={design.frameTextEs}
                  onChange={(e) => set({ frameTextEs: e.target.value })}
                />
              </label>
              <label className={cn(label, "grid gap-1")}>
                {t("messageEn")}
                <input
                  className={input}
                  maxLength={60}
                  value={design.frameTextEn}
                  onChange={(e) => set({ frameTextEn: e.target.value })}
                />
              </label>
            </fieldset>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={save} disabled={pending}>
                {t("save")}
              </Button>
              <span role="status" aria-live="polite" className="text-sm font-semibold text-ok">
                {status}
              </span>
              {error && (
                <span role="alert" className="text-sm font-semibold text-bad">
                  {error}
                </span>
              )}
            </div>
          </div>
        </Panel>

        <Panel title={t("tables")}>
          {tables.length === 0 ? (
            <p className="text-muted">{t("noTables")}</p>
          ) : (
            <>
              <label className="mb-2 flex min-h-11 items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={selected.length === tables.length}
                  onChange={(e) => setSelected(e.target.checked ? tables.map((x) => x.id) : [])}
                  className="size-[18px] accent-[var(--navy)]"
                />
                {t("selectAll")}
              </label>
              <ul className="grid gap-1 sm:grid-cols-2">
                {tables.map((table) => (
                  <li
                    key={table.id}
                    className="flex items-center justify-between gap-2 rounded-btn border border-line-2 px-3 py-1.5"
                  >
                    <label className="flex min-h-11 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={t("select", { label: table.label })}
                        checked={selected.includes(table.id)}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked ? [...s, table.id] : s.filter((id) => id !== table.id),
                          )
                        }
                        className="size-[18px] accent-[var(--navy)]"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewId(table.id)}
                        className="text-left font-bold"
                      >
                        Mesa {table.label}
                      </button>
                      <span className="text-xs text-muted">{t("version", { n: table.tokenVersion })}</span>
                    </label>
                    <Button size="sm" variant="ghost" onClick={() => rotate(table)} disabled={pending}>
                      {t("rotate")}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <div className="order-first grid gap-5 lg:sticky lg:top-6 lg:order-none">
        <section aria-label={t("preview", { label: previewTable.label })}>
          <h2 className="mb-2 text-sm font-bold text-muted">{t("preview", { label: previewTable.label })}</h2>
          <QrCardPreview design={design} table={previewTable} />
        </section>

        <Panel title={t("checks")}>
          <ul className="grid gap-2 text-sm">
            <li className={safety.lowContrast ? "font-semibold text-bad" : "text-ok"}>
              {safety.lowContrast
                ? t("contrastLow", { ratio: safety.ratio.toFixed(1) })
                : t("contrastOk", { ratio: safety.ratio.toFixed(1) })}
            </li>
            {safety.inverted && <li className="font-semibold text-bad">{t("inverted")}</li>}
            {design.logoMode !== "none" && <li className="text-muted">{t("logoEc")}</li>}
            <li className="text-muted">{t("testScan")}</li>
          </ul>
        </Panel>

        <Panel title={t("download")}>
          <p className="mb-3 text-sm text-muted">{t("downloadFor", { count: selected.length })}</p>
          <ul className="grid gap-2">
            {(["sheet", "tent", "sticker"] as const).map((f) => (
              <li key={f}>
                <a
                  href={selected.length ? pdfHref(f) : undefined}
                  aria-disabled={selected.length === 0 || undefined}
                  download
                  className={cn(
                    "flex min-h-14 items-center justify-between gap-3 rounded-btn border border-line px-4 py-2 hover:border-blue",
                    selected.length === 0 && "pointer-events-none opacity-50",
                  )}
                >
                  <span>
                    <b className="block">{t(`formats.${f}.title`)}</b>
                    <span className="text-xs text-muted">{t(`formats.${f}.body`)}</span>
                  </span>
                  <span aria-hidden className="font-bold text-blue">
                    PDF ↓
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
