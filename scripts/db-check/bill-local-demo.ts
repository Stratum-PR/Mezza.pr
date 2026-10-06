/** Create a disposable restaurant for real local browser and phone testing. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const output = ".bill-local-demo.json";
assert(
  !existsSync(output) || process.argv.includes("--fresh"),
  "Existing local demo found; reuse it or pass --fresh to create a new disposable restaurant",
);
const status = JSON.parse(
  execFileSync(process.execPath, ["node_modules/supabase/dist/supabase.js", "status", "-o", "json"], {
    encoding: "utf8",
  }),
);
const url = new URL(status.API_URL);
assert(["localhost", "127.0.0.1"].includes(url.hostname), "Local Supabase only");
const db = createClient(url.href, status.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const rid = randomUUID(),
  table = randomUUID(),
  section = randomUUID(),
  item = randomUUID();
const secret = "bill-local-qr-secret-01234567890123456789";
const token = createHmac("sha256", secret).update(`${table}:1`).digest("base64url");
const users: { id: string; email: string; password: string }[] = [];
async function insert(name: string, value: object) {
  const result = await db.from(name).insert(value);
  assert.ifError(result.error);
}
async function main() {
  for (let i = 0; i < 2; i++) {
    const email = `bill-local-${randomUUID()}@test.invalid`,
      password = randomBytes(24).toString("base64url");
    const created = await db.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(created.error);
    users.push({ id: created.data.user!.id, email, password });
  }
  await insert("restaurants", {
    id: rid,
    slug: `bill-local-${rid.slice(0, 8)}`,
    name: "Bill Local Test",
    default_menu_style: "simple",
    status: "active",
  });
  await insert(
    "memberships",
    users.map((u, i) => ({ restaurant_id: rid, user_id: u.id, role: i ? "server" : "owner" })),
  );
  await insert("dining_tables", {
    id: table,
    restaurant_id: rid,
    label: "Test 1",
    qr_token_hash: createHash("sha256").update(token).digest("hex"),
  });
  await insert("menu_sections", { id: section, restaurant_id: rid, name_es: "Pruebas", name_en: "Tests" });
  await insert("menu_items", {
    id: item,
    restaurant_id: rid,
    section_id: section,
    name_es: "Plato local",
    name_en: "Local dish",
    price_cents: 1001,
  });
  const fixture = { restaurantId: rid, tableId: table, slug: `bill-local-${rid.slice(0, 8)}`, token, users };
  writeFileSync(output, JSON.stringify(fixture, null, 2));
  console.log("Local test restaurant ready. Details are in the ignored .bill-local-demo.json file.");
  console.log(`Guest path: /r/${fixture.slug}/t/${token}`);
  console.log(`Staff path: /app/${fixture.slug}/servicio`);
}
main().catch(async (e) => {
  console.error(e.message);
  for (const u of users) await db.auth.admin.deleteUser(u.id);
  process.exitCode = 1;
});
