import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import { trialDaysLeft } from "@/lib/trial";

interface AdminRestaurant {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  onboardingStep: number;
  trialDays: number | null;
  volume30Cents: number;
  lastOrderAt: string | null;
  flags: { noOrders3d: boolean; failedPayments: number; failedPrints: number; staleDevices: number };
}

export interface AdminGrant {
  id: string;
  restaurant: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  approvedAt: string | null;
  expired: boolean;
}

/**
 * Everything the Stratum admin shows, read with the service role after requirePlatformAdmin().
 * Health flags: no orders in 3 days (once set up), failed payments (7 days), failed prints (24 h),
 * and staff devices not seen in 24 hours.
 */
export async function loadAdmin(now = new Date()) {
  const db = createAdminClient();
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const DAY = 86_400_000;
  const { data: restaurants } = await db
    .from("restaurants")
    .select("id, name, slug, status, plan, onboarding_step, trial_ends_at")
    .order("created_at");

  const rows: AdminRestaurant[] = await Promise.all(
    (restaurants ?? []).map(async (r) => {
      const since30 = ago(30 * DAY).slice(0, 10);
      const [sales, last, failedPay, failedPrint, devices] = await Promise.all([
        db.from("daily_sales").select("sales_cents").eq("restaurant_id", r.id).gte("date", since30),
        db
          .from("orders")
          .select("created_at")
          .eq("restaurant_id", r.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        db
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", r.id)
          .eq("status", "failed")
          .gte("created_at", ago(7 * DAY)),
        db
          .from("print_jobs")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", r.id)
          .eq("status", "failed")
          .gte("created_at", ago(DAY)),
        db
          .from("devices")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", r.id)
          .or(`last_seen_at.is.null,last_seen_at.lt.${ago(DAY)}`),
      ]);
      const lastOrderAt = last.data?.created_at ?? null;
      const setUp = r.onboarding_step >= 7;
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        status: r.status,
        plan: r.plan,
        onboardingStep: r.onboarding_step,
        trialDays: r.status === "trial" ? trialDaysLeft(r.trial_ends_at, now.getTime()) : null,
        volume30Cents: (sales.data ?? []).reduce((n, s) => n + s.sales_cents, 0),
        lastOrderAt,
        flags: {
          noOrders3d: setUp && (!lastOrderAt || Date.parse(lastOrderAt) < now.getTime() - 3 * DAY),
          failedPayments: failedPay.count ?? 0,
          failedPrints: failedPrint.count ?? 0,
          staleDevices: devices.count ?? 0,
        },
      };
    }),
  );

  const { data: grants } = await db
    .from("support_access_grants")
    .select("id, reason, created_at, expires_at, approved_at, restaurants(name)")
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    restaurants: rows,
    grants: (grants ?? []).map((g): AdminGrant => ({
      id: g.id,
      restaurant: g.restaurants?.name ?? "",
      reason: g.reason,
      createdAt: g.created_at,
      expiresAt: g.expires_at,
      approvedAt: g.approved_at,
      expired: Date.parse(g.expires_at) <= now.getTime(),
    })),
  };
}
