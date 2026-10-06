"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/controls";
import { Link } from "@/i18n/navigation";
import {
  requestPasswordReset,
  setNewPassword,
  signUp,
  type NewPasswordState,
  type ResetState,
  type SignupState,
} from "@/lib/auth/signup";

export function SignupForm({ locale }: { locale: "es" | "en" }) {
  const t = useTranslations("auth.signup");
  const [state, action, pending] = useActionState(signUp, { status: "idle" } as SignupState);
  const bad = (f: string) => (state.fields?.includes(f) ? t(`errors.${f}`) : undefined);

  if (state.status === "confirm_email") {
    return (
      <p role="status" className="rounded-card bg-ok-bg px-5 py-4 font-semibold text-ok">
        {t("confirmEmail")}
      </p>
    );
  }

  return (
    <form action={action} noValidate className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      <Field label={t("fullName")} name="fullName" autoComplete="name" required error={bad("fullName")} />
      <Field
        label={t("email")}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={bad("email")}
      />
      <Field
        label={t("password")}
        name="password"
        type="password"
        autoComplete="new-password"
        hint={t("passwordHint")}
        required
        error={bad("password")}
      />
      <Field
        label={t("restaurantName")}
        name="restaurantName"
        autoComplete="organization"
        required
        error={bad("restaurantName")}
      />
      <Field label={t("phone")} name="phone" type="tel" autoComplete="tel" required error={bad("phone")} />
      <label className="flex items-start gap-2.5 text-sm text-ink-2">
        <input
          type="checkbox"
          name="terms"
          required
          className="mt-0.5 size-[18px] shrink-0 accent-[var(--navy)]"
        />
        <span>
          {t.rich("terms", {
            terms: () => (
              <Link href="/legal/terminos" className="font-semibold text-blue underline">
                {t("termsLink")}
              </Link>
            ),
            privacy: () => (
              <Link href="/legal/privacidad" className="font-semibold text-blue underline">
                {t("privacyLink")}
              </Link>
            ),
          })}
        </span>
      </label>
      {bad("terms") && <p className="text-sm font-semibold text-bad">{bad("terms")}</p>}
      {state.error && state.error !== "invalid" && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <Button type="submit" size="lg" block disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}

export function ResetRequestForm() {
  const t = useTranslations("auth.reset");
  const tl = useTranslations("auth");
  const [state, action, pending] = useActionState(requestPasswordReset, { status: "idle" } as ResetState);
  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-card bg-ok-bg px-5 py-4 font-semibold text-ok">
        {t("sent")}
      </p>
    );
  }
  return (
    <form action={action} className="grid gap-4">
      <Field
        label={tl("email")}
        name="email"
        type="email"
        autoComplete="email"
        required
        error={state.status === "error" ? t("invalid") : undefined}
      />
      <Button type="submit" size="lg" block disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}

export function NewPasswordForm() {
  const t = useTranslations("auth.reset");
  const [state, action, pending] = useActionState(setNewPassword, { status: "idle" } as NewPasswordState);
  return (
    <form action={action} className="grid gap-4">
      <Field label={t("newPassword")} name="password" type="password" autoComplete="new-password" required />
      <Field label={t("confirm")} name="confirm" type="password" autoComplete="new-password" required />
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-bad">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <Button type="submit" size="lg" block disabled={pending}>
        {t("save")}
      </Button>
    </form>
  );
}
