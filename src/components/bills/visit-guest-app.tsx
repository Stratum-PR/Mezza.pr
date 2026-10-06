"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { GuestMenu } from "@/components/menu/guest-menu";
import type { CartLine } from "@/components/menu/item-sheet";
import type { MenuData, MenuLocale } from "@/components/menu/types";
import { guestVisitRead, guestVisitJoin, guestVisitChange, guestVisitRecover } from "@/lib/bills/actions";
import type { GuestVisit, VisitReceipt } from "@/lib/bills/types";
import { formatCents } from "@/lib/money";

const button = "min-h-11 rounded-btn bg-accent px-4 py-2 font-bold text-accent-ink disabled:opacity-50";
export function VisitGuestApp({
  slug,
  token,
  tableLabel,
  menu,
  messages,
  initialLang,
}: {
  slug: string;
  token: string;
  tableLabel: string;
  menu: MenuData;
  messages: Record<MenuLocale, Record<string, unknown>>;
  initialLang: MenuLocale;
}) {
  const [visit, setVisit] = useState<GuestVisit | null>(null),
    [joinTabId, setJoinTabId] = useState<string | null>(null),
    [receipts, setReceipts] = useState<VisitReceipt[]>([]);
  const [name, setName] = useState(""),
    [ticket, setTicket] = useState(""),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(false),
    [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState("");
  const busy = useRef(false),
    previousPeople = useRef<string[] | null>(null),
    previousVisit = useRef<string | null>(null),
    submission = useRef<{ id: string; version: number } | null>(null);
  const [lang, setLang] = useState(initialLang);
  const es = lang === "es";
  const say = (spanish: string, english: string) => (es ? spanish : english);
  const consume = useCallback(
    (v: GuestVisit | null) => {
      if (v) {
        const ids = v.visit.participants.map((p) => p.id);
        if (
          previousVisit.current === v.visit.id &&
          previousPeople.current &&
          ids.some((id) => !previousPeople.current!.includes(id))
        )
          setNotice(es ? "Una persona se unió a la mesa." : "Someone joined the table.");
        previousPeople.current = ids;
        previousVisit.current = v.visit.id;
      }
      setVisit(v);
    },
    [es],
  );
  const refresh = useCallback(async () => {
    if (busy.current) return;
    const r = await guestVisitRead(slug, token);
    if (busy.current) return;
    if (r.ok) {
      consume(r.data.visit);
      setJoinTabId(r.data.joinTabId);
      setReceipts(r.data.receipts);
      setLoaded(true);
      setError("");
    } else {
      setError(r.error);
      setLoaded(true);
    }
  }, [slug, token, consume]);
  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
    const t = window.setInterval(() => {
      startTransition(() => {
        void refresh();
      });
    }, 6000);
    return () => clearInterval(t);
  }, [refresh]);
  const mine = visit?.visit.participants.find((p) => p.id === visit.participantId);
  function run(fn: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    startTransition(async () => {
      try {
        await fn();
      } catch {
        setError("connection_failed");
      } finally {
        busy.current = false;
      }
    });
  }
  function change(lines: CartLine[]) {
    if (!mine || !visit) return;
    run(async () => {
      const r = await guestVisitChange(slug, token, "draft", { version: mine.draft.version, lines });
      if (r.ok) {
        consume(r.data);
        setError("");
        submission.current = null;
      } else setError(r.error);
    });
  }
  const summary = visit && (
    <section className="space-y-3 rounded-card border border-line p-4">
      <div className="flex items-center justify-between gap-2">
        <b>
          {say("Mesa", "Table")} {tableLabel}
        </b>
        <span>
          {visit.visit.status === "open"
            ? say("Pedidos abiertos", "Ordering open")
            : say("Cuenta bloqueada para pagar", "Bill locked for payment")}
        </span>
      </div>
      {visit.visit.orderingPaused && (
        <p role="status">
          {say(
            "Los pedidos están pausados. La cuenta y los recibos siguen disponibles.",
            "Ordering is paused. Your bill and receipts remain available.",
          )}
        </p>
      )}
      <p>
        {say(
          "Tus pedidos necesitan aceptación del personal antes de enviarse a cocina.",
          "Staff must accept your orders before sending them to the kitchen.",
        )}
      </p>
      <div className="flex gap-2">
        {(["call_server", "bring_check"] as const).map((kind) => (
          <button
            key={kind}
            disabled={pending}
            className={button}
            onClick={() =>
              run(async () => {
                const r = await guestVisitChange(slug, token, "request_service", { kind });
                if (r.ok) {
                  consume(r.data);
                  setNotice(say("El personal recibió tu solicitud.", "Staff received your request."));
                } else setError(r.error);
              })
            }
          >
            {kind === "call_server"
              ? say("Llamar al personal", "Call staff")
              : say("Pedir la cuenta", "Ask for the bill")}
          </button>
        ))}
      </div>
      <details>
        <summary>
          {say("Personas y carritos de la mesa", "Table participants and carts")} (
          {visit.visit.participants.length})
        </summary>
        {visit.visit.participants.map((p) => (
          <div className="border-b border-line py-2" key={p.id}>
            <b>{p.name}</b>{" "}
            <small>
              ({p.id.slice(0, 4)}) {p.id === visit.participantId ? say("Tú", "You") : ""}{" "}
              {p.removed ? say("sin acceso", "no access") : ""}
            </small>
            <p>
              {p.draft.lines.map((l) => `${l.qty} × ${es ? l.nameEs : l.nameEn}`).join(", ") ||
                say("Carrito vacío", "Empty cart")}
            </p>
          </div>
        ))}
      </details>
      <details>
        <summary>{say("Cambiar mi nombre", "Change my name")}</summary>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await guestVisitChange(slug, token, "rename", { name });
              if (r.ok) consume(r.data);
              else setError(r.error);
            });
          }}
        >
          <input
            aria-label={say("Nombre", "Name")}
            value={name}
            maxLength={32}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border p-2"
            required
          />
          <button className={button} disabled={pending}>
            {say("Guardar", "Save")}
          </button>
        </form>
      </details>
      {visit.visit.requests.map((r) => (
        <div key={r.id} className="rounded border border-line p-2">
          <b>{r.name}</b>{" "}
          <span>
            {
              (
                {
                  pending: say("Por aceptar", "Awaiting staff"),
                  accepted: say("Aceptado", "Accepted"),
                  rejected: say("Rechazado", "Rejected"),
                  cancel_requested: say("Cancelación por revisar", "Cancellation under review"),
                  cancelled: say("Cancelado", "Cancelled"),
                } as Record<string, string>
              )[r.status]
            }
          </span>
          <p>{r.lines.map((l) => `${l.qty} × ${es ? l.nameEs : l.nameEn}`).join(", ")}</p>
          {r.participantId === visit.participantId &&
            visit.visit.status === "open" &&
            ["pending", "accepted"].includes(r.status) && (
              <button
                disabled={pending}
                className={button}
                onClick={() =>
                  run(async () => {
                    const res = await guestVisitChange(slug, token, "request_cancel", { id: r.id });
                    if (res.ok) consume(res.data);
                    else setError(res.error);
                  })
                }
              >
                {say("Solicitar cancelación", "Request cancellation")}
              </button>
            )}
        </div>
      ))}
      {visit.visit.portions.map((p) => (
        <div key={p.id}>
          <b>{p.label}</b>: {formatCents(p.subtotalCents + p.stateCents + p.municipalCents)} ·{" "}
          {p.status === "paid"
            ? say("Pagado", "Paid")
            : p.status === "written_off"
              ? say("Resuelto por gerente", "Resolved by manager")
              : say("Pendiente: paga al personal", "Due: pay staff")}
          {p.status === "paid" && p.payerName && (
            <span>
              {" "}
              · {say("Pagó", "Paid by")}: {p.payerName}
            </span>
          )}
        </div>
      ))}
    </section>
  );
  return (
    <main className="mx-auto max-w-lg pb-5">
      <div className="space-y-3 p-4" aria-busy={pending}>
        {!loaded && <p>{say("Cargando visita…", "Loading visit…")}</p>}
        {error && (
          <p role="alert">
            {say("No se pudo completar la acción", "Action could not be completed")}: {error}.{" "}
            <button
              className="underline"
              onClick={() =>
                startTransition(() => {
                  void refresh();
                })
              }
            >
              {say("Actualizar", "Refresh")}
            </button>
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {loaded && !visit && (
          <section className="space-y-2">
            <h1 className="text-xl font-bold">
              {say("Mesa", "Table")} {tableLabel}
            </h1>
            <p>
              {joinTabId
                ? say(
                    "Escribe tu nombre para unirte. Puedes ver los carritos de tu mesa.",
                    "Enter your name to join. You can see your table’s carts.",
                  )
                : say(
                    "El personal debe abrir la visita para ordenar. Puedes explorar el menú.",
                    "Staff must open a visit before you can order. You can browse the menu.",
                  )}
            </p>
            {joinTabId && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const r = await guestVisitJoin(slug, token, name, joinTabId);
                    if (r.ok) {
                      consume(r.data);
                      setError("");
                    } else setError(r.error);
                  });
                }}
              >
                <input
                  aria-label={say("Tu nombre", "Your name")}
                  placeholder={say("Tu nombre", "Your name")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={32}
                  required
                  className="w-full rounded border p-2"
                />
                <button className={button} disabled={pending}>
                  {say("Unirme", "Join")}
                </button>
              </form>
            )}
            <details>
              <summary>{say("Recuperar mi acceso con el personal", "Recover access with staff")}</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    const r = await guestVisitRecover(slug, token, ticket);
                    if (r.ok) {
                      consume(r.data);
                      setTicket("");
                    } else setError(r.error);
                  });
                }}
              >
                <input
                  aria-label={say("Código de recuperación", "Recovery code")}
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  maxLength={64}
                  className="w-full rounded border p-2"
                  required
                />
                <button className={button} disabled={pending}>
                  {say("Recuperar", "Recover")}
                </button>
              </form>
            </details>
          </section>
        )}
        {summary}
        {receipts.map((r) => (
          <section className="space-y-2 rounded border p-3" key={r.paymentId}>
            <h2 className="font-bold">
              {say("Mi recibo", "My receipt")} · {r.restaurant}
            </h2>
            <p>
              {r.paidAt} · {say("Efectivo", "Cash")} · {r.paymentStatus}
            </p>
            {r.portions.map((p, i) => (
              <div key={i}>
                <b>{p.label}</b>
                {p.lines
                  .filter((l) => l.cents > 0)
                  .map((l, j) => (
                    <p key={j}>
                      {l.name}: {formatCents(l.cents)}
                    </p>
                  ))}
              </div>
            ))}
            <p>
              {say("Subtotal", "Subtotal")}: {formatCents(r.subtotalCents)} · IVU:{" "}
              {formatCents(r.stateCents + r.municipalCents)} · {say("Propina", "Tip")}:{" "}
              {formatCents(r.tipCents)}
            </p>
            <b>{formatCents(r.subtotalCents + r.stateCents + r.municipalCents + r.tipCents)}</b>
            {r.refundCents > 0 && (
              <p>
                {say("Reembolsado", "Refunded")}: {formatCents(r.refundCents)}
              </p>
            )}
            <p>
              {say(
                "Disponible durante 7 días después de cerrar la mesa.",
                "Available for 7 days after the table closes.",
              )}
            </p>
            <button
              className={button}
              onClick={() => {
                const a = document.createElement("a"),
                  url = URL.createObjectURL(
                    new Blob(
                      [
                        [
                          "Mezza · " + r.restaurant,
                          "Recibo de pago (no fiscal)",
                          r.paymentId,
                          r.paidAt,
                          "Efectivo",
                          ...r.portions.flatMap((p) => [
                            p.label,
                            ...p.lines
                              .filter((l) => l.cents > 0)
                              .map((l) => `${l.name}: ${formatCents(l.cents)}`),
                          ]),
                          `Subtotal: ${formatCents(r.subtotalCents)}`,
                          `IVU estatal: ${formatCents(r.stateCents)}`,
                          `IVU municipal: ${formatCents(r.municipalCents)}`,
                          `Propina: ${formatCents(r.tipCents)}`,
                          `Total pagado: ${formatCents(r.subtotalCents + r.stateCents + r.municipalCents + r.tipCents)}`,
                          `Reembolsado: ${formatCents(r.refundCents)}`,
                        ].join("\n"),
                      ],
                      { type: "text/plain;charset=utf-8" },
                    ),
                  );
                a.href = url;
                a.download = `mezza-receipt-${r.paymentId}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              {say("Descargar recibo", "Download receipt")}
            </button>
          </section>
        ))}
      </div>
      <GuestMenu
        menu={menu}
        messages={messages}
        initialLang={initialLang}
        onLangChange={setLang}
        tableLabel={tableLabel}
        live={{
          storageKey: "",
          controlled: {
            cart: mine?.draft.lines ?? [],
            change,
            disabled: pending || !visit || visit.visit.status !== "open" || visit.visit.orderingPaused,
          },
          render: () => ({}),
          send: async (_cart, lang) => {
            if (busy.current || !visit || !mine)
              return {
                ok: false,
                message: say("Espera a que se guarde el carrito.", "Wait for your cart to save."),
              };
            busy.current = true;
            try {
              if (!submission.current || submission.current.version !== mine.draft.version)
                submission.current = { id: crypto.randomUUID(), version: mine.draft.version };
              const r = await guestVisitChange(slug, token, "submit", {
                ...submission.current,
                locale: lang,
              });
              if (!r.ok) return { ok: false, message: r.error };
              consume(r.data);
              submission.current = null;
              return {
                ok: true,
                message: say("Enviado al personal para aceptar.", "Sent to staff for acceptance."),
              };
            } finally {
              busy.current = false;
            }
          },
        }}
      />
    </main>
  );
}
