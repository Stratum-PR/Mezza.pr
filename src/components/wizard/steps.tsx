"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import {
  wizardConnectPayment,
  wizardInvite,
  wizardTables,
  wizardUploadMenu,
  type WizardState,
} from "@/app/app/[restaurant]/empezar/actions";
import { QrSvg } from "@/components/qr/qr-svg";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/controls";
import { QR_PRESETS, type QrPresetId } from "@/config/qr-presets";
import { cn } from "@/lib/cn";
import { renderQr } from "@/lib/qr/render";

const idle: WizardState = { status: "idle" };

function ErrorLine({ state }: { state: WizardState }) {
  const t = useTranslations("wizard.errors");
  if (state.status !== "error" || !state.error) return null;
  return (
    <p role="alert" className="text-sm font-semibold text-bad">
      {t(state.error)}
    </p>
  );
}

export function MenuStep({ slug }: { slug: string }) {
  const t = useTranslations("wizard.menu");
  const [state, action, pending] = useActionState(wizardUploadMenu.bind(null, slug), idle);
  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-1.5 text-[13px] font-bold text-ink-2">
        {t("file")}
        <input
          type="file"
          name="menu"
          required
          accept="image/jpeg,image/png"
          className="min-h-11 text-sm font-normal file:mr-3 file:min-h-11 file:rounded-btn file:border-0 file:bg-soft file:px-4 file:font-bold file:text-ink"
        />
      </label>
      <ErrorLine state={state} />
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {t("upload")}
        </Button>
      </div>
    </form>
  );
}

export function TablesStep({
  slug,
  existing,
  preset,
}: {
  slug: string;
  existing: number;
  preset: QrPresetId;
}) {
  const t = useTranslations("wizard.tables");
  const [state, action, pending] = useActionState(wizardTables.bind(null, slug), idle);
  const [chosen, setChosen] = useState<QrPresetId>(preset);
  return (
    <form action={action} className="grid gap-5">
      {existing > 0 && <p className="text-sm text-muted">{t("existing", { count: existing })}</p>}
      <Field
        label={t("count")}
        name="count"
        type="number"
        min={1}
        max={80}
        defaultValue={existing || 10}
        required
        className="max-w-[200px]"
      />
      <label className="grid gap-1.5 text-[13px] font-bold text-ink-2">
        {t("labels")}
        <textarea
          name="labels"
          rows={2}
          className="rounded-btn border-[1.5px] border-line bg-bg px-3.5 py-3 text-base font-normal text-ink focus:border-sky focus:bg-surface focus:outline-none"
        />
        <span className="font-normal text-muted">{t("labelsHint")}</span>
      </label>
      <fieldset>
        <legend className="mb-2 text-[13px] font-bold text-ink-2">{t("preset")}</legend>
        <div className="grid grid-cols-3 gap-3">
          {(Object.keys(QR_PRESETS) as QrPresetId[]).map((id) => {
            const p = QR_PRESETS[id];
            const render = renderQr("https://mezza.pr/demo", {
              fg: p.fg,
              bg: p.bg,
              dotStyle: p.dot_style,
              eyeStyle: p.eye_style,
              logoMode: p.logo_mode,
              monogram: "M",
            });
            return (
              <label
                key={id}
                className={cn(
                  "grid cursor-pointer justify-items-center gap-2 rounded-card border-2 p-3 text-sm font-bold",
                  chosen === id ? "border-blue bg-soft" : "border-line",
                )}
              >
                <input
                  type="radio"
                  name="preset"
                  value={id}
                  checked={chosen === id}
                  onChange={() => setChosen(id)}
                  className="sr-only"
                />
                <span className="w-full rounded-lg p-2" style={{ background: p.frame }}>
                  <QrSvg render={render} label="" className="w-full" />
                </span>
                {t(`presets.${id}`)}
              </label>
            );
          })}
        </div>
      </fieldset>
      <ErrorLine state={state} />
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

export function PaymentsStep({ slug, status }: { slug: string; status: Record<"card" | "ath", string> }) {
  const t = useTranslations("wizard.payments");
  const [state, setState] = useState<WizardState>(idle);
  const [pending, start] = useTransition();
  const methods = [
    { id: "cash" as const, connected: true },
    { id: "card" as const, connected: status.card === "connected" },
    { id: "ath" as const, connected: status.ath === "connected" },
  ];
  return (
    <div className="grid gap-4">
      <ul className="grid gap-3 sm:grid-cols-3">
        {methods.map((m) => (
          <li key={m.id} className="grid gap-2 rounded-card border border-line bg-bg p-4">
            <b className="text-lg">{t(m.id)}</b>
            <span className={cn("text-sm font-semibold", m.connected ? "text-ok" : "text-muted")}>
              {m.id === "cash" ? t("always") : m.connected ? t("connected") : t("notConnected")}
            </span>
            {m.id !== "cash" && !m.connected && (
              <Button
                size="sm"
                variant={m.id === "ath" ? "ath" : "primary"}
                disabled={pending}
                onClick={() =>
                  start(async () => setState(await wizardConnectPayment(slug, m.id as "card" | "ath")))
                }
              >
                {t("connect")}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {status.card !== "connected" && status.ath !== "connected" && (
        <p className="rounded-btn bg-sandsoft px-4 py-3 text-sm font-semibold text-olive">
          {t("payWithServer")}
        </p>
      )}
      <ErrorLine state={state} />
    </div>
  );
}

export function StaffStep({ slug }: { slug: string }) {
  const t = useTranslations("wizard.staff");
  const [invited, setInvited] = useState<string[]>([]);
  const [state, action, pending] = useActionState(async (prev: WizardState, form: FormData) => {
    const result = await wizardInvite(slug, prev, form);
    if (result.status === "ok" && result.message) setInvited((list) => [...list, result.message!]);
    return result;
  }, idle);
  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <Field label={t("email")} name="email" type="email" autoComplete="off" required />
        <label className="grid gap-1.5 text-[13px] font-bold text-ink-2">
          {t("role")}
          <select
            name="role"
            defaultValue="server"
            className="min-h-11 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base font-normal text-ink"
          >
            {(["manager", "server", "kitchen"] as const).map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={pending}>
          {t("invite")}
        </Button>
      </form>
      <ErrorLine state={state} />
      {invited.length > 0 && (
        <ul role="status" className="grid gap-1">
          {invited.map((email) => (
            <li key={email} className="text-sm font-semibold text-ok">
              ✓ {t("invited", { email })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
