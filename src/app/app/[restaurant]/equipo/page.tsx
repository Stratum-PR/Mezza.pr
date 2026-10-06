import { getTranslations } from "next-intl/server";
import { TeamView, type Member } from "@/components/settings/team-view";
import { requireSection } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/db/admin";

const ORDER = { owner: 0, manager: 1, server: 2, kitchen: 3 } as const;

/** Equipo: invite staff, change roles, deactivate. Emails come from auth (service role, server only). */
export default async function TeamPage({ params }: PageProps<"/app/[restaurant]/equipo">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "team");
  const t = await getTranslations("settings.team");
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("memberships")
    .select("id, user_id, role, active")
    .eq("restaurant_id", ctx.restaurant.id);
  const ids = (rows ?? []).map((r) => r.user_id);
  const [{ data: profiles }, users] = await Promise.all([
    admin.from("profiles").select("user_id, full_name").in("user_id", ids),
    Promise.all(ids.map((id) => admin.auth.admin.getUserById(id))),
  ]);
  const name = new Map((profiles ?? []).map((p) => [p.user_id, p.full_name ?? ""]));
  const email = new Map(users.map((u) => [u.data.user?.id, u.data.user?.email ?? ""]));
  const members: Member[] = (rows ?? [])
    .map((r) => ({
      id: r.id,
      name: name.get(r.user_id) ?? "",
      email: email.get(r.user_id) ?? "",
      role: r.role,
      active: r.active,
      isMe: r.user_id === ctx.userId,
    }))
    .sort(
      (a, b) =>
        ORDER[a.role] - ORDER[b.role] || Number(b.active) - Number(a.active) || a.name.localeCompare(b.name),
    );

  return (
    <div>
      <h1 className="mb-1 text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <p className="mb-4 text-sm text-muted">{t("lead")}</p>
      <TeamView slug={restaurant} members={members} isOwner={ctx.role === "owner"} />
    </div>
  );
}
