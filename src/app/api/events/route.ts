import { NextResponse, type NextRequest } from "next/server";
import type { MezzaEvent } from "@/connectors/realtime";
import { createClient } from "@/lib/db/server";

/**
 * Staff polling endpoint: changes since `since`, derived from updated_at on orders, service requests,
 * payments and menu items. Row-level security scopes everything to the caller's restaurant, and the
 * kitchen never receives payment events. `device` updates that device's last_seen_at on each poll.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const slug = q.get("restaurant") ?? "";
  const since = q.get("since") ?? new Date(Date.now() - 60_000).toISOString();
  if (Number.isNaN(Date.parse(since))) return NextResponse.json({ error: "since" }, { status: 400 });

  const db = await createClient();
  const { data: claims } = await db.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: restaurant } = await db.from("restaurants").select("id").eq("slug", slug).maybeSingle();
  if (!restaurant) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { data: member } = await db
    .from("memberships")
    .select("role, active")
    .eq("restaurant_id", restaurant.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member?.active) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const device = q.get("device");
  if (device && /^[0-9a-f-]{36}$/.test(device)) {
    await db
      .from("devices")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", device)
      .eq("restaurant_id", restaurant.id);
  }

  const rid = restaurant.id;
  const [orders, requests, items, pays] = await Promise.all([
    db.from("orders").select("id, created_at, updated_at").eq("restaurant_id", rid).gt("updated_at", since),
    db
      .from("service_requests")
      .select("id, created_at, updated_at")
      .eq("restaurant_id", rid)
      .gt("updated_at", since),
    db.from("menu_items").select("id, updated_at").eq("restaurant_id", rid).gt("updated_at", since),
    member.role === "kitchen"
      ? Promise.resolve({ data: [] as { id: string; updated_at: string }[] })
      : db.from("payments").select("id, updated_at").eq("restaurant_id", rid).gt("updated_at", since),
  ]);
  const created = (iso: string) => Date.parse(iso) > Date.parse(since);
  const events: MezzaEvent[] = [
    ...(orders.data ?? []).map((o) => ({
      type: (created(o.created_at) ? "order.created" : "order.updated") as MezzaEvent["type"],
      restaurantId: rid,
      entityId: o.id,
      at: o.updated_at,
    })),
    ...(requests.data ?? []).map((r) => ({
      type: (created(r.created_at)
        ? "service_request.created"
        : "service_request.updated") as MezzaEvent["type"],
      restaurantId: rid,
      entityId: r.id,
      at: r.updated_at,
    })),
    ...(items.data ?? []).map((i) => ({
      type: "item.availability" as const,
      restaurantId: rid,
      entityId: i.id,
      at: i.updated_at,
    })),
    ...(pays.data ?? []).map((p) => ({
      type: "payment.updated" as const,
      restaurantId: rid,
      entityId: p.id,
      at: p.updated_at,
    })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return NextResponse.json(events, { headers: { "Cache-Control": "no-store" } });
}
