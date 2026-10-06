/**
 * pnpm seed:e2e [workers] — copies of Café Lucía for parallel end-to-end tests (local stack only).
 *
 * Worker 0 uses Café Lucía itself; workers 1..n-1 each get `cafe-lucia-w{k}` ("Café Lucía (w{k})"): the same menu, tables
 * (own QR tokens), printed page, photos, four logins (`dueno.w{k}@cafelucia.example`, …) and the same
 * 90 days of history, so tests never share settings, tables, sales totals or rate limits. Ids are
 * Café Lucía's with the `c0ffee00-` prefix swapped for `c0ffee0{k}-`, so every relationship holds.
 * Idempotent: a copy that already exists is left alone. Run `pnpm seed` first.
 */
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CAFE_LUCIA_MENU } from "../../src/components/menu/fixtures/cafe-lucia";
import { deriveQrToken, hashQrToken } from "../../src/lib/qr/token";
import { generateHistory, type HistoryItem } from "./history";
import { SEED_PASSWORD } from "./password";

const CAFE = "c0ffee00-0000-4000-8000-000000000001";
const root = join(__dirname, "..", "..");
const loadEnvFile = (process as NodeJS.Process & { loadEnvFile?: (path: string) => void }).loadEnvFile;
if (existsSync(join(root, ".env.local"))) loadEnvFile?.(join(root, ".env.local"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url)) {
  throw new Error(`Refusing to seed ${url}: E2E worker copies are for the local Supabase stack only`);
}
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const qrSecret = process.env.QR_TOKEN_SECRET!;
const workers = Number(process.argv[2] ?? process.env.E2E_WORKERS ?? 3);
if (!Number.isInteger(workers) || workers < 1 || workers > 10) throw new Error("workers must be 1–10");

function check<R extends { data: unknown; error: { message: string } | null }>(
  label: string,
  result: R,
): NonNullable<R["data"]> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as NonNullable<R["data"]>;
}

/** Restaurant-scoped rows copied as they are now, in foreign-key order. */
const TABLES = [
  "restaurants",
  "menu_themes",
  "menu_sections",
  "modifier_groups",
  "modifier_options",
  "menu_items",
  "item_modifier_groups",
  "item_availability_events",
  "original_menu_pages",
  "item_hotspots",
  "dining_tables",
  "qr_designs",
  "printers",
  "payment_accounts",
  "subscriptions",
] as const;

async function ensureUser(email: string, fullName: string): Promise<string> {
  const created = await db.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  let id = created.data.user?.id;
  if (!id) {
    const list = check("list users", await db.auth.admin.listUsers({ perPage: 1000 }));
    id = list.users.find((u) => u.email === email)?.id;
    if (!id) throw new Error(`could not create ${email}: ${created.error?.message}`);
  }
  check(
    "profile",
    await db.from("profiles").upsert({ user_id: id, full_name: fullName, preferred_language: "es" }),
  );
  return id;
}

async function copyObject(bucket: string, from: string, to: string) {
  const file = await db.storage.from(bucket).download(from);
  if (file.error || !file.data) return; // a missing picture only costs the copy its photo
  check(
    `upload ${bucket}/${to}`,
    await db.storage
      .from(bucket)
      .upload(to, file.data, { contentType: file.data.type || "image/png", upsert: true }),
  );
}

