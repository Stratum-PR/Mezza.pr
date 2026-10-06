import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { SECTION_PATH, canSee, type AppSection, type Role } from "@/lib/auth/staff";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/db/server";
import { AppFrame, type QuickItem } from "./app-frame";
import type { AppNavGroup } from "./app-nav";

const GROUPS: { key: string; sections: AppSection[] }[] = [
  { key: "ops", sections: ["home", "service", "tables", "kitchen"] },
  { key: "menu", sections: ["menu", "qr"] },
  { key: "business", sections: ["reports", "export"] },
  { key: "admin", sections: ["team", "settings", "plan"] },
];

/** The screens each role reaches most, for the phone bottom bar ("orden" = Tomar orden). */
const QUICK: Record<Role, (AppSection | "orden")[]> = {
  owner: ["home", "service", "tables", "reports"],
  manager: ["home", "service", "tables", "reports"],
  server: ["service", "orden", "tables"],
  kitchen: ["kitchen"],
};

/** Things waiting on Servicio: open requests and cash to collect. */
async function serviceAlerts(restaurantId: string): Promise<number> {
  const db = await createClient();
  const [requests, cash] = await Promise.all([
    db
      .from("service_requests")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("status", "open"),
    db
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", restaurantId)
      .eq("method", "cash")
      .eq("status", "pending"),
  ]);
  return (requests.count ?? 0) + (cash.count ?? 0);
}

/** App chrome: sidebar (desktop), icon rail (tablet), drawer + bottom bar (phone). See AppFrame. */
export async function AppShell({
  restaurantSlug,
  restaurantId,
  restaurantName,
  role,
  children,
}: {
  restaurantSlug: string;
  restaurantId: string;
  restaurantName: string;
  role: Role;
  children: ReactNode;
}) {
  const t = await getTranslations();
  const base = `/app/${restaurantSlug}`;
  const href = (s: AppSection) => (SECTION_PATH[s] ? `${base}/${SECTION_PATH[s]}` : base);
  const alerts = canSee(role, "service") ? await serviceAlerts(restaurantId) : 0;
  const badge = (s: AppSection) =>
    s === "service" && alerts ? { badge: alerts, badgeLabel: t("app.nav.alerts", { n: alerts }) } : {};

  const groups: AppNavGroup[] = GROUPS.map((g) => ({
    key: g.key,
    label: t(`app.nav.groups.${g.key}`),
    items: g.sections
      .filter((s) => canSee(role, s))
      .flatMap((s) => {
        const item = { href: href(s), key: s, label: t(`app.nav.${s}`), ...badge(s) };
        // Tomar orden sits right under Servicio for everyone who takes orders.
        return s === "service"
          ? [item, { href: `${base}/servicio/orden`, key: "orden" as const, label: t("app.nav.orden") }]
          : [item];
      }),
  })).filter((g) => g.items.length > 0);

  const quick: QuickItem[] = QUICK[role]
    .filter((s) => s === "orden" || canSee(role, s))
    .map((s) =>
      s === "orden"
        ? { key: "orden" as const, href: `${base}/servicio/orden`, label: t("app.nav.orden") }
        : { key: s, href: href(s), label: t(`app.nav.${s}`), ...badge(s) },
    );

  return (
    <AppFrame
      groups={groups}
      quick={quick}
      exactHref={base}
      restaurantName={restaurantName}
      homeHref={groups[0]?.items[0]?.href ?? base}
      signOutAction={signOut}
      labels={{
        nav: t("app.nav.label"),
        quick: t("app.nav.quick"),
        open: t("app.nav.open"),
        close: t("app.nav.close"),
        more: t("app.nav.more"),
        signOut: t("auth.signOut"),
      }}
    >
      {children}
    </AppFrame>
  );
}
