/**
 * pnpm seed — run after `supabase db reset` (which applies supabase/seed.sql).
 * Adds the logins, Café Lucía's 12 tables with QR tokens, the printed menu page and dish photos,
 * Barra Test's tables and orders, 90 days of Café Lucía history, and refreshes the summaries.
 *
 * Local by default: refuses any non-local Supabase URL. `pnpm seed:cloud` (the --cloud flag) seeds
 * the hosted demo project instead: it reads `.env.cloud`, requires MEZZA_SEED_CLOUD_REF to match the
 * project in the URL, gives every login a random password (printed once, stored nowhere), skips
 * Barra Test's logins and orders, and keeps the history light (about 15% of the local volume).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CAFE_LUCIA_MENU, CAFE_LUCIA_PRINTED } from "../../src/components/menu/fixtures/cafe-lucia";
import { illustrationSvg } from "../../src/components/menu/illustrations";
import { deriveQrToken, hashQrToken, tableUrl } from "../../src/lib/qr/token";
import { generateHistory, type HistoryItem } from "./history";

export const SEED_PASSWORD = "mezza-local-2026";
const CAFE = "c0ffee00-0000-4000-8000-000000000001";
const BARRA = "ba220000-0000-4000-8000-000000000002";
const root = join(__dirname, "..", "..");

const CLOUD = process.argv.includes("--cloud");
const envFile = join(root, CLOUD ? ".env.cloud" : ".env.local");
const loadEnvFile = (process as NodeJS.Process & { loadEnvFile?: (path: string) => void }).loadEnvFile;
if (existsSync(envFile)) loadEnvFile?.(envFile);
else if (CLOUD) throw new Error(".env.cloud not found (see README: Hosted demo data)");

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see .env.example and README)`);
  return value;
}

const url = env("NEXT_PUBLIC_SUPABASE_URL");
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
if (!CLOUD && !isLocal) {
  throw new Error(`Refusing to seed ${url}: the seed is for the local Supabase stack only`);
}
if (CLOUD) {
  const ref = env("MEZZA_SEED_CLOUD_REF");
  if (isLocal || !url.includes(`://${ref}.`)) {
    throw new Error(`Refusing to seed ${url}: MEZZA_SEED_CLOUD_REF (${ref}) must match the hosted project`);
  }
}
/** Cloud logins get their own random password; local ones share the documented local password. */
const passwords = new Map<string, string>();
function passwordFor(email: string): string {
  if (!CLOUD) return SEED_PASSWORD;
  const p = passwords.get(email) ?? randomBytes(12).toString("base64url");
  passwords.set(email, p);
  return p;
}
const db: SupabaseClient = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const qrSecret = env("QR_TOKEN_SECRET");
const guestBase = process.env.NEXT_PUBLIC_GUEST_BASE_URL ?? "http://localhost:3000";

function check<R extends { data: unknown; error: { message: string } | null }>(
  label: string,
  result: R,
): NonNullable<R["data"]> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as NonNullable<R["data"]>;
}

async function insertBatched(table: string, rows: Record<string, unknown>[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    check(`insert ${table}`, await db.from(table).insert(rows.slice(i, i + size)));
  }
}

async function ensureUser(email: string, fullName: string): Promise<string> {
  const created = await db.auth.admin.createUser({
    email,
    password: passwordFor(email),
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

function png(svg: string, width: number): Buffer {
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: width }, font: { loadSystemFonts: true } })
      .render()
      .asPng(),
  );
}

async function upload(bucket: string, path: string, body: Buffer) {
  check(
    `upload ${bucket}/${path}`,
    await db.storage.from(bucket).upload(path, body, { contentType: "image/png", upsert: true }),
  );
}

async function tables(restaurantId: string, prefix: string, count: number) {
  const rows = Array.from({ length: count }, (_, i) => {
    const id = `${prefix}-0005-4000-8000-0000000000${String(i + 1).padStart(2, "0")}`;
    return {
      id,
      restaurant_id: restaurantId,
      label: String(i + 1),
      seats: i % 3 === 0 ? 2 : 4,
      area: i < 8 ? "Salón" : "Terraza",
      qr_token_hash: hashQrToken(deriveQrToken(qrSecret, id, 1)),
      token_version: 1,
      sort_order: i,
    };
  });
  check("tables", await db.from("dining_tables").upsert(rows, { onConflict: "restaurant_id,label" }));
  return rows.map((r) => r.id);
}

