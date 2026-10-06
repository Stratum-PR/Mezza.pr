"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Voids and refunds: a reason is required (3+ characters, audited); refunds also ask for an amount.
 * Replaces the browser's prompt() with the same dialog style as the cash dialog.
 */
export function ReasonDialog({
  title,
  amountLabel,
  confirmLabel,
  danger = true,
  onSubmit,
  onClose,
}: {
  title: string;
  amountLabel?: string;
  confirmLabel: string;
  danger?: boolean;
  onSubmit: (values: { reason: string; amount?: string }) => void;
  onClose: () => void;
}) {
  const t = useTranslations("staff.reason");
  const id = useId();
  const first = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const valid = reason.trim().length >= 3 && (!amountLabel || /^\d+(\.\d{1,2})?$/.test(amount.trim()));

  useEffect(() => {
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const field =
    "mt-1.5 block w-full rounded-btn border-[1.5px] border-line bg-bg px-3 py-2 text-base text-ink focus:border-sky focus:outline-none";

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(10,14,40,.5)] p-4" onClick={onClose}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="grid w-full max-w-sm gap-3 rounded-card bg-surface p-5 shadow-dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit({ reason: reason.trim(), amount: amountLabel ? amount.trim() : undefined });
        }}
      >
        <h2 id={`${id}-title`} className="text-xl font-extrabold">
          {title}
        </h2>
        {amountLabel && (
          <label className="text-[13px] font-bold text-ink-2">
            {amountLabel}
            <input
              ref={first}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={field}
            />
          </label>
        )}
        <label className="text-[13px] font-bold text-ink-2">
          {t("label")}
          <textarea
            ref={amountLabel ? undefined : first}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={2}
            className={field}
          />
          <span className="mt-1 block font-normal text-muted">{t("hint")}</span>
        </label>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={!valid}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
