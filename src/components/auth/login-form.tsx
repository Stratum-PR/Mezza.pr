"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/controls";
import { sendMagicLink, signInWithPassword, type AuthFormState } from "@/lib/auth/actions";

const idle: AuthFormState = { status: "idle" };

export function LoginForm({
  next,
  locale,
  linkError,
}: {
  next?: string;
  locale: "es" | "en";
  linkError?: boolean;
}) {
  const t = useTranslations("auth");
  const [pw, pwAction, pwPending] = useActionState(signInWithPassword, idle);
  const [link, linkAction, linkPending] = useActionState(sendMagicLink, idle);
  const error =
    pw.status === "error" ? pw.message : link.status === "error" ? link.message : linkError ? "link" : null;

  return (
    <div className="grid gap-4">
      <form action={pwAction} className="grid gap-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label={t("email")} name="email" type="email" autoComplete="email" required />
        <Field
          label={t("password")}
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && (
          <p role="alert" className="text-sm font-semibold text-bad">
            {t(`errors.${error}`)}
          </p>
        )}
        <Button type="submit" size="lg" block disabled={pwPending}>
          {t("submit")}
        </Button>
      </form>
      <p className="text-center text-sm text-muted">{t("or")}</p>
      <form action={linkAction} className="grid gap-3">
        <input type="hidden" name="next" value={next ?? ""} />
        <input type="hidden" name="locale" value={locale} />
        <Field label={t("email")} name="email" type="email" autoComplete="email" required />
        <Button type="submit" variant="soft" block disabled={linkPending}>
          {t("magicLink")}
        </Button>
        {link.status === "sent" && (
          <p role="status" className="text-sm font-semibold text-ok">
            {t("magicSent")}
          </p>
        )}
      </form>
    </div>
  );
}
