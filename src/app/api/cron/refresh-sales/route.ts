import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db/admin";
import { refreshRecentSales } from "@/lib/reports/refresh";
import { serverEnv } from "@/lib/server-env";

function authorized(request: NextRequest) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${serverEnv.CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Scheduled safety net (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`). Payments already
 * refresh the summaries as they happen; this catches anything missed, e.g. a failed refresh.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data: restaurants, error } = await createAdminClient()
    .from("restaurants")
    .select("id")
    .in("status", ["trial", "active"]);
  if (error) return NextResponse.json({ error: "failed" }, { status: 500 });

  const failed: string[] = [];
  for (const r of restaurants ?? []) {
    try {
      await refreshRecentSales(r.id);
    } catch {
      failed.push(r.id);
    }
  }
  return NextResponse.json(
    { refreshed: (restaurants ?? []).length - failed.length, failed },
    { status: failed.length ? 207 : 200 },
  );
}
