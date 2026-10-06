"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { printerDriver } from "@/connectors/printing";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/controls";
import { Panel, Pill } from "@/components/ui/surface";
import { readableOn } from "@/lib/brand";
import {
  decideSupport,
  saveBrand,
  saveIvu,
  savePrinter,
  saveProfile,
  type FormResult,
} from "@/lib/settings/actions";

const selectClass =
  "min-h-11 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base text-ink focus:border-sky focus:outline-none disabled:opacity-60";

function Select({
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & React.ComponentProps<"select">) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
      {label}
      <select className={selectClass} {...props}>
        {children}
      </select>
    </label>
  );
}

function Result({ state }: { state: FormResult }) {
  const t = useTranslations("settings");
  return (
    <p role="status" aria-live="polite" className="text-sm">
      {state?.ok && <span className="font-semibold text-ok">{t(`done.${state.code ?? "saved"}`)}</span>}
      {state && !state.ok && <span className="font-semibold text-bad">{t(`errors.${state.error}`)}</span>}
    </p>
  );
}

export interface ProfileValues {
  name: string;
  slug: string;
  timezone: string;
  default_language: "es" | "en";
  default_menu_style: "house" | "original" | "simple";
}

const TIMEZONES = ["America/Puerto_Rico", "America/New_York", "America/Chicago", "America/Los_Angeles"];

