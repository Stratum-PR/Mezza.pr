"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { groupCheck } from "@/lib/guest/group-check";
import { participantLabel } from "@/lib/guest/names";
import { formatCents } from "@/lib/money";
import { cancelPendingPayment, confirmCash, refundPayment, voidLine } from "@/lib/staff/actions";
import type { TableDetail as Detail } from "@/lib/staff/table-detail";
import {
  closeTab,
  moveLine,
  reshareLine,
  staffCancelPlan,
  staffCharge,
  staffStartPlan,
  writeOff,
  type TableResult,
} from "@/lib/staff/table-actions";
import { CashDialog } from "./cash-dialog";
import { ReasonDialog } from "./reason-dialog";

type Tab = NonNullable<Detail["tab"]>;
type Ask =
  | { kind: "void"; orderId: string; lineId: string; name: string }
  | { kind: "writeoff"; scope: "person" | "table" | "balance"; participantId?: string; amount: number }
  | { kind: "refund"; paymentId: string; max: string };

/**
 * One table for staff: who ordered what and what each person still owes, the table's payments, and
 * the tools for split bills (charge a person, the balance or equal shares; move or re-share unpaid
 * lines; void with refunds to whoever paid; write off what nobody will pay; free the table).
 */
export function TableDetail({
  slug,
  table,
  tab,
  canManage,
  locale,
  restaurantName,
}: {
  slug: string;
  table: Detail["table"];
  tab: Tab;
  canManage: boolean;
  locale: "es" | "en";
  restaurantName: string;
}) {
  const t = useTranslations("staff.tableDetail");
  const te = useTranslations("staff.tableErrors");
  const ts = useTranslations("staff");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [resharing, setResharing] = useState<{ lineId: string; name: string; ids: string[] } | null>(null);
  const [charging, setCharging] = useState(false);
  const [cashFor, setCashFor] = useState<{ paymentId: string; dueCents: number } | null>(null);
  const money = (c: number) => formatCents(c, locale);
  const label = (id: string | null) => {
    const p = tab.people.find((x) => x.id === id);
    return p ? participantLabel(p, (number) => ts("take.guest", { number })) : t("byStaff");
  };
  const name = (l: { nameEs: string; nameEn: string }) => (locale === "es" ? l.nameEs : l.nameEn);

  const run = (
    action: () => Promise<TableResult | { ok: true } | { ok: false; error: string }>,
    ok?: (r: TableResult) => string,
  ) =>
    start(async () => {
      const r = (await action()) as TableResult;
      setMessage(
        r.ok ? { ok: true, text: ok ? ok(r) : ts("service.done") } : { ok: false, text: te(r.error) },
      );
      router.refresh();
    });

  const lines = new Map(tab.orders.flatMap((o) => o.lines).map((l) => [l.id, l]));
  const locked = new Set(tab.lockedLines);
  const groups = groupCheck(tab.people, tab.orders);
  const consumed = tab.orders
    .filter((o) => o.status !== "void")
    .flatMap((o) => o.lines)
    .reduce((n, l) => n + l.lineCents, 0);
  const collected = tab.payments
    .filter((p) => p.status !== "pending")
    .reduce((n, p) => n + p.totalCents - p.refundedCents, 0);
  const inProgress = tab.payments.filter((p) => p.status === "pending").reduce((n, p) => n + p.totalCents, 0);
  const pendingFor = (id: string) =>
    tab.payments.some((p) => p.status === "pending" && p.participantId === id);
  const settled = tab.balanceCents === 0 && inProgress === 0;

  const shown = new Set<string>(); // a shared line appears once per share; its tools appear once
  function lineTools(lineId: string) {
    if (shown.has(lineId)) return null;
    shown.add(lineId);
    const l = lines.get(lineId)!;
    const free = !locked.has(lineId);
    return (
      <span className="flex flex-wrap justify-end gap-1">
        {!free && (
          <span className="self-center whitespace-nowrap rounded-full bg-soft px-2 py-0.5 text-xs font-bold text-accent">
            {t("locked")}
          </span>
        )}
        {free && moving !== lineId && (
          <button
            type="button"
            onClick={() => setMoving(lineId)}
            className="min-h-9 rounded-[8px] border border-line px-2 text-xs font-bold"
          >
            {t("moveChoose")}
          </button>
        )}
        {free && moving === lineId && (
          <select
            autoFocus
            aria-label={t("moveLabel", { name: name(l) })}
            defaultValue=""
            onBlur={() => setMoving(null)}
            onChange={(e) => {
              setMoving(null);
              const to = e.target.value === "table" ? null : e.target.value;
              run(() => moveLine(slug, lineId, to));
            }}
            className="min-h-9 rounded-[8px] border border-line bg-bg px-2 text-xs font-bold"
          >
            <option value="" disabled>
              {t("moveChoose")}
            </option>
            {tab.people
              .filter((p) => l.shared || p.id !== l.participantId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {label(p.id)}
                </option>
              ))}
            {(l.shared || l.participantId) && <option value="table">{t("toTable")}</option>}
          </select>
        )}
        {free && l.shared && tab.people.length > 0 && (
          <button
            type="button"
            onClick={() => setResharing({ lineId, name: name(l), ids: l.shares.map((s) => s.participantId) })}
            className="min-h-9 rounded-[8px] border border-line px-2 text-xs font-bold"
          >
            {t("reshare")}
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => setAsk({ kind: "void", orderId: l.orderId, lineId, name: name(l) })}
            className="min-h-9 rounded-[8px] border border-line px-2 text-xs font-bold text-bad"
          >
            {t("voidLine")}
          </button>
        )}
      </span>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
          {t("title", { label: table.label })}
        </h1>
        <Link
          href={`/app/${slug}/mesas`}
          className="font-bold text-accent underline-offset-2 hover:underline"
        >
          {t("back")}
        </Link>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={cn("min-h-5 text-sm font-semibold", message?.ok === false ? "text-bad" : "text-ok")}
      >
        {message?.text}
      </p>

      <section aria-label={t("left")} className="grid gap-3 rounded-card border border-line bg-surface p-4">
        <dl className="tabular grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["subtotal", consumed],
              ["collected", collected],
              ["inProgress", inProgress],
              ["left", tab.balanceCents],
            ] as const
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs font-bold text-muted">{t(k)}</dt>
              <dd className={cn("text-xl font-extrabold", k === "left" && v > 0 && "text-warn")}>
                {k === "left" && v > 0 ? t("plusIvu", { amount: money(v) }) : money(v)}
              </dd>
            </div>
          ))}
        </dl>
        {tab.plan && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-btn bg-soft px-3 py-2 text-sm">
            <span>
              {t("planActive", {
                parts: tab.plan.parts,
                left: tab.plan.partsLeft,
                share: money(tab.plan.nextShareCents),
              })}
            </span>
            {tab.plan.partsLeft === tab.plan.parts && (
              <Button
                size="sm"
                variant="soft"
                disabled={pending}
                onClick={() => run(() => staffCancelPlan(slug, tab.id))}
              >
                {t("planCancel")}
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {tab.balanceCents > 0 && (
            <Button disabled={pending} onClick={() => setCharging(true)}>
              {t("charge")}
            </Button>
          )}
          <Button
            variant="soft"
            disabled={pending || !settled}
            onClick={() =>
              run(
                () => closeTab(slug, tab.id),
                () => t("freed"),
              )
            }
          >
            {t("freeTable")}
          </Button>
          {canManage && tab.balanceCents > 0 && (
            <Button
              variant="soft"
              disabled={pending}
              onClick={() => setAsk({ kind: "writeoff", scope: "balance", amount: tab.balanceCents })}
            >
              {t("writeOffBalance")}
            </Button>
          )}
        </div>
        {!settled && <p className="text-xs text-muted">{t("freeHint")}</p>}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Panel title={t("people")}>
          {tab.people.length === 0 && <p className="mb-2 text-sm text-muted">{t("noPeople")}</p>}
          <ul className="grid gap-2">
            {groups.map((g) => {
              const owed = g.person ? (tab.owed[g.person.id] ?? 0) : tab.tableCents;
              return (
                <li key={g.person?.id ?? "table"} className="rounded-card border border-line p-3">
                  <div className="tabular mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <b>{g.person ? label(g.person.id) : t("tableLines")}</b>
                    <span className="font-bold">{money(g.subtotalCents)}</span>
                  </div>
                  {(g.entries.length > 0 || owed > 0) && (
                    <p className="mb-2 text-xs font-bold">
                      {owed > 0 ? (
                        <span className="text-warn">{t("owes", { total: money(owed) })}</span>
                      ) : g.person && pendingFor(g.person.id) ? (
                        <span className="text-olive">{t("processing")}</span>
                      ) : (
                        <span className="text-ok">✓ {t("paid")}</span>
                      )}
                    </p>
                  )}
                  <ul className="grid gap-1.5 text-sm">
                    {g.entries.map((e, i) => (
                      <li
                        key={`${e.lineId}-${i}`}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span className="tabular min-w-0">
                          {e.qty}× {name(e)} · {money(e.cents)}
                          {e.sharedOfCents !== null && (
                            <span className="text-muted">
                              {" "}
                              · {t("sharedOf", { total: money(e.sharedOfCents) })}
                            </span>
                          )}
                        </span>
                        {lineTools(e.lineId)}
                      </li>
                    ))}
                  </ul>
                  {canManage && owed > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAsk(
                          g.person
                            ? { kind: "writeoff", scope: "person", participantId: g.person.id, amount: owed }
                            : { kind: "writeoff", scope: "table", amount: owed },
                        )
                      }
                      className="mt-2 min-h-9 rounded-[8px] border border-line px-2 text-xs font-bold"
                    >
                      {g.person ? t("writeOffPerson", { name: label(g.person.id) }) : t("writeOffTable")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="grid gap-4">
          <Panel title={t("payments")}>
            {tab.payments.length === 0 && <p className="text-sm text-muted">{t("noPayments")}</p>}
            <ul className="grid gap-2 text-sm">
              {tab.payments.map((p) => (
                <li key={p.id} className="grid gap-1.5 rounded-[10px] border border-line p-2.5">
                  <div className="tabular flex flex-wrap items-baseline justify-between gap-2">
                    <b>
                      {label(p.participantId)}
                      {p.forParticipantId && p.forParticipantId !== p.participantId && (
                        <span className="font-normal text-muted">
                          {" "}
                          · {t("forWhom", { name: label(p.forParticipantId) })}
                        </span>
                      )}
                    </b>
                    <b>{money(p.totalCents)}</b>
                  </div>
                  <p className="text-xs text-muted">
                    {ts(`methods.${p.method}`)} · {ts(`paymentStatus.${p.status}` as never)}
                    {p.planParts && ` · ${t("planShare", { parts: p.planParts })}`}
                    {p.refundedCents > 0 && ` · ${t("refundedAmount", { amount: money(p.refundedCents) })}`}
                  </p>
                  <span className="flex flex-wrap gap-1.5">
                    {p.status === "pending" && p.method === "cash" && (
                      <Button
                        size="sm"
                        variant="ok"
                        disabled={pending}
                        onClick={() => setCashFor({ paymentId: p.id, dueCents: p.totalCents })}
                      >
                        {t("collect")}
                      </Button>
                    )}
                    {p.status === "pending" && (
                      <Button
                        size="sm"
                        variant="soft"
                        disabled={pending}
                        onClick={() => run(() => cancelPendingPayment(slug, p.id))}
                      >
                        {t("cancel")}
                      </Button>
                    )}
                    {canManage && (p.status === "paid" || p.status === "partially_refunded") && (
                      <Button
                        size="sm"
                        variant="soft"
                        disabled={pending}
                        onClick={() =>
                          setAsk({
                            kind: "refund",
                            paymentId: p.id,
                            max: money(p.totalCents - p.refundedCents),
                          })
                        }
                      >
                        {t("refund")}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          {tab.writeOffs.length > 0 && (
            <Panel title={t("writeOffs")}>
              <ul className="grid gap-1 text-sm">
                {tab.writeOffs.map((w) => (
                  <li key={w.id}>
                    {t("writeOffLine", {
                      who: w.participantId
                        ? label(w.participantId)
                        : w.scope === "table"
                          ? t("tableLines")
                          : t("chargeBalance"),
                      amount: money(w.cents),
                      reason: w.reason,
                    })}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      {resharing && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-[rgba(10,14,40,.5)] p-4"
          onClick={() => setResharing(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reshare-title"
            className="grid w-full max-w-sm gap-3 rounded-card bg-surface p-5 shadow-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="reshare-title" className="text-lg font-extrabold">
              {t("reshareTitle", { name: resharing.name })}
            </h2>
            {tab.people.map((p) => (
              <label
                key={p.id}
                className="flex min-h-11 items-center gap-2.5 rounded-[10px] border border-line px-3"
              >
                <input
                  type="checkbox"
                  checked={resharing.ids.includes(p.id)}
                  onChange={(e) =>
                    setResharing(
                      (r) =>
                        r && {
                          ...r,
                          ids: e.target.checked ? [...r.ids, p.id] : r.ids.filter((x) => x !== p.id),
                        },
                    )
                  }
                  className="size-4 accent-[var(--blue)]"
                />
                {label(p.id)}
              </label>
            ))}
            <div className="flex gap-2">
              <Button
                disabled={pending || resharing.ids.length === 0}
                onClick={() => {
                  const r = resharing;
                  setResharing(null);
                  run(() => reshareLine(slug, r.lineId, r.ids));
                }}
              >
                {t("reshareSave")}
              </Button>
              <Button variant="soft" onClick={() => setResharing(null)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {charging && (
        <ChargeDialog
          slug={slug}
          tab={tab}
          locale={locale}
          label={label}
          onClose={() => setCharging(false)}
          onCreated={(paymentId, dueCents) => {
            setCharging(false);
            setCashFor({ paymentId, dueCents });
            router.refresh();
          }}
          onPlanChange={() => router.refresh()}
        />
      )}

      {cashFor && (
        <CashDialog
          tableLabel={table.label}
          dueCents={cashFor.dueCents}
          orders={[]}
          restaurantName={restaurantName}
          locale={locale}
          onClose={() => {
            setCashFor(null);
            router.refresh();
          }}
          onConfirm={async () => {
            const r = await confirmCash(slug, cashFor.paymentId);
            if (!r.ok) setMessage({ ok: false, text: ts(`errors.${r.error}`) });
            return r.ok;
          }}
        />
      )}

      {ask && (
        <ReasonDialog
          title={
            ask.kind === "void"
              ? ts("service.voidPrompt", { name: ask.name })
              : ask.kind === "writeoff"
                ? t("writeOffTitle", { amount: money(ask.amount) })
                : ts("service.refund")
          }
          amountLabel={ask.kind === "refund" ? ts("service.refundAmount", { max: ask.max }) : undefined}
          confirmLabel={
            ask.kind === "void"
              ? ts("reason.void")
              : ask.kind === "writeoff"
                ? t("writeOffConfirm")
                : ts("reason.refund")
          }
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
                        text: refunded ? t("voidedRefund", { amount: money(refunded) }) : t("voided"),
                      }
                    : {
                        ok: false,
                        text: te(
                          r.error === "pending"
                            ? "pending"
                            : r.error === "forbidden"
                              ? "forbidden"
                              : "failed",
                        ),
                      },
                );
                router.refresh();
              });
            else if (a.kind === "writeoff")
              run(
                () => writeOff(slug, tab.id, a.scope, reason, a.participantId),
                (r) => t("writeOffDone", { amount: money(r.ok ? (r.cents ?? 0) : 0) }),
              );
            else
              run(
                () => refundPayment(slug, a.paymentId, amount ?? "", reason),
                () => ts("service.refunded"),
              );
          }}
        />
      )}
    </div>
  );
}

/** "Dividir cuenta": what to charge (a person's, everything, equal shares) before collecting cash. */
function ChargeDialog({
  slug,
  tab,
  locale,
  label,
  onClose,
  onCreated,
  onPlanChange,
}: {
  slug: string;
  tab: Tab;
  locale: "es" | "en";
  label: (id: string | null) => string;
  onClose: () => void;
  onCreated: (paymentId: string, dueCents: number) => void;
  onPlanChange: () => void;
}) {
  const t = useTranslations("staff.tableDetail");
  const te = useTranslations("staff.tableErrors");
  const owing = tab.people.filter((p) => (tab.owed[p.id] ?? 0) > 0);
  const [option, setOption] = useState<"person" | "balance" | "plan">(
    tab.plan ? "plan" : owing.length ? "person" : "balance",
  );
  const [forId, setForId] = useState<string | null>(owing[0]?.id ?? null);
  const [parts, setParts] = useState(1);
  const [count, setCount] = useState(Math.max(2, Math.min(20, tab.people.length || 2)));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const money = (c: number) => formatCents(c, locale);
  const plan = tab.plan;
  const planCents = (k: number) =>
    plan
      ? Math.floor(plan.amountLeftCents / plan.partsLeft) * k +
        Math.min(k, plan.amountLeftCents % plan.partsLeft)
      : 0;
  const amount =
    option === "person"
      ? forId
        ? (tab.owed[forId] ?? 0)
        : 0
      : option === "plan"
        ? planCents(Math.min(parts, plan?.partsLeft ?? 0))
        : tab.balanceCents;

  async function go() {
    setBusy(true);
    setError(null);
    const r = await staffCharge(slug, tab.id, {
      option,
      forId: option === "person" ? (forId ?? undefined) : undefined,
      parts: option === "plan" ? parts : undefined,
      key: key.current,
    });
    setBusy(false);
    if (r.ok && r.paymentId) onCreated(r.paymentId, r.totalCents ?? 0);
    else setError(te(r.ok ? "failed" : r.error));
  }

  async function startPlan() {
    setBusy(true);
    const r = await staffStartPlan(slug, tab.id, count);
    setBusy(false);
    if (!r.ok) setError(te(r.error));
    onPlanChange();
  }

  const opt = (key: "person" | "balance" | "plan", title: string) => (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 font-bold",
        option === key ? "border-blue bg-soft" : "border-line",
      )}
    >
      <input
        type="radio"
        name="charge-option"
        checked={option === key}
        onChange={() => setOption(key)}
        className="size-4 accent-[var(--blue)]"
      />
      {title}
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[rgba(10,14,40,.5)] p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="charge-title"
        className="grid max-h-[90dvh] w-full max-w-sm gap-3 overflow-y-auto rounded-card bg-surface p-5 shadow-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="charge-title" className="text-xl font-extrabold">
          {t("chargeTitle")}
        </h2>
        {owing.length > 0 && opt("person", t("chargePerson"))}
        {option === "person" && (
          <div className="grid gap-1.5 pl-6">
            {owing.map((p) => (
              <label key={p.id} className="tabular flex min-h-10 items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="charge-for"
                    checked={forId === p.id}
                    onChange={() => setForId(p.id)}
                    className="size-4 accent-[var(--blue)]"
                  />
                  {label(p.id)}
                </span>
                <b>{money(tab.owed[p.id] ?? 0)}</b>
              </label>
            ))}
          </div>
        )}
        {opt("balance", t("chargeBalance"))}
        {opt("plan", t("chargePlan"))}
        {option === "plan" && (
          <div className="grid gap-2 pl-6 text-sm">
            {plan ? (
              <>
                <p>
                  {t("planActive", {
                    parts: plan.parts,
                    left: plan.partsLeft,
                    share: money(plan.nextShareCents),
                  })}
                </p>
                <Count
                  label={t("planParts")}
                  value={Math.min(parts, plan.partsLeft)}
                  min={1}
                  max={plan.partsLeft}
                  onChange={setParts}
                />
              </>
            ) : (
              <>
                <Count label={t("planCount")} value={count} min={2} max={20} onChange={setCount} />
                <Button variant="soft" disabled={busy} onClick={() => void startPlan()}>
                  {t("planStart", { n: count })}
                </Button>
              </>
            )}
          </div>
        )}
        <p className="tabular text-center text-lg font-extrabold">
          {t("plusIvu", { amount: money(amount) })}
        </p>
        {error && (
          <p role="alert" className="text-sm font-semibold text-bad">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button disabled={busy || amount === 0 || (option === "plan" && !plan)} onClick={() => void go()}>
            {t("continue")}
          </Button>
          <Button variant="soft" onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Count({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-bold">{label}</span>
      <span role="group" aria-label={label} className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} −`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid size-10 place-items-center rounded-full border border-line text-lg font-bold disabled:opacity-40"
        >
          −
        </button>
        <output className="tabular min-w-6 text-center text-lg font-bold">{value}</output>
        <button
          type="button"
          aria-label={`${label} +`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="grid size-10 place-items-center rounded-full border border-line text-lg font-bold disabled:opacity-40"
        >
          +
        </button>
      </span>
    </div>
  );
}
