"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { requestDemo, type DemoRequestState } from "@/app/[locale]/demo/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/controls";

export function DemoRequestForm({ locale }: { locale: "es" | "en" }) {
  const t = useTranslations("site.demo.form");
  const [state, action, pending] = useActionState(requestDemo, { status: "idle" } as DemoRequestState);
  const bad = (f: string) => (state.fields?.includes(f) ? t(`errors.${f}`) : undefined);

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-card bg-ok-bg px-5 py-4 font-semibold text-ok">
        {t("sent")}
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot, hidden from people and assistive tech. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] size-px opacity-0"
      />
      <Field label={t("name")} name="name" autoComplete="name" required error={bad("name")} />
      <Field label={t("restaurantName")} name="restaurantName" autoComplete="organization" />
      <Field
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={bad("email")}
      />
      <Field label={t("phone")} name="phone" type="tel" autoComplete="tel" error={bad("phone")} />
      <label className="grid gap-1.5 text-[13px] font-bold text-ink-2 sm:col-span-2">
        {t("message")}
        <textarea
          name="message"
          rows={4}
          maxLength={2000}
          className="rounded-btn border-[1.5px] border-line bg-bg px-3.5 py-3 text-base font-normal text-ink focus:border-sky focus:bg-surface focus:outline-none"
        />
      </label>
      {state.error && state.error !== "invalid" && (
        <p role="alert" className="text-sm font-semibold text-bad sm:col-span-2">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <p className="text-sm text-muted sm:col-span-2">{t("privacy")}</p>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" disabled={pending}>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
