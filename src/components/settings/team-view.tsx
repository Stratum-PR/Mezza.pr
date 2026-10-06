"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/controls";
import { Pill, Panel } from "@/components/ui/surface";
import { inviteMember, updateMember, type FormResult } from "@/lib/settings/actions";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: "owner" | "manager" | "server" | "kitchen";
  active: boolean;
  isMe: boolean;
}

const selectClass =
  "min-h-11 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base text-ink focus:border-sky focus:outline-none";

export function TeamView({ slug, members, isOwner }: { slug: string; members: Member[]; isOwner: boolean }) {
  const t = useTranslations("settings.team");
  const tr = useTranslations("settings.roles");
  const [state, action, pending] = useActionState<FormResult, FormData>(inviteMember.bind(null, slug), null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const roles = isOwner ? (["manager", "server", "kitchen"] as const) : (["server", "kitchen"] as const);

  const change = (id: string, patch: { role?: Member["role"]; active?: boolean }) =>
    start(async () => {
      const r = await updateMember(slug, { memberId: id, ...(patch as { role?: "server" }) });
      setRowError(r && !r.ok ? t(`errors.${r.error}`) : null);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Panel title={t("members")}>
        {rowError && (
          <p role="alert" className="mb-2 text-sm font-semibold text-bad">
            {rowError}
          </p>
        )}
        <ul className="divide-y divide-line-2">
          {members.map((m) => {
            const locked = m.role === "owner" || m.isMe || (!isOwner && m.role === "manager");
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {m.name || m.email}
                    {m.isMe && <span className="font-normal text-muted"> · {t("you")}</span>}
                  </p>
                  <p className="truncate text-sm text-muted">{m.email}</p>
                </div>
                {!m.active && <Pill tone="idle">{t("inactive")}</Pill>}
                {locked ? (
                  <Pill tone="navy">{tr(m.role)}</Pill>
                ) : (
                  <>
                    <select
                      aria-label={t("roleFor", { name: m.name || m.email })}
                      value={m.role}
                      disabled={busy}
                      onChange={(e) => change(m.id, { role: e.target.value as Member["role"] })}
                      className={selectClass}
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {tr(r)}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant={m.active ? "ghost" : "soft"}
                      size="sm"
                      disabled={busy}
                      onClick={() => change(m.id, { active: !m.active })}
                    >
                      {m.active ? t("deactivate") : t("reactivate")}
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>

      <div className="grid content-start gap-4">
        <Panel title={t("invite")}>
          <form action={action} className="grid gap-3">
            <Field label={t("name")} name="name" required maxLength={80} autoComplete="off" />
            <Field label={t("email")} name="email" type="email" required autoComplete="off" />
            <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
              {t("role")}
              <select name="role" defaultValue="server" className={selectClass}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {tr(r)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? t("sending") : t("send")}
            </Button>
            <p role="status" aria-live="polite" className="text-sm">
              {state?.ok && <span className="font-semibold text-ok">{t(`done.${state.code}`)}</span>}
              {state && !state.ok && (
                <span className="font-semibold text-bad">{t(`errors.${state.error}`)}</span>
              )}
            </p>
          </form>
        </Panel>
        <Panel title={t("pinTitle")}>
          <p className="text-sm text-muted">{t("pinSoon")}</p>
        </Panel>
      </div>
    </div>
  );
}