async function copyRestaurant(k: number) {
  const prefix = `c0ffee0${k}`;
  const swap = (v: string) => `${prefix}${v.slice("c0ffee00".length)}`;
  const rid = swap(CAFE);
  const { data: existing } = await db.from("restaurants").select("id").eq("id", rid).maybeSingle();
  if (existing) {
    console.log(`cafe-lucia-w${k}: already there`);
    return;
  }
  console.log(`cafe-lucia-w${k}: copying Café Lucía`);

  // New ids: Café Lucía's prefixed ids get the worker prefix; generated ids get fresh ones.
  const ids = new Map<string, string>();
  const remap = (v: unknown): unknown => {
    if (typeof v !== "string") return v;
    if (ids.has(v)) return ids.get(v);
    if (v.startsWith("c0ffee00-")) return swap(v); // ids, and storage paths that start with the restaurant id
    return v;
  };
  const paths: { bucket: string; from: string; to: string }[] = [];

  for (const table of TABLES) {
    const rows = check(
      `read ${table}`,
      await db
        .from(table)
        .select("*")
        .eq(table === "restaurants" ? "id" : "restaurant_id", CAFE),
    ) as Record<string, unknown>[];
    const picked = table === "item_availability_events" ? rows.filter((r) => r.back_at === null) : rows;
    if (!picked.length) continue;
    for (const r of picked)
      if (typeof r.id === "string") ids.set(r.id, r.id.startsWith("c0ffee00-") ? swap(r.id) : randomUUID());
    const copies = picked.map((r) => {
      const c = Object.fromEntries(Object.entries(r).map(([key, v]) => [key, remap(v)]));
      for (const key of ["photo_path", "image_path", "cover_path", "logo_path"])
        if (typeof r[key] === "string" && r[key] !== c[key])
          paths.push({
            bucket: key === "image_path" ? "menus" : "photos",
            from: r[key] as string,
            to: c[key] as string,
          });
      if (table === "restaurants") Object.assign(c, { slug: `cafe-lucia-w${k}`, name: `Café Lucía (w${k})` });
      if (table === "dining_tables")
        Object.assign(c, {
          qr_token_hash: hashQrToken(deriveQrToken(qrSecret, c.id as string, 1)),
          token_version: 1,
        });
      return c;
    });
    check(`copy ${table}`, await db.from(table).insert(copies));
  }
  for (const p of paths) await copyObject(p.bucket, p.from, p.to);

  const people = [
    ["dueno", "Lucía Rivera", "owner"],
    ["gerente", "Marta Ortiz", "manager"],
    ["mesero", "José Colón", "server"],
    ["cocina", "Ana Torres", "kitchen"],
  ] as const;
  const users: Record<string, string> = {};
  for (const [handle, name, role] of people) {
    users[role] = await ensureUser(`${handle}.w${k}@cafelucia.example`, name);
    check(
      "membership",
      await db
        .from("memberships")
        .upsert({ restaurant_id: rid, user_id: users[role], role }, { onConflict: "user_id,restaurant_id" }),
    );
  }

  // The same 90 days of history Café Lucía has, so reports and Inicio read the same numbers.
  const tableIds = Array.from(
    { length: 12 },
    (_, i) => `${prefix}-0005-4000-8000-0000000000${String(i + 1).padStart(2, "0")}`,
  );
  const sectionKey = new Map(
    CAFE_LUCIA_MENU.sections.map((s, i) => [
      s.id,
      (["cafe", "desayuno", "sand", "dulce", "beb"] as const)[i]!,
    ]),
  );
  const items: HistoryItem[] = CAFE_LUCIA_MENU.items
    .filter((i) => i.isAvailable)
    .map((i) => ({
      id: swap(i.id),
      nameEs: i.nameEs,
      nameEn: i.nameEn,
      priceCents: i.priceCents,
      section: sectionKey.get(i.sectionId)!,
      groups: i.modifierGroups.map((g) => ({
        id: swap(g.id),
        min: g.min,
        max: g.max,
        options: g.options.map((o) => ({ ...o, id: swap(o.id), groupEs: g.nameEs, groupEn: g.nameEn })),
      })),
    }));
  const history = generateHistory({
    restaurantId: rid,
    tableIds,
    items,
    rates: { stateBps: 1050, municipalBps: 100 },
    staffUserIds: { manager: users.manager!, server: users.server! },
    days: 90,
    now: new Date(),
    utcOffsetHours: -4,
    seed: 1962,
    firstOrderNumber: 1001,
    volume: 1,
  });
  for (const [table, rows] of [
    ["tabs", history.tabs],
    ["orders", history.orders],
    ["order_items", history.orderItems],
    ["payments", history.payments],
    ["refunds", history.refunds],
    ["item_availability_events", history.availability.filter((a) => a.back_at !== null)],
    ["audit_log", history.audit],
  ] as const) {
    for (let i = 0; i < rows.length; i += 500)
      check(`insert ${table}`, await db.from(table).insert(rows.slice(i, i + 500)));
  }
  check(
    "order numbers",
    await db.from("restaurants").update({ next_order_number: history.nextOrderNumber }).eq("id", rid),
  );
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 92 * 86_400_000).toISOString().slice(0, 10);
  check(
    "refresh",
    await db.rpc("refresh_sales_summaries", { p_restaurant_id: rid, p_from: from, p_to: today }),
  );
  console.log(`  ${history.orders.length} orders of history; logins dueno.w${k}@cafelucia.example …`);
}

async function main() {
  for (let k = 1; k < workers; k++) await copyRestaurant(k);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
