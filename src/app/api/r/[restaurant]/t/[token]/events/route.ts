import { splitWorkflowEnabled } from "@/lib/bills/feature";
import { NextResponse, type NextRequest } from "next/server";
import type { MezzaEvent } from "@/connectors/realtime";
import { createAdminClient } from "@/lib/db/admin";
import { resolveTable } from "@/lib/guest/resolve";

/**
 * Polling endpoint for a guest's phone: changes since `since` to the table's live tab (orders,
 * service requests, payments). The token is resolved on every call; nothing outside the tab leaks.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/r/[restaurant]/t/[token]/events">,
) {
  if (splitWorkflowEnabled())
    return NextResponse.json(
      { error: "use_visit_session" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  const { restaurant, token } = await params;
  const g = await resolveTable(restaurant, token);
  if (!g) return NextResponse.json({ error: "invalid_table" }, { status: 404 });
  const since = request.nextUrl.searchParams.get("since") ?? new Date(Date.now() - 60_000).toISOString();
  if (Number.isNaN(Date.parse(since))) return NextResponse.json({ error: "since" }, { status: 400 });
  const tabId = request.nextUrl.searchParams.get("tab");

  const db = createAdminClient();
  const tabQuery = db.from("tabs").select("*").eq("table_id", g.table.id);
  const { data: tab } = tabId
    ? await tabQuery.eq("id", tabId).maybeSingle()
    : await tabQuery.neq("status", "closed").maybeSingle();
  if (tab && "staff_managed" in tab && tab.staff_managed === true)
    return NextResponse.json(
      { error: "use_visit_session" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  if (!tab) return NextResponse.json([], { headers: { "Cache-Control": "no-store" } });

  const [orders, requests, pays] = await Promise.all([
    db.from("orders").select("id, created_at, updated_at").eq("tab_id", tab.id).gt("updated_at", since),
    db
      .from("service_requests")
      .select("id, created_at, updated_at")
      .eq("tab_id", tab.id)
      .gt("updated_at", since),
    db.from("payments").select("id, updated_at").eq("tab_id", tab.id).gt("updated_at", since),
  ]);
  const events: MezzaEvent[] = [
    ...(orders.data ?? []).map((o) => ({
      type: (Date.parse(o.created_at) > Date.parse(since)
        ? "order.created"
        : "order.updated") as MezzaEvent["type"],
      restaurantId: g.restaurant.id,
      entityId: o.id,
      at: o.updated_at,
    })),
    ...(requests.data ?? []).map((r) => ({
      type: (Date.parse(r.created_at) > Date.parse(since)
        ? "service_request.created"
        : "service_request.updated") as MezzaEvent["type"],
      restaurantId: g.restaurant.id,
      entityId: r.id,
      at: r.updated_at,
    })),
    ...(pays.data ?? []).map((p) => ({
      type: "payment.updated" as const,
      restaurantId: g.restaurant.id,
      entityId: p.id,
      at: p.updated_at,
    })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return NextResponse.json(events, { headers: { "Cache-Control": "no-store" } });
}
