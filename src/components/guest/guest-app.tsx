"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  guestPay,
  guestPaymentMethods,
  guestPlaceOrder,
  guestReceipt,
  guestRename,
  guestRequest,
  guestStatus,
  type Receipt,
} from "@/app/r/[restaurant]/t/[token]/actions";
import { flags } from "@/config/flags";
import { GuestMenu, type LiveMode } from "@/components/menu/guest-menu";
import { ThemeCycle, type ThemeChoice } from "@/components/ui/theme-switch";
import type { CartLine } from "@/components/menu/item-sheet";
import type { MenuT } from "@/components/menu/menu-styles";
import type { MenuData, MenuLocale } from "@/components/menu/types";
import { newClientOrderId, orderQueue } from "@/connectors/orders";
import { realtimeChannel } from "@/connectors/realtime";
import { groupCheck } from "@/lib/guest/group-check";
import { participantLabel } from "@/lib/guest/names";
import type { GuestStatus } from "@/lib/guest/status";
import { cn } from "@/lib/cn";
import { computeIvu, dollarsToCents, formatCents, tipFromPercent } from "@/lib/money";

type Screen = "menu" | "status" | "pay" | "receipt";
type Method = "card" | "ath" | "cash";
type Tip = { percent: number } | { cents: number };

const btn = "min-h-12 w-full rounded-btn font-bold";
const primary = `${btn} bg-accent text-accent-ink shadow-btn disabled:opacity-50`;
const soft = `${btn} bg-soft text-ink`;

