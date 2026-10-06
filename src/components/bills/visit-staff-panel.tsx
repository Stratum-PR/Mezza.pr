"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { staffVisitsRead, staffVisitChange, staffBillReceipt } from "@/lib/bills/actions";
import { printerDriver } from "@/connectors/printing";
import { allocateBill, type UnitAssignment } from "@/lib/bills/allocation";
import type { VisitState } from "@/lib/bills/types";
import { dollarsToCents, formatCents } from "@/lib/money";

const btn = "min-h-11 rounded-btn bg-accent px-3 py-2 font-bold text-accent-ink disabled:opacity-50";
const field = "min-h-11 rounded border border-line bg-surface p-2";
type Table = { id: string; label: string; visit: VisitState | null };
export function VisitStaffPanel({ slug, canManage }: { slug: string; canManage: boolean }) {
  const [tables, setTables] = useState<Table[]>([]),
    [tableId, setTableId] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [ticket, setTicket] = useState("");
  const [pending, startTransition] = useTransition(),
    busy = useRef(false),
    prior = useRef<Map<string, string[]> | null>(null);
  const [mode, setMode] = useState<"even" | "items">("even"),
    [people, setPeople] = useState<string[]>([]),
    [assignments, setAssignments] = useState<UnitAssignment[]>([]),
    [ack, setAck] = useState(false);
  const [covered, setCovered] = useState<string[]>([]),
    [payer, setPayer] = useState(""),
    [tender, setTender] = useState(""),
    [tip, setTip] = useState("0"),
    [personName, setPersonName] = useState("");
  const paymentAttempt = useRef<{ payload: string; key: string } | null>(null);
  const table = tables.find((t) => t.id === tableId),
    v = table?.visit;
  const context = `${tableId}:${v?.id ?? "closed"}`;
  const [formContext, setFormContext] = useState(context);
  // A new party at the same table must not inherit the previous party's form.
  if (formContext !== context) {
    setFormContext(context);
    setMode("even");
    setPeople([]);
    setAssignments([]);
    setAck(false);
    setCovered([]);
    setPayer("");
    setTender("");
    setTip("0");
    setPersonName("");
    setTicket("");
    setNotice("");
    setError("");
  }
  const read = useCallback(async () => {
    if (busy.current) return;
    const r = await staffVisitsRead(slug);
    if (r.ok) {
      const current = new Map(
        r.data.tables
          .filter((t) => t.visit)
          .map((t) => [t.visit!.id, t.visit!.participants.map((p) => p.id)]),
      );
      if (
        prior.current &&
        r.data.tables.some(
          (t) =>
            t.visit &&
            prior.current!.has(t.visit.id) &&
            t.visit.participants.some((p) => !prior.current!.get(t.visit!.id)!.includes(p.id)),
        )
      )
        setNotice("Una persona se unió a una mesa.");
      prior.current = current;
      setTables(r.data.tables);
    } else setError(r.error);
  }, [slug]);
  useEffect(() => {
    startTransition(() => {
      void read();
    });
    const timer = setInterval(() => {
      startTransition(() => {
        void read();
      });
    }, 6000);
    return () => clearInterval(timer);
  }, [read]);
  function selectTable(id: string) {
    setTableId(id);
    setPeople([]);
    setAssignments([]);
    setCovered([]);
    setPayer("");
    setTicket("");
    setAck(false);
    setError("");
  }
  function run(input: Record<string, unknown>) {
    if (busy.current) return;
    busy.current = true;
    setError("");
    startTransition(async () => {
      try {
        const r = await staffVisitChange(slug, input);
        if (!r.ok) {
          setError(r.error);
          return;
        }
        if (r.data.recoveryTicket) setTicket(r.data.recoveryTicket);
        setTables((ts) =>
          ts.map((t) =>
            t.id === r.data.visit.tableId
              ? { ...t, visit: r.data.visit.status === "closed" ? null : r.data.visit }
              : t,
          ),
        );
        if (input.op === "cash") {
          setNotice("Efectivo confirmado. El exceso entregado se devuelve como cambio.");
          paymentAttempt.current = null;
          setCovered([]);
          setTender("");
          setTip("0");
        }
        if (input.op === "freeze" || input.op === "reopen") setCovered([]);
      } catch {
        setError("connection_failed");
      } finally {
        busy.current = false;
      }
    });
  }
  function action(op: string, data: Record<string, unknown> = {}) {
    if (v) run({ op, tabId: v.id, ...data });
  }
  const portions = covered.map((id) => v?.portions.find((p) => p.id === id)).filter((p) => p != null);
  const due =
    portions.reduce((n, p) => n + p.subtotalCents + p.stateCents + p.municipalCents, 0) +
    (dollarsToCents(tip) ?? 0);
  const tenderCents = dollarsToCents(tender);
  let preview: ReturnType<typeof allocateBill> = [],
    allocationError = "";
  if (v?.status === "open" && people.length) {
    try {
      preview = allocateBill(
        v.lines,
        people.map((id) => ({
          participantId: id,
          label: v.participants.find((p) => p.id === id)?.name ?? id,
        })),
        mode,
        assignments,
        v.tax,
      );
    } catch (e) {
      allocationError = e instanceof Error ? e.message : "invalid";
    }
  }
  function toggleUnit(lineId: string, unit: number, id: string) {
    setAssignments((prev) => {
      const old = prev.find((a) => a.lineId === lineId && a.unit === unit),
        recipients = old?.recipients ?? [];
      return [
        ...prev.filter((a) => a !== old),
        {
          lineId,
          unit,
          recipients: recipients.includes(id) ? recipients.filter((p) => p !== id) : [...recipients, id],
        },
      ];
    });
  }
  return (
    <section className="my-5 space-y-4 rounded-card border border-line bg-surface p-4" aria-busy={pending}>
      <h2 className="text-xl font-bold">Visitas y cuentas divididas</h2>
      <p>
        Abre la visita antes de que los clientes ordenen. Acepta cada envío y bloquea la cuenta antes de
        repartirla.
      </p>
      <label className="flex gap-2">
        Mesa
        <select
          aria-label="Mesa para dividir cuenta"
          className={field}
          value={tableId}
          onChange={(e) => selectTable(e.target.value)}
        >
          <option value="">Selecciona mesa</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}{" "}
              {t.visit
                ? `· ${t.visit.status} · ${t.visit.requests.filter((r) => r.status === "pending").length} por aceptar`
                : "· cerrada"}
            </option>
          ))}
        </select>
      </label>
      {error && <p role="alert">No se completó la acción: {error}. Actualiza la mesa antes de reintentar.</p>}
      {notice && <p role="status">{notice}</p>}
      {table && !v && (
        <button className={btn} disabled={pending} onClick={() => run({ op: "open", tableId: table.id })}>
          Abrir visita
        </button>
      )}
      {v && (
        <>
          <div className="flex flex-wrap gap-2">
            <b>
              Mesa {table?.label} · {v.status}
            </b>
            <button
              className={btn}
              disabled={pending}
              onClick={() => action("pause", { paused: !v.orderingPaused })}
            >
              {v.orderingPaused ? "Reanudar pedidos del restaurante" : "Pausar pedidos del restaurante"}
            </button>
          </div>
          <h3 className="font-bold">Personas ({v.participants.length})</h3>
          {v.participants.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 border-b border-line pb-2">
              <b>
                {p.name} ({p.id.slice(0, 4)})
              </b>
              <span>{p.removed ? "Sin acceso" : ""}</span>
              <button
                className={btn}
                disabled={pending}
                onClick={() => {
                  if (confirm(`¿Quitar el acceso de ${p.name}? Sus cargos siguen en la cuenta.`))
                    action("remove", { participantId: p.id });
                }}
              >
                Quitar acceso
              </button>
              <button
                className={btn}
                disabled={pending}
                onClick={() => action("recover", { participantId: p.id })}
              >
                Recuperar acceso
              </button>
              <small>{p.draft.lines.map((l) => `${l.qty} × ${l.nameEs}`).join(", ")}</small>
            </div>
          ))}
          {ticket && (
            <div className="rounded border p-3">
              <b>Código de recuperación</b>
              <p>Entrega este código al cliente que verificaste. Se usa una vez y vence en 10 minutos.</p>
              <code className="break-all">{ticket}</code>
              <button className={btn} onClick={() => void navigator.clipboard.writeText(ticket)}>
                Copiar
              </button>
            </div>
          )}
          {v.status === "open" && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                action("add_person", { name: personName });
                setPersonName("");
              }}
            >
              <input
                aria-label="Nombre de persona sin teléfono"
                placeholder="Persona sin teléfono"
                className={field}
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                required
                maxLength={32}
              />
              <button disabled={pending} className={btn}>
                Añadir persona
              </button>
            </form>
          )}
          <h3 className="font-bold">Envíos por revisar</h3>
          {v.requests
            .filter((r) => ["pending", "cancel_requested"].includes(r.status))
            .map((r) => (
              <div key={r.id} className="space-y-2 rounded border border-line p-3">
                <b>
                  {r.name} · {r.status === "pending" ? "Por aceptar" : "Solicita cancelación"}
                </b>
                <p>
                  {r.lines
                    .map(
                      (l) =>
                        `${l.qty} × ${l.nameEs}${l.optionsEs.length ? ` (${l.optionsEs.join(", ")})` : ""}${l.note ? ` · ${l.note}` : ""}`,
                    )
                    .join("; ")}
                </p>
                {r.status === "pending" ? (
                  <button disabled={pending} className={btn} onClick={() => action("accept", { id: r.id })}>
                    Aceptar y enviar a cocina
                  </button>
                ) : (
                  <button
                    disabled={pending || !canManage}
                    className={btn}
                    onClick={() => {
                      const reason = prompt("Motivo para cancelar los cargos:");
                      if (reason) action("cancel", { id: r.id, reason });
                    }}
                  >
                    Aprobar cancelación (gerente)
                  </button>
                )}
                <button
                  disabled={pending}
                  className={btn}
                  onClick={() => {
                    const reason = prompt("Motivo para rechazar:");
                    if (reason) action("reject", { id: r.id, reason });
                  }}
                >
                  Rechazar
                </button>
              </div>
            ))}
          <h3 className="font-bold">Cargos aceptados</h3>
          {[...new Set(v.portions.flatMap((p) => (p.paymentId ? [p.paymentId] : [])))].map((paymentId) => (
            <button
              key={paymentId}
              className={btn}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const receipt = await staffBillReceipt(slug, paymentId);
                    if (!receipt.ok) {
                      setError(receipt.error);
                      return;
                    }
                    const result = await printerDriver("browser").print(
                      { id: "browser", widthChars: 42 },
                      receipt.data,
                    );
                    if (!result.ok) setError(result.error);
                  } catch {
                    setError("connection_failed");
                  }
                })
              }
            >
              Imprimir recibo · {v.portions.find((p) => p.paymentId === paymentId)?.payerName}
            </button>
          ))}
          {v.lines.map((l) => (
            <p key={l.id}>
              {l.qty} × {l.name} · {formatCents(l.qty * l.unitCents)}
            </p>
          ))}
          <p>
            Subtotal {formatCents(v.lines.reduce((n, l) => n + l.qty * l.unitCents, 0))} · IVU{" "}
            {formatCents(v.tax.state + v.tax.municipal)}
          </p>
          {v.status === "open" && v.lines.every((l) => l.unitCents === 0) && (
            <button
              className={btn}
              disabled={pending}
              onClick={() => {
                if (
                  confirm("¿Cerrar visita sin cargos? Se descartarán los carritos y los envíos pendientes.")
                )
                  action("close");
              }}
            >
              Cerrar visita sin cargos
            </button>
          )}
          {v.status === "open" && (
            <fieldset className="space-y-3" disabled={pending}>
              <legend className="font-bold">Bloquear y dividir</legend>
              <label>
                División
                <select
                  className={field}
                  value={mode}
                  onChange={(e) => setMode(e.target.value as "even" | "items")}
                >
                  <option value="even">En partes iguales</option>
                  <option value="items">Por platos y cantidades</option>
                </select>
              </label>
              <p>
                Selecciona las personas que deben pagar. Un plato compartido se reparte entre las personas
                seleccionadas para esa unidad.
              </p>
              {v.participants.map((p) => (
                <label key={p.id} className="mr-4 inline-flex gap-2">
                  <input
                    type="checkbox"
                    checked={people.includes(p.id)}
                    onChange={() => {
                      setPeople((prev) =>
                        prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                      );
                      setAssignments([]);
                    }}
                  />
                  {p.name} ({p.id.slice(0, 4)})
                </label>
              ))}
              {mode === "items" &&
                v.lines.flatMap((l) =>
                  Array.from({ length: l.qty }, (_, unit) => (
                    <div key={`${l.id}:${unit}`} className="rounded border p-2">
                      <b>
                        {l.name} · unidad {unit + 1} · {formatCents(l.unitCents)}
                      </b>
                      <div>
                        {people.map((id) => (
                          <label key={id} className="mr-3 inline-flex gap-2">
                            <input
                              type="checkbox"
                              checked={
                                assignments
                                  .find((a) => a.lineId === l.id && a.unit === unit)
                                  ?.recipients.includes(id) ?? false
                              }
                              onChange={() => toggleUnit(l.id, unit, id)}
                            />
                            {v.participants.find((p) => p.id === id)?.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )),
                )}
              {allocationError && <p>Asigna todas las unidades antes de bloquear: {allocationError}</p>}
              {preview.map((p) => (
                <p key={p.participantId}>
                  {p.label}: {formatCents(p.subtotalCents + p.stateCents + p.municipalCents)}
                </p>
              ))}
              <label className="flex gap-2">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                Avisé que los carritos sin enviar no se cobrarán y quedarán bloqueados.
              </label>
              <button
                className={btn}
                disabled={
                  !preview.length ||
                  !!allocationError ||
                  v.requests.some((r) => ["pending", "cancel_requested"].includes(r.status)) ||
                  (v.participants.some((p) => p.draft.lines.length > 0) && !ack)
                }
                onClick={() =>
                  action("freeze", {
                    revision: v.revision,
                    mode,
                    participantIds: people,
                    assignments,
                    ackDrafts: ack,
                  })
                }
              >
                Bloquear cuenta y guardar reparto
              </button>
            </fieldset>
          )}
          {v.status === "paying" && (
            <>
              <h3 className="font-bold">Porciones y cobro</h3>
              {v.portions.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 border-b p-2">
                  <label>
                    <input
                      type="checkbox"
                      disabled={pending || p.status !== "unpaid"}
                      checked={covered.includes(p.id)}
                      onChange={() =>
                        setCovered((prev) =>
                          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                        )
                      }
                    />
                    {p.label} · {formatCents(p.subtotalCents + p.stateCents + p.municipalCents)} · {p.status}
                  </label>
                  {p.status === "unpaid" && canManage && (
                    <button
                      className={btn}
                      disabled={pending}
                      onClick={() => {
                        const reason = prompt("Motivo para resolver sin cobrar. No registra efectivo:");
                        if (reason) action("writeoff", { id: p.id, reason });
                      }}
                    >
                      Resolver saldo sin cobro
                    </button>
                  )}
                </div>
              ))}
              <form
                className="flex flex-wrap gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (tenderCents === null || dollarsToCents(tip) === null) {
                    setError("invalid_amount");
                    return;
                  }
                  const data = {
                    portionIds: covered,
                    payerId: payer,
                    tipCents: dollarsToCents(tip),
                    tenderCents,
                  };
                  const payload = JSON.stringify({ ...data, tabId: v.id });
                  if (!paymentAttempt.current || paymentAttempt.current.payload !== payload)
                    paymentAttempt.current = { payload, key: crypto.randomUUID() };
                  action("cash", { ...data, key: paymentAttempt.current.key });
                }}
              >
                <label>
                  Persona que paga
                  <select className={field} value={payer} onChange={(e) => setPayer(e.target.value)} required>
                    <option value="">Selecciona</option>
                    {v.participants.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name} ({p.id.slice(0, 4)})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Propina explícita ($)
                  <input
                    className={field}
                    value={tip}
                    onChange={(e) => setTip(e.target.value)}
                    inputMode="decimal"
                    required
                  />
                </label>
                <label>
                  Efectivo entregado ($)
                  <input
                    className={field}
                    value={tender}
                    onChange={(e) => setTender(e.target.value)}
                    inputMode="decimal"
                    required
                  />
                </label>
                <p className="w-full">
                  Total a cobrar {formatCents(due)} · Cambio{" "}
                  {formatCents(Math.max(0, (tenderCents ?? 0) - due))}
                </p>
                <button
                  className={btn}
                  disabled={pending || !covered.length || !payer || tenderCents === null || tenderCents < due}
                >
                  Confirmar efectivo recibido
                </button>
              </form>
              <button
                className={btn}
                disabled={pending || v.portions.some((p) => p.status !== "unpaid")}
                onClick={() => action("reopen")}
              >
                Desbloquear antes del primer cobro
              </button>
              <button
                className={btn}
                disabled={pending || v.portions.some((p) => p.status === "unpaid")}
                onClick={() => {
                  if (confirm("¿Todos los saldos están resueltos y la cuenta fue cerrada en el POS?"))
                    action("close");
                }}
              >
                Cerrar visita en POS
              </button>
            </>
          )}
        </>
      )}
    </section>
  );
}