export function ProfileForm({
  slug,
  values,
  canEdit,
}: {
  slug: string;
  values: ProfileValues;
  canEdit: boolean;
}) {
  const t = useTranslations("settings.profile");
  const [state, action, pending] = useActionState<FormResult, FormData>(saveProfile.bind(null, slug), null);
  return (
    <Panel title={t("title")}>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <fieldset disabled={!canEdit} className="contents">
          <Field label={t("name")} name="name" defaultValue={values.name} required maxLength={120} />
          <Field
            label={t("slug")}
            name="slug"
            defaultValue={values.slug}
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            hint={t("slugHint")}
          />
          <Select label={t("timezone")} name="timezone" defaultValue={values.timezone}>
            {Array.from(new Set([values.timezone, ...TIMEZONES])).map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </Select>
          <Select label={t("language")} name="default_language" defaultValue={values.default_language}>
            <option value="es">Español</option>
            <option value="en">English</option>
          </Select>
          <Select label={t("menuStyle")} name="default_menu_style" defaultValue={values.default_menu_style}>
            {(["house", "original", "simple"] as const).map((s) => (
              <option key={s} value={s}>
                {t(`styles.${s}`)}
              </option>
            ))}
          </Select>
        </fieldset>
        <div className="flex items-end gap-3 sm:col-span-2">
          {canEdit ? (
            <Button type="submit" disabled={pending}>
              {t("save")}
            </Button>
          ) : (
            <p className="text-sm text-muted">{t("ownerOnly")}</p>
          )}
          <Result state={state} />
        </div>
      </form>
    </Panel>
  );
}

export function IvuForm({
  slug,
  stateBps,
  municipalBps,
  canEdit,
}: {
  slug: string;
  stateBps: number;
  municipalBps: number;
  canEdit: boolean;
}) {
  const t = useTranslations("settings.ivu");
  const [state, action, pending] = useActionState<FormResult, FormData>(saveIvu.bind(null, slug), null);
  return (
    <Panel title={t("title")}>
      <p className="mb-3 text-sm text-muted">{t("lead")}</p>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <fieldset disabled={!canEdit} className="contents">
          <Field
            label={t("state")}
            name="state"
            inputMode="decimal"
            defaultValue={String(stateBps / 100)}
            required
          />
          <Field
            label={t("municipal")}
            name="municipal"
            inputMode="decimal"
            defaultValue={String(municipalBps / 100)}
            required
          />
        </fieldset>
        <div className="flex items-end gap-3 sm:col-span-2">
          {canEdit && (
            <Button type="submit" disabled={pending}>
              {t("save")}
            </Button>
          )}
          <Result state={state} />
        </div>
      </form>
    </Panel>
  );
}

export function BrandForm({
  slug,
  name,
  color,
  coverSrc,
  logoSrc,
  canEdit,
}: {
  slug: string;
  name: string;
  color: string | null;
  coverSrc: string | null;
  logoSrc: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations("settings.brand");
  const [state, action, pending] = useActionState<FormResult, FormData>(saveBrand.bind(null, slug), null);
  const [useColor, setUseColor] = useState(Boolean(color));
  const [value, setValue] = useState(color ?? "#1E2B7E");
  const header = useColor ? readableOn(value) : null;
  const [, startSave] = useTransition();
  return (
    <Panel title={t("title")}>
      <p className="mb-3 text-sm text-muted">{t("lead")}</p>
      {/* Submitted by hand: an action-bound form is reset after saving, which unticks the colour box. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startSave(() => action(data));
        }}
        className="grid gap-3"
      >
        <fieldset disabled={!canEdit} className="grid gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="use_color"
              checked={useColor}
              onChange={(e) => setUseColor(e.target.checked)}
              className="size-4"
            />
            {t("useColor")}
          </label>
          {useColor && (
            <label className="flex items-center gap-3 text-[13px] font-bold text-ink-2">
              {t("color")}
              <input
                type="color"
                name="brand_color"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-10 w-16 cursor-pointer rounded border border-line bg-bg"
              />
              <span className="tabular font-normal text-muted">{value.toUpperCase()}</span>
            </label>
          )}
          {/* Preview of the guest header with this colour, or Mezza navy when it isn't readable. */}
          <div className="overflow-hidden rounded-xl border border-line" aria-label={t("preview")}>
            {coverSrc && (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
              <img src={coverSrc} alt="" className="h-20 w-full object-cover" />
            )}
            <div
              className="flex items-center gap-2 px-3 py-2.5"
              style={{ background: header?.background ?? "var(--navy)", color: header?.ink ?? "#fff" }}
            >
              {logoSrc && (
                // eslint-disable-next-line @next/next/no-img-element -- signed storage URL
                <img src={logoSrc} alt="" className="size-7 rounded-full bg-white object-contain" />
              )}
              <b>{name}</b>
            </div>
          </div>
          {useColor && header?.fallback && <p className="text-sm text-warn">{t("lowContrast")}</p>}
          <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
            {t("cover")}
            <input
              type="file"
              name="cover"
              accept="image/png,image/jpeg,image/webp"
              className="text-sm font-normal"
            />
            <span className="font-normal text-muted">{t("coverHint")}</span>
          </label>
          {coverSrc && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="remove_cover" className="size-4" />
              {t("removeCover")}
            </label>
          )}
          <p className="text-sm text-muted">{logoSrc ? t("logoFromQr") : t("noLogo")}</p>
        </fieldset>
        <div className="flex items-center gap-3">
          {canEdit && (
            <Button type="submit" disabled={pending}>
              {t("save")}
            </Button>
          )}
          <Result state={state} />
        </div>
      </form>
    </Panel>
  );
}

export interface PrinterRow {
  id: string;
  name: string;
  model: string | null;
  ip_address: string | null;
  protocol: "browser" | "epson_epos" | "star_webprnt";
  role: "kitchen" | "receipt";
  width_chars: number;
  active: boolean;
}

function PrinterForm({ slug, printer, onDone }: { slug: string; printer?: PrinterRow; onDone?: () => void }) {
  const t = useTranslations("settings.printers");
  const [state, action, pending] = useActionState<FormResult, FormData>(async (prev, form) => {
    const r = await savePrinter(slug, prev, form);
    if (r?.ok) onDone?.();
    return r;
  }, null);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={printer?.id ?? ""} />
      <Field label={t("name")} name="name" defaultValue={printer?.name ?? ""} required maxLength={60} />
      <Field label={t("model")} name="model" defaultValue={printer?.model ?? ""} maxLength={60} />
      <Select label={t("protocol")} name="protocol" defaultValue={printer?.protocol ?? "browser"}>
        {(["browser", "epson_epos", "star_webprnt"] as const).map((p) => (
          <option key={p} value={p}>
            {t(`protocols.${p}`)}
          </option>
        ))}
      </Select>
      <Field label={t("ip")} name="ip_address" defaultValue={printer?.ip_address ?? ""} hint={t("ipHint")} />
      <Select label={t("role")} name="role" defaultValue={printer?.role ?? "kitchen"}>
        <option value="kitchen">{t("roles.kitchen")}</option>
        <option value="receipt">{t("roles.receipt")}</option>
      </Select>
      <Select label={t("width")} name="width_chars" defaultValue={String(printer?.width_chars ?? 42)}>
        {[32, 42, 48].map((w) => (
          <option key={w} value={w}>
            {t("widthValue", { n: w })}
          </option>
        ))}
      </Select>
      <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
        <input type="checkbox" name="active" defaultChecked={printer?.active ?? true} className="size-4" />
        {t("active")}
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {printer ? t("save") : t("add")}
        </Button>
        <Result state={state} />
      </div>
    </form>
  );
}