async function main() {
  console.log("Logins");
  const owner = await ensureUser("dueno@cafelucia.example", "Lucía Rivera");
  const manager = await ensureUser("gerente@cafelucia.example", "Marta Ortiz");
  const server = await ensureUser("mesero@cafelucia.example", "José Colón");
  const kitchen = await ensureUser("cocina@cafelucia.example", "Ana Torres");
  const barraOwner = CLOUD ? null : await ensureUser("dueno@barratest.example", "Carlos Méndez");
  const admin = await ensureUser("admin@stratum.example", "Stratum Soporte");
  check(
    "memberships",
    await db
      .from("memberships")
      .upsert(
        [
          { restaurant_id: CAFE, user_id: owner, role: "owner" },
          { restaurant_id: CAFE, user_id: manager, role: "manager" },
          { restaurant_id: CAFE, user_id: server, role: "server" },
          { restaurant_id: CAFE, user_id: kitchen, role: "kitchen" },
          ...(barraOwner ? [{ restaurant_id: BARRA, user_id: barraOwner, role: "owner" as const }] : []),
        ],
        { onConflict: "user_id,restaurant_id" },
      ),
  );
  check("platform admin", await db.from("platform_admins").upsert({ user_id: admin }));

  console.log("Tables and QR tokens");
  const cafeTables = await tables(CAFE, "c0ffee00", 12);
  const barraTables = CLOUD ? [] : await tables(BARRA, "ba220000", 4);

  console.log("Printed menu and photos");
  const assets = join(root, "supabase", "seed", "assets");
  mkdirSync(assets, { recursive: true });
  writeFileSync(join(assets, "cafe-lucia-original.svg"), CAFE_LUCIA_PRINTED.svg);
  const pagePath = `${CAFE}/original/page-1.png`;
  await upload("menus", pagePath, png(CAFE_LUCIA_PRINTED.svg, CAFE_LUCIA_PRINTED.width * 2));
  check("old pages", await db.from("original_menu_pages").delete().eq("restaurant_id", CAFE));
  const page = check(
    "page",
    await db
      .from("original_menu_pages")
      .insert({
        restaurant_id: CAFE,
        image_path: pagePath,
        width: CAFE_LUCIA_PRINTED.width * 2,
        height: CAFE_LUCIA_PRINTED.height * 2,
        page_number: 1,
      })
      .select("id")
      .single(),
  );
  check(
    "hotspots",
    await db.from("item_hotspots").insert(
      CAFE_LUCIA_PRINTED.hotspots.map((h) => ({
        restaurant_id: CAFE,
        item_id: h.itemId,
        page_id: page.id,
        x: h.x,
        y: h.y,
        width: h.width,
        height: h.height,
      })),
    ),
  );
  for (const item of CAFE_LUCIA_MENU.items) {
    if (item.photo?.kind !== "illustration") continue;
    const path = `${CAFE}/items/${item.id}.png`;
    await upload("photos", path, png(illustrationSvg(item.photo.key), 400));
    check("photo path", await db.from("menu_items").update({ photo_path: path }).eq("id", item.id));
  }

  const { count } = await db
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("restaurant_id", CAFE);
  if ((count ?? 0) > 0) {
    console.log("History already present; skipping (run `supabase db reset` first for a fresh seed)");
  } else {
    console.log("90 days of Café Lucía history");
    const sectionKey = new Map(
      CAFE_LUCIA_MENU.sections.map((s, i) => [
        s.id,
        (["cafe", "desayuno", "sand", "dulce", "beb"] as const)[i]!,
      ]),
    );
    const items: HistoryItem[] = CAFE_LUCIA_MENU.items
      .filter((i) => i.isAvailable)
      .map((i) => ({
        id: i.id,
        nameEs: i.nameEs,
        nameEn: i.nameEn,
        priceCents: i.priceCents,
        section: sectionKey.get(i.sectionId)!,
        groups: i.modifierGroups.map((g) => ({
          id: g.id,
          min: g.min,
          max: g.max,
          options: g.options.map((o) => ({ ...o, groupEs: g.nameEs, groupEn: g.nameEn })),
        })),
      }));
    const history = generateHistory({
      restaurantId: CAFE,
      tableIds: cafeTables,
      items,
      rates: { stateBps: 1050, municipalBps: 100 },
      staffUserIds: { manager, server },
      days: 90,
      now: new Date(),
      utcOffsetHours: -4,
      seed: 1962,
      firstOrderNumber: 1001,
      volume: CLOUD ? 0.15 : 1,
    });
    await insertBatched("tabs", history.tabs);
    await insertBatched("orders", history.orders);
    await insertBatched("order_items", history.orderItems);
    await insertBatched("payments", history.payments);
    await insertBatched("refunds", history.refunds);
    await insertBatched(
      "item_availability_events",
      history.availability.filter((a) => a.back_at !== null),
    );
    await insertBatched("audit_log", history.audit);
    check(
      "order numbers",
      await db.from("restaurants").update({ next_order_number: history.nextOrderNumber }).eq("id", CAFE),
    );
    console.log(
      `  ${history.tabs.length} tabs, ${history.orders.length} orders, ${history.payments.length} payments`,
    );

    if (barraOwner) console.log("Barra Test orders");
    const barraItems = ["ba220000-0002-4000-8000-000000000001", "ba220000-0002-4000-8000-000000000003"];
    for (let i = 0; barraOwner && i < 4; i++) {
      const result = check(
        "barra order",
        await db.rpc("place_order", {
          p_restaurant_id: BARRA,
          p_table_id: barraTables[i % barraTables.length],
          p_client_order_id: `seed-barra-${i + 1}-000000`,
          p_source: "staff",
          p_lines: [{ itemId: barraItems[i % 2], qty: 1 + (i % 3), modifierOptionIds: [] }],
          p_guest_language: "es",
          p_created_by: barraOwner,
        }),
      ) as { status: string };
      if (result.status !== "accepted") throw new Error(`Barra order rejected: ${JSON.stringify(result)}`);
    }
  }

  console.log("Sales summaries");
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 92 * 86_400_000).toISOString().slice(0, 10);
  for (const id of [CAFE, BARRA]) {
    check(
      "refresh",
      await db.rpc("refresh_sales_summaries", { p_restaurant_id: id, p_from: from, p_to: today }),
    );
  }

  if (CLOUD) {
    console.log("\nDone. Save these now: they are shown once and stored nowhere.");
    for (const [email, password] of passwords) console.log(`  ${email}  ${password}`);
  } else {
    console.log(`\nDone. Every login uses the local password: ${SEED_PASSWORD}`);
    console.log(
      "  dueno@cafelucia.example (owner) · gerente@ (manager) · mesero@ (server) · cocina@ (kitchen)",
    );
    console.log("  dueno@barratest.example (Barra Test owner) · admin@stratum.example (Stratum admin)");
  }
  console.log(`  Mesa 4: ${tableUrl(guestBase, "cafe-lucia", deriveQrToken(qrSecret, cafeTables[3]!, 1))}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
