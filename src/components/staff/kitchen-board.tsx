"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { printerDriver, type Ticket } from "@/connectors/printing";
import { Switch } from "@/components/ui/controls";
import { Panel } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { advanceOrder, logPrintJob, toggleSoldOut } from "@/lib/staff/actions";
import type { FloorOrder } from "@/lib/staff/floor";
import { useLiveRefresh, useMinutesSince } from "./live";

const COLUMNS = ["new", "in_kitchen", "ready"] as const;
const NEXT = { new: "in_kitchen", in_kitchen: "ready", ready: "served" } as const;

function toTicket(o: FloorOrder, restaurantName: string): Ticket {
  return {
    kind: "kitchen",
    restaurantName,
    tableLabel: o.tableLabel,
    orderNumber: o.number,
    createdAt: o.createdAt,
    locale: "es",
    newTable: o.openedTab,
    lines: o.lines
      .filter((l) => !l.voided)
      .map((l) => ({ qty: l.qty, name: l.nameEs, modifiers: l.options, note: l.note ?? undefined })),
  };
}

function useStoredFlag(key: string, initial: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from storage
      if (saved !== null) setValue(saved === "1");
    } catch {
      // ignore
    }
  }, [key]);
  return [
    value,
    (v: boolean) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, v ? "1" : "0");
      } catch {
        // ignore
      }
    },
  ];
}

export function KitchenBoard({
  slug,
  restaurantName,
  orders,
  items,
  realtimeImpl,
  widthChars,
}: {
  slug: string;
  restaurantName: string;
  orders: FloorOrder[];
  items: { id: string; nameEs: string; isAvailable: boolean }[];
  realtimeImpl: "polling" | "supabase_stub";
  widthChars: number;
}) {
  const t = useTranslations("staff");
  const minutes = useMinutesSince();
  const [sound, setSound] = useStoredFlag(`mezza-sound:${slug}`, false);
  const [autoprint, setAutoprint] = useStoredFlag(`mezza-autoprint:${slug}`, true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string>>(new Set(orders.map((o) => o.id)));

  // Browsers only allow sound after a user gesture: the first tap unlocks it.
  useEffect(() => {
    const unlock = () => {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const beep = useCallback(() => {
    const ctx = audio.current;
    if (!sound || !ctx) return;
    for (const offset of [0, 0.18]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.12);
    }
  }, [sound]);

  const print = useCallback(
    async (o: FloorOrder) => {
      const result = await printerDriver("browser").print(
        { id: "browser", widthChars },
        toTicket(o, restaurantName),
      );
      await logPrintJob(slug, o.id, "kitchen", result);
      setMessage(
        result.ok
          ? t("kitchen.printed", { number: o.number })
          : t("kitchen.printFailed", { number: o.number, error: result.error }),
      );
    },
    [slug, restaurantName, widthChars, t],
  );

  // New orders arriving: sound and auto-print.
  useEffect(() => {
    const fresh = orders.filter((o) => o.status === "new" && !seen.current.has(o.id));
    for (const o of orders) seen.current.add(o.id);
    if (fresh.length === 0) return;
    beep();
    setMessage(t("kitchen.newOrder", { number: fresh[0]!.number, label: fresh[0]!.tableLabel }));
    if (autoprint) for (const o of fresh) void print(o);
  }, [orders, autoprint, beep, print, t]);

  useLiveRefresh(slug, "kitchen", realtimeImpl);

  const live = orders.filter((o) => o.status !== "served" && o.status !== "void");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Switch checked={sound} onChange={setSound}>
          {t("kitchen.sound")}
        </Switch>
        <Switch checked={autoprint} onChange={setAutoprint}>
          {t("kitchen.autoprint")}
        </Switch>
        <span className="text-sm text-muted">{t("live")}</span>
      </div>
      {sound && <p className="text-xs text-muted">{t("kitchen.soundHint")}</p>}
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-semibold text-ok">
        {message}
      </p>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-3 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = live.filter((o) => o.status === col);
            return (
              <section
                key={col}
                aria-labelledby={`col-${col}`}
                className={cn(
                  "rounded-card border border-line bg-surface p-3",
                  // Empty columns stay short on phones so the next orders are in view.
                  list.length > 0 ? "min-h-40" : "md:min-h-40",
                )}
              >
                <h2 id={`col-${col}`} className="mb-2.5 flex justify-between text-lg font-extrabold">
                  {t(`kitchen.columns.${col}`)}
                  <span className="text-muted">{list.length}</span>
                </h2>
                {list.length === 0 && <p className="text-sm text-muted">{t("kitchen.empty")}</p>}
                <ul className="grid gap-2">
                  {list.map((o) => {
                    const mins = minutes(o.createdAt);
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "rounded-[10px] border border-line border-l-[5px] bg-bg p-2.5",
                          col === "new" ? "border-l-warn" : col === "ready" ? "border-l-ok" : "border-l-blue",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <b className="text-[15px]">
                            {t("orderNumber", { number: o.number })} · {t("table", { label: o.tableLabel })}
                          </b>
                          <span className="whitespace-nowrap rounded-full bg-soft px-2 py-0.5 text-xs font-bold text-accent">
                            {t(`source.${o.source}`)}
                          </span>
                        </div>
                        {o.openedTab && (
                          <span className="mt-1 inline-block rounded-full bg-warn-bg px-2 py-0.5 text-xs font-bold text-warn">
                            {t("kitchen.newTable")}
                          </span>
                        )}
                        <ul className="my-1.5 pl-1 text-[15px]">
                          {o.lines
                            .filter((l) => !l.voided)
                            .map((l) => (
                              <li key={l.id}>
                                <b>{l.qty}×</b> {l.nameEs}
                                {l.options.length > 0 && (
                                  <small className="block text-muted">{l.options.join(", ")}</small>
                                )}
                                {l.note && <small className="block font-semibold text-bad">“{l.note}”</small>}
                              </li>
                            ))}
                        </ul>
                        <p className={cn("mb-2 text-xs", mins >= 15 ? "font-bold text-bad" : "text-muted")}>
                          {t("minutes", { n: mins })}
                        </p>
                        <div className="grid grid-cols-[1fr_auto] gap-1.5">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              start(async () => void (await advanceOrder(slug, o.id, NEXT[col])))
                            }
                            className="min-h-11 rounded-[8px] bg-accent px-2 text-sm font-bold text-accent-ink"
                          >
                            {t(`kitchen.advance.${col}`)}
                          </button>
                          <button
                            type="button"
                            aria-label={t("kitchen.reprint", { number: o.number })}
                            onClick={() => void print(o)}
                            className="min-h-11 rounded-[8px] bg-soft px-3 text-sm font-bold"
                          >
                            ⎙
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        <Panel title={t("kitchen.soldOut")}>
          <p className="mb-2 text-xs text-muted">{t("kitchen.soldOutHint")}</p>
          <ul className="grid gap-1">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 border-b border-line-2 py-1.5 text-sm"
              >
                <span className={cn(!item.isAvailable && "text-muted line-through")}>{item.nameEs}</span>
                <Switch
                  checked={!item.isAvailable}
                  danger
                  onChange={(soldOut) =>
                    start(async () => void (await toggleSoldOut(slug, item.id, !soldOut)))
                  }
                >
                  <span className="sr-only">{t("kitchen.soldOutLabel", { name: item.nameEs })}</span>
                  <span aria-hidden>
                    {item.isAvailable ? t("kitchen.available") : t("kitchen.soldOutState")}
                  </span>
                </Switch>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
