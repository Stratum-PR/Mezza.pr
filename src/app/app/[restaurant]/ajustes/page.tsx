import { getLocale, getTranslations } from "next-intl/server";
import { payments } from "@/connectors/payments";
import {
  BrandForm,
  IvuForm,
  LimitsForm,
  PrintersPanel,
  ProfileForm,
  SupportPanel,
  type GrantRow,
  type PrinterRow,
} from "@/components/settings/settings-forms";
import { FloorEditor } from "@/components/settings/floor-editor";
import { PreferencesPanel } from "@/components/settings/preferences-panel";
import { readThemeChoice } from "@/components/shell/document";
import { Panel, Pill } from "@/components/ui/surface";
import { flags } from "@/config/flags";
import { requireSection } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";

/** Ajustes: profile, IVU, fiscal mode, payments, printers, Marca and support access. */
export default async function SettingsPage({ params }: PageProps<"/app/[restaurant]/ajustes">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "settings");
  const r = ctx.restaurant;
  const isOwner = ctx.role === "owner";
  const t = await getTranslations("settings");
  const db = await createClient();
  const paymentCtx = { restaurantId: r.id, actorUserId: ctx.userId, locale: "es" as const };

  const [{ data: printers }, { data: design }, grants, card, ath, { data: floorTables }] = await Promise.all([
    db
      .from("printers")
      .select("id, name, model, ip_address, protocol, role, width_chars, active")
      .eq("restaurant_id", r.id)
      .order("created_at"),
    db.from("qr_designs").select("logo_path").eq("restaurant_id", r.id).maybeSingle(),
    isOwner
      ? db
          .from("support_access_grants")
          .select("id, reason, requested_by, created_at, expires_at, approved_at")
          .eq("restaurant_id", r.id)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
    payments().card.status(paymentCtx),
    payments().ath.status(paymentCtx),
    db
      .from("dining_tables")
      .select("id, label, seats, area, shape, pos_x, pos_y")
      .eq("restaurant_id", r.id)
      .order("sort_order"),
  ]);

  const sign = async (path: string | null | undefined) =>
    path ? ((await db.storage.from("photos").createSignedUrl(path, 3600)).data?.signedUrl ?? null) : null;
  const [logoSrc, coverSrc] = await Promise.all([sign(design?.logo_path), sign(r.cover_path)]);

  // Requesters are Stratum staff (not team members), so their names come through the service role.
  const requesterIds = [
    ...new Set((grants.data ?? []).map((g) => g.requested_by).filter(Boolean)),
  ] as string[];
  const { data: requesters } = requesterIds.length
    ? await createAdminClient().from("profiles").select("user_id, full_name").in("user_id", requesterIds)
    : { data: [] };
  const who = new Map((requesters ?? []).map((p) => [p.user_id, p.full_name ?? "Stratum"]));
  const grantRows: GrantRow[] = (grants.data ?? []).map((g) => ({
    id: g.id,
    reason: g.reason,
    requestedBy: (g.requested_by && who.get(g.requested_by)) || "Stratum",
    createdAt: g.created_at,
    expiresAt: g.expires_at,
    approvedAt: g.approved_at,
  }));

  const providerRows = [
    { key: "card", status: card, flag: flags.cardPayments },
    { key: "ath", status: ath, flag: flags.athPayments },
  ] as const;

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="mb-1 text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
        {!isOwner && <p className="text-sm text-muted">{t("managerNote")}</p>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PreferencesPanel
          theme={await readThemeChoice()}
          locale={(await getLocale()) === "en" ? "en" : "es"}
        />
        <ProfileForm
          slug={restaurant}
          canEdit={isOwner}
          values={{
            name: r.name,
            slug: r.slug,
            timezone: r.timezone,
            default_language: r.default_language,
            default_menu_style: r.default_menu_style,
          }}
        />
        <BrandForm
          slug={restaurant}
          name={r.name}
          color={r.brand_color}
          coverSrc={coverSrc}
          logoSrc={logoSrc}
          canEdit={isOwner}
        />
        <IvuForm
          slug={restaurant}
          stateBps={r.ivu_state_bps}
          municipalBps={r.ivu_municipal_bps}
          canEdit={isOwner}
        />
        <LimitsForm
          slug={restaurant}
          values={{
            orderCents: r.qr_max_order_cents,
            lineQty: r.qr_max_line_qty,
            tabCents: r.qr_max_tab_cents,
            people: r.max_people_per_table,
          }}
          canEdit={isOwner}
        />
        <Panel title={t("fiscal.title")}>
          <ul className="grid gap-2">
            <li className="flex items-center justify-between gap-3 rounded-xl border-2 border-blue bg-soft p-3">
              <span>
                <b className="block">{t("fiscal.sitBeside")}</b>
                <span className="text-sm text-muted">{t("fiscal.sitBesideNote")}</span>
              </span>
              <Pill tone="ok">{t("fiscal.selected")}</Pill>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 opacity-70">
              <span>
                <b className="block">{t("fiscal.processor")}</b>
                <span className="text-sm text-muted">{t("fiscal.processorNote")}</span>
              </span>
              <Pill tone="idle">{t("soon")}</Pill>
            </li>
          </ul>
        </Panel>
        <Panel title={t("payments.title")}>
          <ul className="grid gap-2">
            <li className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <b>{t("payments.cash")}</b>
              <Pill tone="ok">{t("payments.status.connected")}</Pill>
            </li>
            {providerRows.map((p) => (
              <li
                key={p.key}
                className="flex items-center justify-between gap-3 rounded-xl border border-line p-3"
              >
                <b>{t(`payments.${p.key}`)}</b>
                {p.status === "connected" ? (
                  <Pill tone="ok">{t("payments.status.connected")}</Pill>
                ) : p.flag && isOwner ? (
                  <Pill tone="warn">{t(`payments.status.${p.status}`)}</Pill>
                ) : (
                  <Pill tone="idle">{t("soon")}</Pill>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">{t("payments.note")}</p>
        </Panel>
        <FloorEditor
          slug={restaurant}
          tables={(floorTables ?? []).map((tb) => ({
            id: tb.id,
            label: tb.label,
            seats: tb.seats,
            area: tb.area,
            shape: tb.shape as "square" | "round" | "long",
            x: tb.pos_x === null ? null : Number(tb.pos_x),
            y: tb.pos_y === null ? null : Number(tb.pos_y),
          }))}
        />
        <PrintersPanel
          slug={restaurant}
          printers={(printers ?? []) as PrinterRow[]}
          restaurantName={r.name}
        />
        {isOwner && <SupportPanel slug={restaurant} grants={grantRows} canEdit={isOwner} />}
      </div>
    </div>
  );
}