function store(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A paid receipt stays reachable from "Mi pedido" for the rest of the visit, then it's put away. */
const RECEIPT_KEEP_MS = 3 * 3600_000;

/** The real guest page: live menu, order status, service requests, the one check and the receipt. */
export function GuestApp({
  slug,
  token,
  restaurantId,
  tableId,
  tableLabel,
  menu,
  messages,
  initialLang,
  rates,
  realtimeImpl,
  queueImpl,
  theme = "auto",
}: {
  slug: string;
  token: string;
  restaurantId: string;
  tableId: string;
  tableLabel: string;
  menu: MenuData;
  messages: Record<MenuLocale, Record<string, unknown>>;
  initialLang: MenuLocale;
  rates: { stateBps: number; municipalBps: number };
  realtimeImpl: "polling" | "supabase_stub";
  queueImpl: "online" | "offline_stub";
  theme?: ThemeChoice;
}) {
  const [status, setStatus] = useState<GuestStatus | null>(null);
  const [screen, setScreen] = useState<Screen>("menu");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [methods, setMethods] = useState<Method[]>(["cash"]);
  const [method, setMethod] = useState<Method>("cash");
  const [tip, setTip] = useState<Tip>({ percent: 18 });
  const [customTip, setCustomTip] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState(false);
  const payKey = useRef<string | null>(null);
  // The name goes with the phone's first order; the server ignores it once the phone is at the table.
  const [name, setName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renameMessage, setRenameMessage] = useState<{ ok: boolean; key: string } | null>(null);
  const keys = useMemo(
    () => ({
      cart: `mezza-cart:${tableId}`,
      pending: `mezza-pending:${tableId}`,
      payment: `mezza-payment:${tableId}`,
    }),
    [tableId],
  );

  const showReceipt = useCallback(
    async (paymentId: string) => {
      const r = await guestReceipt(slug, token, paymentId);
      if (r) {
        setReceipt(r);
        setScreen("receipt");
      }
    },
    [slug, token],
  );

  const refresh = useCallback(async () => {
    const s = await guestStatus(slug, token);
    if (!s) return;
    setStatus(s);
    // A cash payment the server just confirmed: show the receipt.
    if (s.payment?.status === "paid" && read(keys.payment) === s.payment.id) {
      setScreen((current) => {
        if (current !== "receipt") void showReceipt(s.payment!.id);
        return current;
      });
    }
  }, [slug, token, keys.payment, showReceipt]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load from the server
    void refresh();
    void guestPaymentMethods(slug, token).then((m) => {
      setMethods(m);
      setMethod(m[0] ?? "cash");
    });
    const last = read(keys.payment);
    if (last) {
      void guestReceipt(slug, token, last).then((r) => {
        const old = r?.paidAt && Date.now() - Date.parse(r.paidAt) > RECEIPT_KEEP_MS;
        if (!r || old) store(keys.payment, null);
        else setReceipt(r);
      });
    }
  }, [refresh, slug, token, keys.payment]);

  // Someone opened a new tab at this table (a new visit): put the last visit's receipt away.
  useEffect(() => {
    if (!receipt || !status?.tab || status.tab.id === receipt.tabId) return;
    store(keys.payment, null);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the server's tab
    setReceipt(null);
    setScreen((s) => (s === "receipt" ? "menu" : s));
  }, [status, receipt, keys.payment]);

  useEffect(() => {
    if (realtimeImpl !== "polling") return;
    return realtimeChannel("polling", `/api/r/${slug}/t/${token}/events`).subscribe(
      { restaurantId },
      [
        "order.created",
        "order.updated",
        "service_request.created",
        "service_request.updated",
        "payment.updated",
      ],
      () => void refresh(),
    );
  }, [realtimeImpl, slug, token, restaurantId, refresh]);

  const queue = useMemo(
    () => orderQueue(queueImpl, (draft) => guestPlaceOrder(slug, token, draft, name)),
    [queueImpl, slug, token, name],
  );

  async function send(cart: CartLine[], lang: MenuLocale, t: MenuT) {
    // The id is made before the first attempt and kept until the order is accepted, so retries and
    // double taps can never create two orders.
    const clientOrderId = read(keys.pending) ?? newClientOrderId();
    store(keys.pending, clientOrderId);
    try {
      const result = await queue.submit({
        clientOrderId,
        tableId,
        source: "qr",
        guestLanguage: lang,
        lines: cart.map((l) => ({
          itemId: l.itemId,
          qty: l.qty,
          modifierOptionIds: l.optionIds,
          note: l.note,
          shared: l.shared,
        })),
      });
      if (result.status === "accepted") {
        store(keys.pending, null);
        void refresh();
        return { ok: true as const, message: t("flow.sent", { number: result.number }) };
      }
      if (result.status === "rejected") store(keys.pending, null);
      if (result.status === "rejected" && result.detail === "table_full")
        return { ok: false as const, message: t("flow.errors.table_full") };
      if (result.status === "rejected" && result.detail?.startsWith("limit_")) {
        const max =
          result.detail === "limit_line" ? String(result.limit ?? "") : formatCents(result.limit ?? 0, lang);
        return { ok: false as const, message: t(`flow.errors.${result.detail}`, { max }) };
      }
      if (result.status === "rejected" && result.detail === "rate_limited")
        return { ok: false as const, message: t("flow.errors.rate_limited") };
      if (result.status === "rejected" && result.detail?.startsWith("name_"))
        return { ok: false as const, message: t(`people.nameErrors.${result.detail.slice(5)}`) };
      const reason = result.status === "rejected" ? result.reason : "network";
      return { ok: false as const, message: t(`flow.errors.${reason}`) };
    } catch {
      return { ok: false as const, message: t("flow.errors.network") };
    }
  }

  async function request(kind: "call_server" | "bring_check", say: (m: string) => void, t: MenuT) {
    const r = await guestRequest(slug, token, kind).catch(() => ({ ok: false }));
    setRequestError(!r.ok);
    if (r.ok) {
      say(t(kind === "call_server" ? "flow.called" : "flow.checkRequested"));
      void refresh();
    }
  }

  const subtotal = status?.totals.subtotalCents ?? 0;
  const ivu = computeIvu(subtotal, rates);
  const tipCents = "percent" in tip ? tipFromPercent(subtotal, tip.percent) : tip.cents;
  const total = subtotal + ivu.total + tipCents;
  const orderedCount = status?.orders.filter((o) => o.status !== "void").length ?? 0;
  const cashPending = status?.payment?.method === "cash" && status.payment.status === "pending";

  async function pay(t: MenuT, lang: MenuLocale) {
    setPaying(true);
    setPayError(null);
    payKey.current ??= newClientOrderId();
    const r = await guestPay(slug, token, {
      method,
      tip,
      idempotencyKey: payKey.current,
      locale: lang,
    }).catch(() => null);
    setPaying(false);
    if (!r || !r.ok) {
      setPayError(t(`flow.payErrors.${r && !r.ok ? r.error : "failed"}`));
      payKey.current = null;
      return;
    }
    store(keys.payment, r.paymentId);
    payKey.current = null;
    if (r.next === "done") await showReceipt(r.paymentId);
    else {
      setScreen("status");
      void refresh();
    }
  }

  async function rename() {
    const r = await guestRename(slug, token, renameValue).catch(() => ({
      ok: false as const,
      error: "failed" as const,
    }));
    setRenameMessage(
      r.ok ? { ok: true, key: "people.renamed" } : { ok: false, key: `people.nameErrors.${r.error}` },
    );
    if (r.ok) {
      setRenameValue("");
      void refresh();
    }
  }

  const live: LiveMode = {
    storageKey: keys.cart,
    sharing: flags.sharedTab,
    send,
    render: ({ lang, t, say }) => {
      const lineName = (l: { nameEs: string; nameEn: string }) => (lang === "es" ? l.nameEs : l.nameEn);
      const label = (p: { name: string | null; number: number }) =>
        participantLabel(p, (number) => t("people.guest", { number }));
      const people = status?.people ?? [];
      const groups = flags.sharedTab && people.length > 0 ? groupCheck(people, status?.orders ?? []) : [];
      const requests = (
        <div className="mb-3 grid grid-cols-2 gap-2">
          {(["call_server", "bring_check"] as const).map((kind) => {
            const open = status?.openRequests.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                disabled={open}
                onClick={() => request(kind, say, t)}
                className="min-h-11 rounded-[10px] border border-line bg-soft px-2 text-sm font-bold disabled:opacity-70"
              >
                {kind === "call_server" ? t("flow.callServer") : t("flow.bringCheck")}
                {open && (
                  <span className="block text-xs font-semibold text-ok">✓ {t("flow.requestOpen")}</span>
                )}
              </button>
            );
          })}
          {requestError && (
            <p role="alert" className="col-span-2 text-sm font-semibold text-bad">
              {t("flow.errors.request")}
            </p>
          )}
        </div>
      );

      let content: React.ReactNode = undefined;
      if (screen === "status") {
        content = (
          <section aria-labelledby="status-title" className="grid gap-3">
            <h2 id="status-title" className="text-xl font-extrabold">
              {t("flow.statusTitle")}
            </h2>
            {cashPending && (
              <p
                role="status"
                className="rounded-btn bg-sandsoft px-3 py-2.5 text-sm font-semibold text-olive"
              >
                {t("flow.cashPending", { total: formatCents(status!.payment!.totalCents, lang) })}
              </p>
            )}
            {orderedCount === 0 && <p className="text-muted">{t("flow.empty")}</p>}
            <ul className="grid gap-2">
              {status?.orders.map((o) => (
                <li key={o.id} className="rounded-card border border-line p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <b>{t("flow.orderNumber", { number: o.number })}</b>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        o.status === "ready"
                          ? "bg-ok-bg text-ok"
                          : o.status === "void"
                            ? "bg-line-2 text-muted"
                            : "bg-soft text-accent",
                      )}
                    >
                      {t(`flow.status.${o.status}`)}
                    </span>
                  </div>
                  <ul className="text-sm">
                    {o.lines.map((l, i) => (
                      <li key={i}>
                        {l.qty}× {lineName(l)}
                        {(lang === "es" ? l.optionsEs : l.optionsEn).length > 0 && (
                          <span className="text-muted">
                            {" "}
                            · {(lang === "es" ? l.optionsEs : l.optionsEn).join(", ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {groups.length > 0 && (
              <section aria-labelledby="group-title" className="grid gap-2">
                <h3 id="group-title" className="text-lg font-extrabold">
                  {t("people.groupTitle")}
                </h3>
                <p className="text-sm text-muted">{t("people.groupHint")}</p>
                <ul className="grid gap-2">
                  {groups.map((g) => {
                    const mine = !!g.person && g.person.id === status?.me;
                    return (
                      <li
                        key={g.person?.id ?? "table"}
                        className={cn(
                          "rounded-card border p-3",
                          mine ? "border-blue bg-soft" : "border-line",
                        )}
                      >
                        <div className="tabular mb-1 flex items-baseline justify-between gap-2">
                          <b>
                            {g.person ? label(g.person) : t("people.table")}
                            {mine && <span className="text-muted"> ({t("people.you")})</span>}
                          </b>
                          <span className="font-bold">{formatCents(g.subtotalCents, lang)}</span>
                        </div>
                        <ul className="tabular text-sm">
                          {g.entries.map((e) => (
                            <li key={e.lineId} className="flex justify-between gap-2">
                              <span>
                                {e.qty}× {lineName(e)}
                                {e.sharedOfCents !== null && (
                                  <span className="text-muted">
                                    {" "}
                                    · {t("people.sharedOf", { total: formatCents(e.sharedOfCents, lang) })}
                                  </span>
                                )}
                              </span>
                              <span>{formatCents(e.cents, lang)}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
                {status?.me && (
                  <form
                    className="grid gap-1.5"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void rename();
                    }}
                  >
                    <label htmlFor="rename" className="text-sm font-bold">
                      {t("people.rename")}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="rename"
                        value={renameValue}
                        maxLength={24}
                        autoComplete="given-name"
                        onChange={(e) => setRenameValue(e.target.value)}
                        className="min-h-11 min-w-0 flex-1 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base"
                      />
                      <button type="submit" className="min-h-11 rounded-btn bg-soft px-4 font-bold">
                        {t("people.renameSave")}
                      </button>
                    </div>
                    {renameMessage && (
                      <p
                        role={renameMessage.ok ? "status" : "alert"}
                        className={cn("text-sm font-semibold", renameMessage.ok ? "text-ok" : "text-bad")}
                      >
                        {t(renameMessage.key)}
                      </p>
                    )}
                  </form>
                )}
              </section>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={soft} onClick={() => setScreen("menu")}>
                {t("flow.orderMore")}
              </button>
              <button
                type="button"
                className={primary}
                disabled={subtotal === 0 || cashPending}
                onClick={() => setScreen("pay")}
              >
                {t("flow.pay")}
              </button>
            </div>
          </section>
        );
      } else if (screen === "pay") {
        const tips: Tip[] = [{ percent: 0 }, { percent: 15 }, { percent: 18 }, { percent: 20 }];
        const online = methods.filter((m) => m !== "cash");
        content = (
          <section aria-labelledby="pay-title" className="grid gap-3">
            <h2 id="pay-title" className="text-xl font-extrabold">
              {t("flow.payTitle")}
            </h2>
            <div className="tabular grid gap-1 rounded-card border border-line p-3 text-[15px]">
              <div className="flex justify-between">
                <span>{t("flow.subtotal")}</span>
                <span>{formatCents(subtotal, lang)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("flow.ivuState")}</span>
                <span>{formatCents(ivu.state, lang)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("flow.ivuMunicipal")}</span>
                <span>{formatCents(ivu.municipal, lang)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("flow.tip")}</span>
                <span>{formatCents(tipCents, lang)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-2 text-lg font-extrabold">
                <span>{t("flow.total")}</span>
                <span>{formatCents(total, lang)}</span>
              </div>
            </div>
            <fieldset>
              <legend className="mb-1.5 text-sm font-bold">{t("flow.tip")}</legend>
              <div className="grid grid-cols-5 gap-1.5">
                {tips.map((x) => {
                  const on = "percent" in tip && "percent" in x && tip.percent === x.percent;
                  return (
                    <button
                      key={"percent" in x ? x.percent : "c"}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setTip(x)}
                      className={cn(
                        "min-h-11 rounded-[10px] border text-sm font-bold",
                        on ? "border-blue bg-soft" : "border-line",
                      )}
                    >
                      {"percent" in x && x.percent === 0
                        ? t("flow.tipNone")
                        : `${"percent" in x ? x.percent : 0}%`}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={"cents" in tip}
                  onClick={() => setTip({ cents: dollarsToCents(customTip) ?? 0 })}
                  className={cn(
                    "min-h-11 rounded-[10px] border text-sm font-bold",
                    "cents" in tip ? "border-blue bg-soft" : "border-line",
                  )}
                >
                  {t("flow.tipCustom")}
                </button>
              </div>
              {"cents" in tip && (
                <label className="mt-2 grid gap-1 text-sm font-bold">
                  {t("flow.tipCustomLabel")}
                  <input
                    inputMode="decimal"
                    value={customTip}
                    onChange={(e) => {
                      setCustomTip(e.target.value);
                      setTip({ cents: dollarsToCents(e.target.value) ?? 0 });
                    }}
                    className="min-h-11 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base font-normal"
                  />
                </label>
              )}
              <p className="mt-1.5 text-xs text-muted">{t("flow.tipHint")}</p>
            </fieldset>
            <fieldset>
              <legend className="mb-1.5 text-sm font-bold">{t("flow.methodTitle")}</legend>
              <div className="grid gap-1.5">
                {methods.map((m) => (
                  <label
                    key={m}
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-[10px] border px-3 font-bold",
                      method === m ? "border-blue bg-soft" : "border-line",
                    )}
                  >
                    <input
                      type="radio"
                      name="method"
                      checked={method === m}
                      onChange={() => setMethod(m)}
                      className="size-4 accent-[var(--blue)]"
                    />
                    {t(`flow.methods.${m}`)}
                  </label>
                ))}
              </div>
              {online.length === 0 && <p className="mt-2 text-sm text-muted">{t("flow.payWithServer")}</p>}
            </fieldset>
            {payError && (
              <p role="alert" className="text-sm font-semibold text-bad">
                {payError}
              </p>
            )}
            <button
              type="button"
              disabled={paying || subtotal === 0}
              onClick={() => pay(t, lang)}
              className={cn(primary, method === "ath" && "bg-ath text-white")}
            >
              {paying ? t("flow.paying") : t("flow.payButton", { total: formatCents(total, lang) })}
            </button>
            <button type="button" className={soft} onClick={() => setScreen("status")}>
              {t("flow.myOrder")}
            </button>
          </section>
        );
      } else if (screen === "receipt" && receipt) {
        content = (
          <section aria-labelledby="receipt-title" className="grid gap-3">
            <h2 id="receipt-title" className="text-xl font-extrabold">
              {t("flow.receiptTitle")}
            </h2>
            <div className="tabular rounded-[6px] border border-dashed border-muted bg-sandsoft p-3 text-sm">
              <p className="font-bold">
                {receipt.restaurantName} · {t("table", { label: receipt.tableLabel })}
              </p>
              {receipt.paidAt && (
                <p className="text-muted">
                  {new Date(receipt.paidAt).toLocaleString(lang === "es" ? "es-PR" : "en-US")}
                </p>
              )}
              <hr className="my-2 border-dashed border-muted" />
              {receipt.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>
                    {l.qty}× {lineName(l)}
                  </span>
                  <span>{formatCents(l.lineCents, lang)}</span>
                </div>
              ))}
              <hr className="my-2 border-dashed border-muted" />
              {(
                [
                  ["flow.subtotal", receipt.subtotalCents],
                  ["flow.ivuState", receipt.ivuStateCents],
                  ["flow.ivuMunicipal", receipt.ivuMunicipalCents],
                  ["flow.tip", receipt.tipCents],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span>{t(k)}</span>
                  <span>{formatCents(v, lang)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between text-base font-extrabold">
                <span>{t("flow.total")}</span>
                <span>{formatCents(receipt.totalCents, lang)}</span>
              </div>
              <p className="mt-1">{t("flow.paidWith", { method: t(`flow.methods.${receipt.method}`) })}</p>
              <hr className="my-2 border-dashed border-muted" />
              <p className="font-semibold">{t("flow.receiptNote")}</p>
            </div>
            <p className="text-center font-bold">{t("flow.thanks")}</p>
            <button type="button" className={soft} onClick={() => setScreen("menu")}>
              {t("flow.backToMenu")}
            </button>
          </section>
        );
      }

      const beforeSend =
        flags.sharedTab && !status?.me ? (
          <label className="mt-3 grid gap-1 text-sm font-bold">
            {t("people.nameLabel")}
            <input
              value={name}
              maxLength={24}
              autoComplete="given-name"
              onChange={(e) => setName(e.target.value)}
              className="min-h-11 rounded-btn border-[1.5px] border-line bg-bg px-3 text-base font-normal"
            />
            <small className="font-normal text-muted">
              {t("people.nameHint", { number: people.length + 1 })}
            </small>
          </label>
        ) : undefined;

      return {
        top: screen === "menu" ? requests : undefined,
        screen: content,
        beforeSend,
        footer:
          screen === "menu" && (orderedCount > 0 || receipt) ? (
            <button
              type="button"
              className={soft}
              onClick={() => (receipt && !status?.tab ? setScreen("receipt") : setScreen("status"))}
            >
              {t("flow.myOrder")}
              {orderedCount > 0 && ` (${orderedCount})`}
            </button>
          ) : undefined,
      };
    },
  };

  return (
    <GuestMenu
      menu={menu}
      messages={messages}
      initialLang={initialLang}
      tableLabel={tableLabel}
      live={live}
      headerExtra={<ThemeCycle initial={theme} />}
      className="mx-auto h-dvh max-w-[480px] sm:my-6 sm:h-[min(860px,calc(100dvh-48px))] sm:rounded-[24px] sm:shadow-hero"
    />
  );
}
