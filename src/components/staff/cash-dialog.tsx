"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { printerDriver } from "@/connectors/printing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import type { FloorOrder } from "@/lib/staff/floor";

/** Next round amounts above what's owed: $20 / $40 / $50 style, plus "exact". */
export function quickAmounts(dueCents: number): number[] {
  const steps = [500, 1000, 2000, 4000, 5000, 10000];
  const out: number[] = [];
  for (const s of steps) {
    const v = Math.ceil(dueCents / s) * s;
    if (v > dueCents && !out.includes(v)) out.push(v);
    if (out.length === 3) break;
  }
  return out;
}

/**
 * "Efectivo recibido": what's owed, what the guest handed over (quick amounts or keypad), the change
 * in large type, then a confirmation with the receipt. Confirming calls the same confirmCash action.
 */
export function CashDialog({
  tableLabel,
  dueCents,
  orders,
  restaurantName,
  locale,
  onConfirm,
  onClose,
}: {
  tableLabel: string;
  dueCents: number;
  orders: FloorOrder[];
  restaurantName: string;
  locale: "es" | "en";
  onConfirm: () => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("staff.cash");
  const [digits, setDigits] = useState(""); // cents typed on the keypad
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ at: string; received: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const money = (c: number) => formatCents(c, locale);
  const received = digits ? Number(digits) : 0;
  const change = received - dueCents;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const press = (k: string) =>
    setDigits((d) => (k === "⌫" ? d.slice(0, -1) : k === "00" ? (d ? `${d}00` : d) : `${d}${k}`).slice(0, 7));

  async function confirm() {
    setBusy(true);
    const ok = await onConfirm();
    setBusy(false);
    if (ok) setDone({ at: new Date().toISOString(), received: received || dueCents });
  }

  function printReceipt() {
    const lines = orders
      .filter((o) => o.status !== "void")
      .flatMap((o) => o.lines.filter((l) => !l.voided))
      .map((l) => ({ qty: l.qty, name: locale === "es" ? l.nameEs : l.nameEn, modifiers: l.options }));
    void printerDriver("browser").print(
      { id: "browser", widthChars: 42 },
      {
        kind: "receipt",
        restaurantName,
        tableLabel,
        orderNumber: orders[0]?.number ?? 0,
        createdAt: done?.at ?? new Date().toISOString(),
        locale,
        lines,
        footer: `${t("total")}: ${money(dueCents)} · ${t("method")}`,
      },
    );
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(10,14,40,.5)] p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cash-title"
        className="w-full max-w-sm rounded-card bg-surface p-5 shadow-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="cash-title" className="text-xl font-extrabold">
              {done ? t("doneTitle") : t("title")}
            </h2>
            <p className="text-sm text-muted">{t("table", { label: tableLabel })}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid size-10 place-items-center rounded-[10px] bg-soft text-xl leading-none"
          >
            ×
          </button>
        </div>

        {done ? (
          <div className="grid gap-3 text-center">
            <p
              aria-hidden
              className="mx-auto grid size-16 place-items-center rounded-full bg-ok-bg text-3xl text-ok"
            >
              ✓
            </p>
            <p className="tabular text-3xl font-extrabold">{money(dueCents)}</p>
            <dl className="grid gap-1 text-left text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">{t("methodLabel")}</dt>
                <dd className="font-semibold">{t("method")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("received")}</dt>
                <dd className="tabular font-semibold">{money(done.received)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">{t("change")}</dt>
                <dd className="tabular font-semibold">{money(Math.max(0, done.received - dueCents))}</dd>
              </div>
            </dl>
            <Button variant="soft" onClick={printReceipt}>
              {t("print")}
            </Button>
            <Button onClick={onClose}>{t("back")}</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted">{t("due")}</span>
              <b className="tabular text-2xl">{money(dueCents)}</b>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setDigits(String(dueCents))}
                className="min-h-11 rounded-btn border border-line text-sm font-bold"
              >
                {t("exact")}
              </button>
              {quickAmounts(dueCents).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDigits(String(c))}
                  className="tabular min-h-11 rounded-btn border border-line text-sm font-bold"
                >
                  {money(c)}
                </button>
              ))}
            </div>
            <output
              aria-label={t("received")}
              className="tabular block rounded-btn border-[1.5px] border-line bg-bg px-3 py-2 text-right text-2xl font-extrabold"
            >
              {money(received)}
            </output>
            <div className="grid grid-cols-3 gap-1.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"].map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => press(k)}
                  aria-label={k === "⌫" ? t("erase") : undefined}
                  className="tabular min-h-12 rounded-btn border border-line text-lg font-bold"
                >
                  {k}
                </button>
              ))}
            </div>
            <div
              aria-live="polite"
              className={cn(
                "flex items-baseline justify-between rounded-btn px-3 py-2",
                change >= 0 && received > 0 ? "bg-ok-bg text-ok" : "bg-soft text-ink-2",
              )}
            >
              <span className="text-sm font-bold">{change >= 0 || !received ? t("change") : t("short")}</span>
              <b className="tabular text-3xl">{received ? money(Math.abs(change)) : "—"}</b>
            </div>
            <Button
              variant="ok"
              size="lg"
              disabled={busy || (received > 0 && change < 0)}
              onClick={() => void confirm()}
            >
              {t("confirm")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
