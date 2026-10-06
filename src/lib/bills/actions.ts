"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { refreshRecentSales } from "@/lib/reports/refresh";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSection } from "@/lib/auth/staff";
import type { Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/db/admin";
import { resolveTable } from "@/lib/guest/resolve";
import { loadMenu } from "@/lib/menu/load";
import { allocateBill } from "./allocation";
import { billsDb, workflow } from "./db";
import { splitWorkflowEnabled } from "./feature";
import type { BillResult, GuestVisit, VisitState, VisitReceipt } from "./types";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const name = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^[^\p{Cc}\p{Cf}<>]+$/u);
const uuid = z.uuid();
const sessionSchema = z.object({ tabId: uuid, secret: z.string().regex(/^[a-f0-9]{64}$/) });
const linesSchema = z
  .array(
    z.object({
      key: z.string().max(300),
      itemId: uuid,
      qty: z.number().int().min(1).max(20),
      optionIds: z.array(uuid).max(20),
      note: z.string().trim().max(200).optional(),
    }),
  )
  .max(50);
const errors = [
  "session_expired",
  "visit_not_open",
  "stale_cart",
  "bill_locked",
  "pending_requests",
  "unsent_drafts",
  "stale_bill",
  "insufficient_tender",
  "portion_already_settled",
  "cannot_reopen",
  "ordering_paused",
  "participant_limit",
  "request_limit",
  "visit_already_open",
  "unsettled_bill",
  "forbidden",
  "rate_limited",
  "price_changed",
  "item_unavailable",
  "invalid_modifiers",
  "item_unavailable",
  "cart_limit",
  "invalid_recovery",
];
const failure = (e: unknown) => ({
  ok: false as const,
  error: errors.find((s) => e instanceof Error && e.message.includes(s)) ?? "failed",
});
function enabled() {
  if (!splitWorkflowEnabled()) throw new Error("disabled");
}
async function rate(key: string, max: number, seconds = 60) {
  const { data, error } = await billsDb().rpc("visit_rate_limit", {
    p_key: key,
    p_max: max,
    p_seconds: seconds,
  });
  if (error || !data) throw new Error("rate_limited");
}
async function guestContext(slug: string, token: string) {
  enabled();
  const g = await resolveTable(slug, token);
  if (!g) throw new Error("forbidden");
  return g;
}
function cookieNames(tableId: string) {
  return { visit: `mv_${tableId}`, receipt: `mr_${tableId}` };
}
async function session(tableId: string) {
  const jar = await cookies();
  const raw = jar.get(cookieNames(tableId).visit)?.value;
  return raw ? sessionSchema.parse(JSON.parse(raw)) : null;
}
async function saveSession(tableId: string, tabId: string, secret: string, receipt: string) {
  const jar = await cookies(),
    names = cookieNames(tableId),
    opts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict" as const,
      path: "/",
      maxAge: 11 * 86400,
    };
  jar.set(names.visit, JSON.stringify({ tabId, secret }), opts);
  jar.set(names.receipt, receipt, opts);
}
async function canonicalCart(restaurantId: string, input: unknown) {
  const draft = linesSchema.parse(input),
    menu = await loadMenu(createAdminClient(), restaurantId);
  const normalized = draft.map((l) => {
    const item = menu.items.find((i) => i.id === l.itemId);
    if (!item?.isAvailable) throw new Error("item_unavailable");
    if (new Set(l.optionIds).size !== l.optionIds.length) throw new Error("invalid_modifiers");
    const opts = item.modifierGroups.flatMap((g) => g.options).filter((o) => l.optionIds.includes(o.id));
    if (
      opts.length !== l.optionIds.length ||
      item.modifierGroups.some((g) => {
        const n = g.options.filter((o) => l.optionIds.includes(o.id)).length;
        return n < g.min || n > g.max;
      })
    )
      throw new Error("invalid_modifiers");
    const key = `${l.itemId}|${[...l.optionIds].sort().join(",")}|${l.note ?? ""}`;
    return {
      ...l,
      key,
      nameEs: item.nameEs,
      nameEn: item.nameEn,
      unitCents: item.priceCents + opts.reduce((n, o) => n + o.priceCents, 0),
      optionsEs: opts.map((o) => o.nameEs),
      optionsEn: opts.map((o) => o.nameEn),
    };
  });
  if (
    new Set(normalized.map((l) => l.key)).size !== normalized.length ||
    normalized.reduce((n, l) => n + l.qty, 0) > 100 ||
    normalized.reduce((n, l) => n + l.qty * l.unitCents, 0) > 100000
  )
    throw new Error("cart_limit");
  return normalized;
}
export async function guestVisitJoin(
  slug: string,
  token: string,
  inputName: string,
  expectedTabId: string,
): Promise<BillResult<GuestVisit>> {
  try {
    const g = await guestContext(slug, token),
      tabId = uuid.parse(expectedTabId);
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    await rate(`join:${g.table.id}:${hash(ip)}`, 10);
    await rate(`join-table:${g.table.id}`, 30);
    const existing = await session(g.table.id);
    if (existing?.tabId === tabId) {
      try {
        return {
          ok: true,
          data: await workflow<GuestVisit>({
            p_op: "snapshot",
            p_tab: tabId,
            p_table: g.table.id,
            p_secret_hash: hash(existing.secret),
          }),
        };
      } catch (e) {
        if (!(e instanceof Error && e.message.includes("session_expired"))) throw e;
      }
    }
    const secret = randomBytes(32).toString("hex"),
      receipt =
        (await cookies()).get(cookieNames(g.table.id).receipt)?.value ?? randomBytes(32).toString("hex");
    const data = await workflow<GuestVisit>({
      p_op: "join",
      p_table: g.table.id,
      p_tab: tabId,
      p_secret_hash: hash(secret),
      p_data: { name: name.parse(inputName), receiptHash: hash(receipt) },
    });
    await saveSession(g.table.id, data.visit.id, secret, receipt);
    return { ok: true, data };
  } catch (e) {
    return failure(e);
  }
}
export async function guestVisitRead(
  slug: string,
  token: string,
): Promise<BillResult<{ visit: GuestVisit | null; joinTabId: string | null; receipts: VisitReceipt[] }>> {
  try {
    const g = await guestContext(slug, token);
    await rate(`read:${g.table.id}`, 900);
    const jar = await cookies(),
      receipt = jar.get(cookieNames(g.table.id).receipt)?.value;
    let receipts: VisitReceipt[] = [];
    if (receipt) {
      const r = await billsDb().rpc("visit_private_receipts", { p_hash: hash(receipt), p_table: g.table.id });
      if (r.error) throw new Error("failed");
      receipts = (r.data ?? []) as unknown as VisitReceipt[];
    }
    const s = await session(g.table.id);
    if (s) {
      try {
        const visit = await workflow<GuestVisit>({
          p_op: "snapshot",
          p_tab: s.tabId,
          p_table: g.table.id,
          p_secret_hash: hash(s.secret),
        });
        return { ok: true, data: { visit, joinTabId: null, receipts } };
      } catch (e) {
        if (!(e instanceof Error && /session_expired|visit_not_open/.test(e.message))) throw e;
      }
    }
    const { data, error } = await createAdminClient()
      .from("tabs")
      .select("id,status")
      .eq("table_id", g.table.id)
      .eq("status", "open")
      .maybeSingle();
    if (error) throw new Error("failed");
    return { ok: true, data: { visit: null, joinTabId: data?.id ?? null, receipts } };
  } catch (e) {
    return failure(e);
  }
}
export async function guestVisitChange(
  slug: string,
  token: string,
  op: "draft" | "submit" | "request_cancel" | "rename" | "request_service",
  input: unknown,
): Promise<BillResult<GuestVisit>> {
  try {
    const g = await guestContext(slug, token),
      s = await session(g.table.id);
    if (!s) throw new Error("session_expired");
    await rate(`guest:${s.tabId}:${hash(s.secret)}`, op === "draft" ? 120 : 20);
    let data: Record<string, unknown>;
    if (op === "draft") {
      const p = z.object({ version: z.number().int().nonnegative(), lines: z.unknown() }).parse(input);
      data = { version: p.version, lines: await canonicalCart(g.restaurant.id, p.lines) };
    } else if (op === "submit")
      data = z
        .object({ id: uuid, version: z.number().int().nonnegative(), locale: z.enum(["es", "en"]) })
        .parse(input);
    else if (op === "request_cancel") data = z.object({ id: uuid }).parse(input);
    else if (op === "request_service")
      data = z.object({ kind: z.enum(["call_server", "bring_check"]) }).parse(input);
    else if (op === "rename") data = z.object({ name }).parse(input);
    else throw new Error("forbidden");
    await workflow({
      p_op: op,
      p_tab: s.tabId,
      p_table: g.table.id,
      p_secret_hash: hash(s.secret),
      p_data: data as Json,
    });
    return {
      ok: true,
      data: await workflow<GuestVisit>({
        p_op: "snapshot",
        p_tab: s.tabId,
        p_table: g.table.id,
        p_secret_hash: hash(s.secret),
      }),
    };
  } catch (e) {
    return failure(e);
  }
}
export async function staffVisitsRead(
  slug: string,
): Promise<BillResult<{ tables: { id: string; label: string; visit: VisitState | null }[] }>> {
  const ctx = await requireSection(slug, "service");
  try {
    enabled();
    const db = createAdminClient();
    const { data: tables, error } = await db
      .from("dining_tables")
      .select("id,label")
      .eq("restaurant_id", ctx.restaurant.id)
      .order("label");
    if (error) throw error;
    const { data: tabs, error: te } = await db
      .from("tabs")
      .select("id,table_id")
      .eq("restaurant_id", ctx.restaurant.id)
      .neq("status", "closed");
    if (te) throw te;
    const result = await Promise.all(
      (tables ?? []).map(async (table) => {
        const tab = tabs?.find((t) => t.table_id === table.id);
        return {
          ...table,
          visit: tab
            ? await workflow<VisitState>({ p_op: "snapshot", p_tab: tab.id, p_actor: ctx.userId })
            : null,
        };
      }),
    );
    return { ok: true, data: { tables: result } };
  } catch (e) {
    return failure(e);
  }
}
const staffOps = z.discriminatedUnion("op", [
  z.object({ op: z.literal("open"), tableId: uuid }),
  ...(["accept", "reject", "cancel"] as const).map((op) =>
    z.object({
      op: z.literal(op),
      tabId: uuid,
      id: uuid,
      reason: z.string().trim().min(3).max(200).optional(),
    }),
  ),
  z.object({ op: z.literal("add_person"), tabId: uuid, name }),
  z.object({ op: z.literal("remove"), tabId: uuid, participantId: uuid }),
  z.object({ op: z.literal("recover"), tabId: uuid, participantId: uuid }),
  z.object({ op: z.literal("pause"), tabId: uuid, paused: z.boolean() }),
  z.object({
    op: z.literal("freeze"),
    tabId: uuid,
    revision: z.number().int().nonnegative(),
    mode: z.enum(["even", "items"]),
    participantIds: z.array(uuid).min(1).max(20),
    assignments: z
      .array(
        z.object({
          lineId: uuid,
          unit: z.number().int().min(0).max(98),
          recipients: z.array(uuid).min(1).max(20),
        }),
      )
      .max(1000),
    ackDrafts: z.boolean(),
  }),
  z.object({
    op: z.literal("cash"),
    tabId: uuid,
    portionIds: z.array(uuid).min(1).max(20),
    payerId: uuid,
    key: uuid,
    tipCents: z.number().int().min(0).max(1000000),
    tenderCents: z.number().int().min(0).max(10000000),
  }),
  z.object({ op: z.literal("writeoff"), tabId: uuid, id: uuid, reason: z.string().trim().min(3).max(200) }),
  ...(["reopen", "close"] as const).map((op) => z.object({ op: z.literal(op), tabId: uuid })),
]);
export async function staffVisitChange(
  slug: string,
  input: unknown,
): Promise<BillResult<{ visit: VisitState; recoveryTicket?: string }>> {
  const ctx = await requireSection(slug, "service");
  try {
    enabled();
    const p = staffOps.parse(input);
    await rate(`staff-bills:${ctx.userId}`, 120);
    // Resolve ownership before using the privileged RPC; it independently checks membership too.
    const db = createAdminClient();
    const lookup =
      p.op === "open"
        ? await db.from("dining_tables").select("restaurant_id").eq("id", p.tableId).single()
        : await db.from("tabs").select("restaurant_id").eq("id", p.tabId).single();
    if (lookup.error || lookup.data.restaurant_id !== ctx.restaurant.id) throw new Error("forbidden");
    let payload: Record<string, unknown> = { ...p };
    let recoveryTicket: string | undefined;
    if (p.op === "freeze") {
      const current = await workflow<VisitState>({ p_op: "snapshot", p_tab: p.tabId, p_actor: ctx.userId });
      const people = p.participantIds.map((id) => {
        const person = current.participants.find((x) => x.id === id);
        if (!person) throw new Error("forbidden");
        return { participantId: id, label: person.name };
      });
      payload = { ...p, portions: allocateBill(current.lines, people, p.mode, p.assignments, current.tax) };
    }
    if (p.op === "cash") payload.receiptHash = hash(randomBytes(32).toString("hex"));
    if (p.op === "recover") {
      recoveryTicket = randomBytes(32).toString("hex");
      payload = { ...p, ticketHash: hash(recoveryTicket) };
    }
    const result = await workflow<VisitState | { visit: VisitState }>({
      p_op: p.op,
      p_table: p.op === "open" ? p.tableId : undefined,
      p_tab: "tabId" in p ? p.tabId : undefined,
      p_actor: ctx.userId,
      p_data: payload as Json,
    });
    if (p.op === "cash") await refreshRecentSales(ctx.restaurant.id);
    for (const path of ["servicio", "mesas", "cocina", "reportes"]) revalidatePath(`/app/${slug}/${path}`);
    return { ok: true, data: { visit: "visit" in result ? result.visit : result, recoveryTicket } };
  } catch (e) {
    return failure(e);
  }
}
export async function guestVisitRecover(
  slug: string,
  token: string,
  ticket: string,
): Promise<BillResult<GuestVisit>> {
  try {
    const g = await guestContext(slug, token);
    await rate(`recover:${g.table.id}`, 10);
    z.string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(ticket);
    const secret = randomBytes(32).toString("hex"),
      receipt =
        (await cookies()).get(cookieNames(g.table.id).receipt)?.value ?? randomBytes(32).toString("hex");
    const { data, error } = await billsDb().rpc("visit_claim_recovery", {
      p_table: g.table.id,
      p_ticket_hash: hash(ticket),
      p_secret_hash: hash(secret),
      p_receipt_hash: hash(receipt),
    });
    if (error || !data) throw new Error("invalid_recovery");
    const visit = data as unknown as GuestVisit;
    await saveSession(g.table.id, visit.visit.id, secret, receipt);
    return { ok: true, data: visit };
  } catch (e) {
    return failure(e);
  }
}
