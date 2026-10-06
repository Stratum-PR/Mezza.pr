/** Loopback-only browser fixture using the real migrations/RPCs in PGlite.
 * This is not Supabase/PostgREST/Auth. It never connects to an external database.
 */
import { createServer } from "node:http";
import { createHash, createHmac } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
const owner = "20000000-0000-4000-8000-000000000001",
  rid = "20000000-0000-4000-8000-000000000010",
  table = "20000000-0000-4000-8000-000000000020";
const jwt = [
  { alg: "HS256", typ: "JWT" },
  {
    sub: owner,
    aud: "authenticated",
    role: "authenticated",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  },
  "fixture-signature",
]
  .map((x) => Buffer.from(typeof x === "string" ? x : JSON.stringify(x)).toString("base64url"))
  .join(".");
const user = {
  id: owner,
  aud: "authenticated",
  role: "authenticated",
  email: "bill-owner@test.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
};
const qr = createHmac("sha256", "fixture-qr-secret-01234567890123456789").update(table).digest("base64url");
async function main() {
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(readFileSync("scripts/db-check/supabase-stub.sql", "utf8"));
  for (const file of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users(id,email) values($1,$2)", [owner, user.email]);
  await db.query(
    "insert into public.restaurants(id,slug,name,default_menu_style,status) values($1,'bill-browser','Bill browser test','simple','active')",
    [rid],
  );
  await db.query("insert into public.memberships(restaurant_id,user_id,role) values($1,$2,'owner')", [
    rid,
    owner,
  ]);
  await db.query(
    "insert into public.dining_tables(id,restaurant_id,label,qr_token_hash) values($1,$2,'B1',$3)",
    [table, rid, createHash("sha256").update(qr).digest("hex")],
  );
  const section = "20000000-0000-4000-8000-000000000030";
  await db.query(
    "insert into public.menu_sections(id,restaurant_id,name_es,name_en) values($1,$2,'Platos','Dishes')",
    [section, rid],
  );
  await db.query(
    "insert into public.menu_items(id,restaurant_id,section_id,name_es,name_en,price_cents) values('20000000-0000-4000-8000-000000000040',$1,$2,'Plato de prueba','Test dish',1001)",
    [rid, section],
  );
  const functions = new Set([
    "visit_workflow",
    "visit_snapshot",
    "visit_rate_limit",
    "visit_private_receipts",
    "visit_claim_recovery",
    "visit_financial_summary",
    "refresh_sales_summaries",
    "has_role",
    "is_platform_admin",
    "set_order_status",
    "void_order",
    "record_refund",
  ]);
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") {
      res.end();
      return;
    }
    try {
      const url = new URL(req.url!, "http://127.0.0.1");
      let raw = "";
      for await (const chunk of req) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      if (url.pathname === "/fixture/session") {
        res.end(
          JSON.stringify({
            access_token: jwt,
            refresh_token: "fixture-refresh",
            expires_in: 86400,
            expires_at: Math.floor(Date.now() / 1000) + 86400,
            token_type: "bearer",
            user,
          }),
        );
        return;
      }
      if (url.pathname === "/fixture/state") {
        const r = await db.query<{ data: unknown }>(
          "select public.visit_snapshot(id) data from public.tabs where table_id=$1 order by opened_at desc limit 1",
          [table],
        );
        res.end(JSON.stringify(r.rows[0]?.data ?? null));
        return;
      }
      if (url.pathname.startsWith("/auth/v1/user")) {
        res.end(JSON.stringify(user));
        return;
      }
      if (url.pathname.startsWith("/auth/v1/token")) {
        res.end(
          JSON.stringify({
            access_token: jwt,
            refresh_token: "fixture-refresh",
            expires_in: 86400,
            token_type: "bearer",
            user,
          }),
        );
        return;
      }
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const name = url.pathname.split("/").pop()!;
        if (!functions.has(name)) throw new Error("unknown fixture RPC");
        const entries = Object.entries(body);
        if (entries.some(([k]) => !/^p_[a-z_]+$/.test(k))) throw new Error("invalid parameter");
        const r = await db.query<{ result: unknown }>(
          `select public.${name}(${entries.map(([k, v], i) => `${k}=>$${i + 1}${typeof v === "object" ? "::jsonb" : ""}`).join(",")}) result`,
          entries.map(([, v]) => (typeof v === "object" ? JSON.stringify(v) : v)),
        );
        res.end(JSON.stringify(r.rows[0]?.result ?? null));
        return;
      }
      const name = url.pathname.split("/").pop()!;
      if (!/^[a-z_]+$/.test(name) || req.method !== "GET") throw new Error("unsupported fixture operation");
      const values: unknown[] = [],
        where: string[] = [];
      for (const [key, val] of url.searchParams) {
        if (!/^[a-z_]+$/.test(key) || ["select", "order", "limit", "or"].includes(key)) continue;
        const [op, ...rest] = val.split("."),
          value = rest.join(".");
        if (!["eq", "neq", "gt", "is"].includes(op)) continue;
        if (op === "is" && value === "null") where.push(`${key} is null`);
        else {
          values.push(value);
          where.push(`${key} ${op === "eq" ? "=" : op === "neq" ? "<>" : ">"} $${values.length}`);
        }
      }
      const r = await db.query<Record<string, unknown>>(
        `select * from public.${name}${where.length ? " where " + where.join(" and ") : ""}`,
        values,
      );
      const rows = r.rows,
        selection = url.searchParams.get("select") ?? "";
      for (const row of rows) {
        if (name === "dining_tables" && selection.includes("restaurants"))
          row.restaurants = (
            await db.query("select * from public.restaurants where id=$1", [row.restaurant_id])
          ).rows[0];
        if (name === "restaurants" && selection.includes("qr_designs")) row.qr_designs = null;
        if (selection.includes("tabs(") && row.tab_id)
          row.tabs = (await db.query("select table_id from public.tabs where id=$1", [row.tab_id])).rows[0];
        if (name === "orders" && selection.includes("order_items("))
          row.order_items = (
            await db.query("select * from public.order_items where order_id=$1", [row.id])
          ).rows;
      }
      const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");
      if (single && rows.length !== 1) {
        res.statusCode = 406;
        res.end(
          JSON.stringify({
            code: "PGRST116",
            message: "single row expected",
            details: `The result contains ${rows.length} rows`,
          }),
        );
        return;
      }
      res.end(JSON.stringify(single ? rows[0] : rows));
    } catch (e) {
      res.statusCode = 400;
      res.end(
        JSON.stringify({ code: (e as { code?: string }).code ?? "fixture", message: (e as Error).message }),
      );
    }
  });
  server.listen(54329, "127.0.0.1", () =>
    console.log(`Local bill fixture: http://127.0.0.1:54329\nGuest: /r/bill-browser/t/${qr}`),
  );
}
void main();
