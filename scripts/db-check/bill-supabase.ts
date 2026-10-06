/** Real local Auth/PostgREST and concurrent PostgreSQL verification. Never uses .env. */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { allocateBill } from "../../src/lib/bills/allocation";
import type { VisitState, GuestVisit } from "../../src/lib/bills/types";

const config = JSON.parse(
  execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "status", "-o", "json"], {
    encoding: "utf8",
  }),
);
const url = new URL(config.API_URL);
assert(["127.0.0.1", "localhost"].includes(url.hostname), "Local Supabase only");
const admin = createClient(url.href, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url.href, config.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rid = randomUUID(),
  table = randomUUID(),
  section = randomUUID(),
  item = randomUUID();
const hash = () => randomBytes(32).toString("hex");
let checks = 0;
function check(value: unknown, label: string) {
  assert(value, label);
  checks++;
  console.log(`PASS ${label}`);
}
async function insert(name: string, data: object) {
  const r = await admin.from(name).insert(data);
  assert.ifError(r.error);
}
const users: string[] = [];
let tab = "";
async function call(op: string, data = {}, actor?: string, secret?: string) {
  return admin.rpc("visit_workflow", {
    p_op: op,
    p_tab: tab || undefined,
    p_table: table,
    p_actor: actor,
    p_secret_hash: secret,
    p_data: data,
  });
}
async function ok(op: string, data = {}, actor?: string, secret?: string) {
  const r = await call(op, data, actor, secret);
  assert.ifError(r.error);
  return r.data;
}
async function main() {
  const staff = [];
  for (let i = 0; i < 3; i++) {
    const email = `bill-${randomUUID()}@test.invalid`,
      password = hash();
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(created.error);
    users.push(created.data.user!.id);
    const client = createClient(url.href, config.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const login = await client.auth.signInWithPassword({ email, password });
    assert.ifError(login.error);
    staff.push(client);
  }
  check(staff.length === 3, "real Auth owner, server and outsider sessions");
  await insert("restaurants", {
    id: rid,
    slug: `bill-${rid}`,
    name: "Isolated bill verification",
    status: "active",
  });
  await insert("memberships", [
    { restaurant_id: rid, user_id: users[0], role: "owner" },
    { restaurant_id: rid, user_id: users[1], role: "server" },
  ]);
  await insert("dining_tables", { id: table, restaurant_id: rid, label: "Verification" });
  await insert("menu_sections", { id: section, restaurant_id: rid, name_es: "Prueba", name_en: "Test" });
  await insert("menu_items", {
    id: item,
    restaurant_id: rid,
    section_id: section,
    name_es: "Plato",
    name_en: "Dish",
    price_cents: 1001,
  });
  for (const [i, client] of [anon, ...staff].entries()) {
    const denied = await client.rpc("visit_workflow", { p_op: "open", p_table: table, p_actor: users[0] });
    check(!!denied.error, `role ${i} cannot execute privileged workflow`);
    const privateRead = await client.schema("mezza_private").from("visit_sessions").select("*");
    check(!!privateRead.error, `role ${i} cannot expose private schema through REST`);
  }
  const outsider = await staff[2].from("restaurants").select("id").eq("id", rid);
  check(!outsider.error && outsider.data.length === 0, "outsider RLS hides restaurant");
  const member = await staff[1].from("restaurants").select("id").eq("id", rid);
  check(!member.error && member.data.length === 1, "authenticated staff RLS permits own restaurant");
  const opened = await Promise.all([call("open", {}, users[0]), call("open", {}, users[1])]);
  check(
    opened.filter((r) => !r.error).length === 1,
    "two staff opening concurrently create exactly one visit",
  );
  tab = opened.find((r) => !r.error)!.data.id;
  const locker = spawn("docker", [
    "exec",
    "-i",
    "supabase_db_mezza",
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-At",
    "-v",
    "ON_ERROR_STOP=1",
  ]);
  try {
    await new Promise<void>((resolve, reject) => {
      locker.once("error", reject);
      locker.stdout.on("data", (chunk) => {
        if (chunk.toString().includes("LOCK_ACQUIRED")) resolve();
      });
      locker.once("exit", (code) => reject(new Error(`Lock helper exited: ${code}`)));
      locker.stdin.write(
        `begin; select id from public.restaurants where id='${rid}' for update; select 'LOCK_ACQUIRED';\n`,
      );
    });
    let completed = false;
    const waiting = call("snapshot", {}, users[0]).then((r) => {
      completed = true;
      return r;
    });
    await new Promise((resolve) => setTimeout(resolve, 250));
    check(!completed, "workflow waits for a real competing PostgreSQL row lock");
    locker.stdin.end("commit;\n");
    check(!(await waiting).error, "workflow resumes after competing transaction commits");
  } finally {
    if (!locker.stdin.writableEnded) locker.stdin.end("rollback;\n");
  }
  check(!!(await call("snapshot", {}, users[2])).error, "RPC independently rejects nonmember actor");
  const secrets = [hash(), hash()],
    receipts = [hash(), hash()];
  const people: GuestVisit[] = await Promise.all(
    secrets.map((s, i) => ok("join", { name: i ? "Ben" : "Ana", receiptHash: receipts[i] }, undefined, s)),
  );
  const lines = [{ itemId: item, qty: 2, optionIds: [] }];
  const edits = await Promise.all([
    call("draft", { version: 0, lines }, undefined, secrets[0]),
    call("draft", { version: 0, lines: [] }, undefined, secrets[0]),
  ]);
  check(
    edits.filter((r) => !r.error).length === 1 && edits.some((r) => r.error?.message === "stale_cart"),
    "concurrent same-cart edits reject stale version",
  );
  await ok("draft", { version: 1, lines }, undefined, secrets[0]);
  await ok("draft", { version: 0, lines }, undefined, secrets[1]);
  const request = randomUUID(),
    other = randomUUID();
  const submits = await Promise.all([
    call("submit", { id: request, version: 2 }, undefined, secrets[0]),
    call("submit", { id: request, version: 2 }, undefined, secrets[0]),
    call("submit", { id: other, version: 1 }, undefined, secrets[1]),
  ]);
  check(
    submits.every((r) => !r.error),
    "two phones and duplicate submission succeed idempotently",
  );
  let snapshot: VisitState = await ok("snapshot", {}, users[0]);
  check(
    snapshot.requests.length === 2 && snapshot.lines.length === 0,
    "only two review requests and no kitchen charges",
  );
  const race = await Promise.all([
    call("accept", { id: request }, users[0]),
    call("freeze", { revision: snapshot.revision, portions: [] }, users[1]),
  ]);
  check(
    !race[0].error && race[1].error?.message === "pending_requests",
    "accept versus freeze preserves unresolved review request",
  );
  const cancel = await Promise.all([
    call("accept", { id: other }, users[1]),
    call("request_cancel", { id: other }, undefined, secrets[1]),
  ]);
  check(!cancel[1].error, "cancellation races acceptance without losing request");
  snapshot = await ok("snapshot", {}, users[0]);
  const cancelled = snapshot.requests.find((r) => r.id === other)!;
  if (cancelled.status === "cancel_requested")
    await ok("cancel", { id: other, reason: "Race verification" }, users[0]);
  else check(cancelled.status === "cancelled", "cancellation wins before acceptance");
  snapshot = await ok("snapshot", {}, users[0]);
  const portions = people.map((p, i) => ({ participantId: p.participantId, label: i ? "Ben" : "Ana" }));
  const assignments = snapshot.lines.flatMap((l) =>
    Array.from({ length: l.qty }, (_, unit) => ({
      lineId: l.id,
      unit,
      recipients: unit === 0 ? [people[0].participantId] : people.map((p) => p.participantId),
    })),
  );
  let allocation = allocateBill(snapshot.lines, portions, "items", assignments, snapshot.tax);
  await ok(
    "freeze",
    { revision: snapshot.revision, portions: allocation, mode: "items", ackDrafts: true },
    users[0],
  );
  check(true, "quantity allocation and shared-item cents accepted by PostgreSQL");
  await ok("reopen", {}, users[1]);
  snapshot = await ok("snapshot", {}, users[0]);
  allocation = allocateBill(snapshot.lines, portions, "even", [], snapshot.tax);
  await ok(
    "freeze",
    { revision: snapshot.revision, portions: allocation, mode: "even", ackDrafts: true },
    users[1],
  );
  snapshot = await ok("snapshot", {}, users[0]);
  check(
    snapshot.portions.reduce((n, p) => n + p.subtotalCents + p.stateCents + p.municipalCents, 0) === 2232,
    "even split conserves subtotal and both tax components",
  );
  const cash = {
    portionIds: [snapshot.portions[0].id],
    payerId: people[0].participantId,
    key: randomUUID(),
    tipCents: 25,
    tenderCents: 1200,
    receiptHash: hash(),
  };
  check(
    (await call("cash", { ...cash, tenderCents: 1 }, users[0])).error?.message === "insufficient_tender",
    "insufficient tender leaves portion unpaid",
  );
  const paid = await Promise.all([call("cash", cash, users[0]), call("cash", cash, users[1])]);
  check(
    paid.every((r) => !r.error) && paid[0].data.paymentId === paid[1].data.paymentId,
    "concurrent duplicate cash confirmation produces one payment",
  );
  check(!!(await call("close", {}, users[0])).error, "partial settlement refuses closure");
  check(
    (await call("reopen", {}, users[1])).error?.message === "cannot_reopen",
    "partial settlement cannot reopen",
  );
  check(
    (await call("draft", { version: 3, lines }, undefined, secrets[0])).error?.message === "invalid_draft",
    "partial settlement forbids new cart edits",
  );
  await ok("cash", { ...cash, portionIds: [snapshot.portions[1].id], key: randomUUID() }, users[1]);
  await ok("close", {}, users[0]);
  const own = await admin.rpc("visit_private_receipts", { p_hash: receipts[0], p_table: table });
  const covered = await admin.rpc("visit_private_receipts", { p_hash: receipts[1], p_table: table });
  check(
    !own.error && own.data.length === 2 && !covered.error && covered.data.length === 0,
    "payer retains private receipts after closure; beneficiary cannot read them",
  );
  check(
    (await call("snapshot", {}, undefined, secrets[0])).error?.message === "session_expired",
    "closure revokes old phone session",
  );
  const next = await ok("open", {}, users[0]);
  check(next.id !== tab && next.participants.length === 0, "next party starts without prior participants");
  tab = next.id;
  check(
    (await call("snapshot", {}, undefined, secrets[0])).error?.message === "session_expired",
    "old session cannot target next party",
  );
  await ok("close", {}, users[0]);
  const rate = await Promise.all(
    Array.from({ length: 12 }, () =>
      admin.rpc("visit_rate_limit", { p_key: `bill-test:${rid}`, p_max: 3, p_seconds: 60 }),
    ),
  );
  check(
    rate.every((r) => !r.error) && rate.filter((r) => r.data).length === 3,
    "concurrent shared rate limiter admits exactly its limit",
  );
  console.log(`${checks} real Supabase integration checks passed`);
}
main()
  .finally(async () => {
    // Dedicated random fixture only; never reset or truncate a shared database.
    // Ledger FKs intentionally prevent normal cascading deletion. Disable triggers only
    // within this local cleanup transaction, and scope every delete to our random tenant.
    assert.match(rid, /^[a-f0-9-]{36}$/);
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "supabase_db_mezza",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        input: `begin; set local session_replication_role=replica;
      delete from mezza_private.visit_receipts where tab_id in (select id from public.tabs where restaurant_id='${rid}');
      delete from mezza_private.visit_recoveries where tab_id in (select id from public.tabs where restaurant_id='${rid}');
      do $$ declare r record; begin for r in select table_schema,table_name from information_schema.columns where table_schema in ('public','mezza_private') and column_name='restaurant_id' and exists(select 1 from information_schema.tables t where t.table_schema=columns.table_schema and t.table_name=columns.table_name and table_type='BASE TABLE') loop execute format('delete from %I.%I where restaurant_id=%L',r.table_schema,r.table_name,'${rid}'); end loop; end $$;
      delete from public.restaurants where id='${rid}'; commit;`,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    for (const id of users) await admin.auth.admin.deleteUser(id);
  })
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