export function PrintersPanel({
  slug,
  printers,
  restaurantName,
}: {
  slug: string;
  printers: PrinterRow[];
  restaurantName: string;
}) {
  const t = useTranslations("settings.printers");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function testPrint(p: PrinterRow) {
    const result = await printerDriver(p.protocol)
      .print(
        { id: p.id, ipAddress: p.ip_address ?? undefined, widthChars: p.width_chars },
        {
          kind: p.role,
          restaurantName,
          tableLabel: "0",
          orderNumber: 0,
          createdAt: new Date().toISOString(),
          locale: "es",
          lines: [{ qty: 1, name: t("testLine"), modifiers: [] }],
          footer: t("testFooter"),
        },
      )
      .catch(() => ({ ok: false as const, error: "coming_soon" }));
    setTestResult(result.ok ? t("testSent", { name: p.name }) : t("testSoon", { name: p.name }));
  }

  return (
    <Panel
      title={t("title")}
      actions={
        !adding && (
          <Button variant="soft" size="sm" onClick={() => setAdding(true)}>
            {t("new")}
          </Button>
        )
      }
    >
      {adding && (
        <div className="mb-4 rounded-xl border border-line p-3">
          <PrinterForm slug={slug} onDone={() => setAdding(false)} />
        </div>
      )}
      {printers.length === 0 && !adding && <p className="text-sm text-muted">{t("none")}</p>}
      <ul className="divide-y divide-line-2">
        {printers.map((p) => (
          <li key={p.id} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{p.name}</p>
                <p className="text-sm text-muted">
                  {t(`roles.${p.role}`)} · {t(`protocols.${p.protocol}`)}
                  {p.ip_address ? ` · ${p.ip_address}` : ""} · {t("widthValue", { n: p.width_chars })}
                </p>
              </div>
              {!p.active && <Pill tone="idle">{t("inactive")}</Pill>}
              <Button variant="ghost" size="sm" onClick={() => void testPrint(p)}>
                {t("test")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(editing === p.id ? null : p.id)}>
                {editing === p.id ? t("close") : t("edit")}
              </Button>
            </div>
            {editing === p.id && (
              <div className="mt-3 rounded-xl border border-line p-3">
                <PrinterForm slug={slug} printer={p} onDone={() => setEditing(null)} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {testResult && (
        <p role="status" className="mt-2 text-sm font-semibold">
          {testResult}
        </p>
      )}
    </Panel>
  );
}

export interface GrantRow {
  id: string;
  reason: string;
  requestedBy: string;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
}

export function SupportPanel({
  slug,
  grants,
  canEdit,
}: {
  slug: string;
  grants: GrantRow[];
  canEdit: boolean;
}) {
  const t = useTranslations("settings.support");
  const [busy, start] = useTransition();
  const [result, setResult] = useState<FormResult>(null);
  const when = (iso: string) =>
    new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  return (
    <Panel title={t("title")}>
      <p className="mb-3 text-sm text-muted">{t("lead")}</p>
      {grants.length === 0 ? (
        <p className="text-sm text-muted">{t("none")}</p>
      ) : (
        <ul className="divide-y divide-line-2">
          {grants.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{g.reason}</p>
                <p className="text-sm text-muted">
                  {t("requested", { who: g.requestedBy, when: when(g.createdAt) })} ·{" "}
                  {t("until", { when: when(g.expiresAt) })}
                </p>
              </div>
              <Pill tone={g.approvedAt ? "ok" : "warn"}>{g.approvedAt ? t("active") : t("pending")}</Pill>
              {canEdit && (
                <>
                  {!g.approvedAt && (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => start(async () => setResult(await decideSupport(slug, g.id, true)))}
                    >
                      {t("approve")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => start(async () => setResult(await decideSupport(slug, g.id, false)))}
                  >
                    {g.approvedAt ? t("end") : t("decline")}
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <Result state={result} />
    </Panel>
  );
}
