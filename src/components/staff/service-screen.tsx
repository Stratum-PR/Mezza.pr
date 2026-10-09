"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { MenuData } from "@/components/menu/types";
import { Button, buttonClass } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";
import {
  advanceOrder,
  cancelPendingPayment,
  closeOnPos,
  confirmCash,
  handleRequest,
  raiseTabLimit,
  refundPayment,
  voidLine,
  type StaffResult,
} from "@/lib/staff/actions";
import type { Floor } from "@/lib/staff/floor";
import { CashDialog } from "./cash-dialog";
import { useLiveRefresh, useMinutesSince } from "./live";
import { OrderFlags } from "./order-flags";
import { OrderStrip } from "./order-strip";
import { ReasonDialog } from "./reason-dialog";

export function ServiceScreen({
  slug,
  floor,
  menu,
  canManage,
  realtimeImpl,
}: {
  slug: string;
  floor: Floor;
  menu: MenuData;
  canManage: boolean;
  realtimeImpl: "polling" | "supabase_stub";
}) {
  const t = useTranslations("staff");
  const locale = useLocale() === "en" ? "en" : "es";
  const minutes = useMinutesSince();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [allOrders, setAllOrders] = useState(false);
  const [allPays, setAllPays] = useState(false);
  const [ask, setAsk] = useState<
    | { kind: "void"; orderId: string; lineId: string; name: string }
    | { kind: "refund"; paymentId: string; max: string }
    | null
  >(null);
  const [cashFor, setCashFor] = useState<Floor["cashToCollect"][number] | null>(null);
  useLiveRefresh(slug, "server", realtimeImpl);

  const run = (
    action: () => Promise<StaffResult>,
    ok: (r: StaffResult & { ok: true }) => string = () => t("service.done"),
  ) =>
    start(async () => {
      const r = await action();
      setMessage(r.ok ? { ok: true, text: ok(r) } : { ok: false, text: t(`errors.${r.error}`) });
    });

  const ready = floor.orders.filter((o) => o.status === "ready");
  const alertCount =
    floor.requests.length +
    floor.cashToCollect.length +
    ready.length +
    floor.posToClose.length +
    floor.nearLimit.length;
  const todays = floor.orders
    .filter((o) => o.status !== "void")
    .slice()
    .reverse();

  return (
    <div className="grid grid-cols-1 gap-4">
      <p
        role="status"
        aria-live="polite"
        className={cn("min-h-5 text-sm font-semibold", message?.ok === false ? "text-bad" : "text-ok")}
      >
        {message?.text}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface p-4">
        <p className="text-sm text-muted">{t("take.lead")}</p>
        <Link href={`/app/${slug}/servicio/orden`} className={buttonClass({ size: "md" })}>
          {t("take.open")}
        </Link>
      </div>
      <OrderStrip orders={floor.orders} minutes={minutes} />
      {ask && (
        <ReasonDialog
          title={ask.kind === "void" ? t("service.voidPrompt", { name: ask.name }) : t("service.refund")}
          amountLabel={ask.kind === "refund" ? t("service.refundAmount", { max: ask.max }) : undefined}
          confirmLabel={ask.kind === "void" ? t("reason.void") : t("reason.refund")}
          onClose={() => setAsk(null)}
          onSubmit={({ reason, amount }) => {
            const a = ask;
            setAsk(null);
            if (a.kind === "void")
              start(async () => {
                const r = await voidLine(slug, a.orderId, a.lineId, reason);
                const refunded = r.ok ? r.refunds.reduce((n, x) => n + x.amountCents, 0) : 0;
                setMessage(
                  r.ok
                    ? {
                        ok: true,
                        text: refunded
                          ? t("service.voidRefund", { amount: formatCents(refunded, locale) })
                          : t("service.done"),
                      }
                    : { ok: false, text: t(`errors.${r.error}`) },
                );
              });
            else
              run(
                () => refundPayment(slug, a.paymentId, amount ?? "", reason),
                () => t("service.refunded"),
              );
          }}
        />
      )}
      {cashFor && (
        <CashDialog
          tableLabel={cashFor.tableLabel}
          dueCents={cashFor.totalCents}
          orders={floor.orders.filter((o) => o.tabId === cashFor.tabId)}
          restaurantName={menu.restaurantName}
          locale={locale}
          onClose={() => setCashFor(null)}
          onConfirm={async () => {
            const r = await confirmCash(slug, cashFor.id);
            if (!r.ok) setMessage({ ok: false, text: t(`errors.${r.error}`) });
            return r.ok;
          }}
        />
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="grid gap-4">
          <Panel title={`${t("service.alerts")} (${alertCount})`}>
            {alertCount === 0 && <p className="text-muted">{t("service.noAlerts")}</p>}
            <ul className="grid gap-2">
              {floor.requests.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-2 rounded-[12px] border-l-4 border-l-warn bg-bg p-2.5"
                >
                  <span>
                    <b className="block">
                      {t(r.kind === "call_server" ? "service.callServer" : "service.bringCheck", {
                        label: r.tableLabel,
                      })}
                    </b>
                    <small className="text-muted">{t("minutes", { n: minutes(r.createdAt) })}</small>
                  </span>
                  <Button
                    size="sm"
                    variant="soft"
                    disabled={pending}
                    onClick={() => run(() => handleRequest(slug, r.id))}
                  >
                    {t("service.handled")}
                  </Button>
                </li>
              ))}
              {floor.cashToCollect.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-[12px] border-l-4 border-l-muted bg-bg p-2.5"
                >
                  <b>
                    {t("service.cash", { label: p.tableLabel, total: formatCents(p.totalCents, locale) })}
                  </b>
                  <span className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="soft"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () => cancelPendingPayment(slug, p.id),
                          () => t("service.cashCancelled"),
                        )
                      }
                    >
                      {t("service.cashCancel")}
                    </Button>
                    <Button size="sm" variant="ok" disabled={pending} onClick={() => setCashFor(p)}>
                      {t("service.cashReceived")}
                    </Button>
                  </span>
                </li>
              ))}
              {ready.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between gap-2 rounded-[12px] border-l-4 border-l-ok bg-bg p-2.5"
                >
                  <b>{t("service.ready", { number: o.number, label: o.tableLabel })}</b>
                  <Button
                    size="sm"
                    variant="soft"
                    disabled={pending}
                    onClick={() => run(() => advanceOrder(slug, o.id, "served"))}
                  >
                    {t("service.served")}
                  </Button>
                </li>
              ))}
              {floor.nearLimit.map((n) => (
                <li
                  key={`limit-${n.tabId}`}
                  className="flex items-center justify-between gap-2 rounded-[12px] border-l-4 border-l-warn bg-bg p-2.5"
                >
                  <b>
                    {t("service.nearLimit", {
                      label: n.tableLabel,
                      total: formatCents(n.subtotalCents, locale),
                      cap: formatCents(n.capCents, locale),
                    })}
                  </b>
                  <Button
                    size="sm"
                    variant="soft"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => raiseTabLimit(slug, n.tabId),
                        (r) => t("service.limitRaised", { cap: formatCents(r.number ?? 0, locale) }),
                      )
                    }
                  >
                    {t("service.raiseLimit")}
                  </Button>
                </li>
              ))}
              {floor.posToClose.map((p) => (
                <li
                  key={p.tabId}
                  className="flex items-center justify-between gap-2 rounded-[12px] border-l-4 border-l-blue bg-bg p-2.5"
                >
                  <b>
                    {t("service.pos", { label: p.tableLabel, total: formatCents(p.posTotalCents, locale) })}
                  </b>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      const confirmText = t("service.posCloseConfirm", {
                        label: p.tableLabel,
                        total: formatCents(p.posTotalCents, locale),
                      });
                      if (!window.confirm(confirmText)) return;
                      run(() => closeOnPos(slug, p.tabId));
                    }}
                  >
                    {t("service.posClosed")}
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title={t("service.openOrders")}>
            {!canManage && <p className="mb-2 text-xs text-muted">{t("service.managerOnly")}</p>}
            {todays.length === 0 && <p className="text-muted">{t("service.noOrders")}</p>}
            <ul className="grid gap-2">
              {todays.slice(0, allOrders ? 50 : 8).map((o) => (
                <li key={o.id} className="rounded-[10px] border border-line p-2.5 text-sm">
                  <div className="flex justify-between font-bold">
                    <span>
                      {t("orderNumber", { number: o.number })} · {t("table", { label: o.tableLabel })}
                    </span>
                    <span className="text-muted">{t(`source.${o.source}`)}</span>
                  </div>
                  <OrderFlags order={o} className="my-1" />
                  {o.openedTab && <p className="mb-1 text-xs text-muted">{t("service.newTableHint")}</p>}
                  <ul>
                    {o.lines.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 py-0.5">
                        <span className={cn(l.voided && "text-muted line-through")}>
                          {l.qty}× {l.nameEs}
                          {l.voided && ` · ${t("service.voided")}`}
                        </span>
                        {canManage && !l.voided && (
                          <button
                            type="button"
                            className="min-h-9 rounded-[8px] border border-line px-2 text-xs font-bold text-bad"
                            onClick={() =>
                              setAsk({ kind: "void", orderId: o.id, lineId: l.id, name: l.nameEs })
                            }
                          >
                            {t("service.voidLine", { name: l.nameEs })}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {todays.length > 8 && (
              <button
                type="button"
                onClick={() => setAllOrders((v) => !v)}
                aria-expanded={allOrders}
                className="mt-2 min-h-11 w-full rounded-btn bg-soft text-sm font-bold text-ink"
              >
                {allOrders ? t("service.showLess") : t("service.showAll", { n: todays.length })}
              </button>
            )}
          </Panel>

          <Panel title={t("service.payments")}>
            {floor.payments.length === 0 && <p className="text-muted">{t("service.noPayments")}</p>}
            <ul className="grid gap-1 text-sm">
              {floor.payments.slice(0, allPays ? 50 : 8).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 border-b border-line-2 py-1.5"
                >
                  <span>
                    {t("table", { label: p.tableLabel })} · {t(`methods.${p.method}`)} ·{" "}
                    {t(`paymentStatus.${p.status}` as never)}
                  </span>
                  <span className="flex items-center gap-2">
                    <b className="tabular">{formatCents(p.totalCents, locale)}</b>
                    {canManage && (p.status === "paid" || p.status === "partially_refunded") && (
                      <button
                        type="button"
                        className="min-h-9 rounded-[8px] border border-line px-2 text-xs font-bold"
                        onClick={() =>
                          setAsk({ kind: "refund", paymentId: p.id, max: formatCents(p.totalCents, locale) })
                        }
                      >
                        {t("service.refund")}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {floor.payments.length > 8 && (
              <button
                type="button"
                onClick={() => setAllPays((v) => !v)}
                aria-expanded={allPays}
                className="mt-2 min-h-11 w-full rounded-btn bg-soft text-sm font-bold text-ink"
              >
                {allPays ? t("service.showLess") : t("service.showAll", { n: floor.payments.length })}
              </button>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
