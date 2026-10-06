"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { requestSupport } from "@/lib/admin/actions";
import type { FormResult } from "@/lib/settings/actions";

const inputClass =
  "min-h-11 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base text-ink focus:border-sky focus:outline-none";

export function SupportRequestForm({ restaurants }: { restaurants: { id: string; name: string }[] }) {
  const t = useTranslations("admin.supportForm");
  const [state, action, pending] = useActionState<FormResult, FormData>(requestSupport, null);
  return (
    <form action={action} className="grid gap-3">
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
        {t("restaurant")}
        <select name="restaurantId" required className={inputClass}>
          {restaurants.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
        {t("reason")}
        <textarea
          name="reason"
          required
          minLength={5}
          maxLength={500}
          rows={2}
          className={`${inputClass} py-2`}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink-2">
        {t("hours")}
        <select name="hours" defaultValue="4" className={inputClass}>
          {[1, 4, 24, 72].map((h) => (
            <option key={h} value={h}>
              {t("hoursValue", { h })}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {t("send")}
        </Button>
        <p role="status" aria-live="polite" className="text-sm font-semibold">
          {state?.ok && <span className="text-ok">{t("sent")}</span>}
          {state && !state.ok && <span className="text-bad">{t("error")}</span>}
        </p>
      </div>
    </form>
  );
}
