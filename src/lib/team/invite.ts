import "server-only";
import type { Role } from "@/lib/auth/staff";
import { createAdminClient } from "@/lib/db/admin";
import { publicEnv } from "@/lib/env";

export type AddMemberResult = "invited" | "added" | "forbidden" | "invite_failed" | "failed";

export interface AddMemberInput {
  restaurantId: string;
  email: string;
  role: Exclude<Role, "owner">;
  /** Whether the person adding is the owner: only the owner adds or changes managers. */
  actorIsOwner: boolean;
  name?: string;
}

/**
 * The one way staff are added (Equipo and the setup wizard): invites a new person, or gives an
 * existing account the membership. Never touches an owner's membership; the database also keeps at
 * least one active owner per restaurant. Callers check the signed-in member's role first.
 */
export async function addMember(input: AddMemberInput): Promise<AddMemberResult> {
  if (input.role === "manager" && !input.actorIsOwner) return "forbidden";
  const email = input.email.toLowerCase();
  const admin = createAdminClient();

  let userId: string | undefined;
  const invited = await admin.auth.admin.inviteUserByEmail(email, {
    // The site's own address, never the request's Origin header.
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/auth/callback?next=/app/contrasena`,
    data: input.name ? { full_name: input.name } : undefined,
  });
  if (invited.data.user) userId = invited.data.user.id;
  else {
    // Already has an account (e.g. works at another restaurant): find it and add the membership.
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    userId = data?.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) return "invite_failed";
  }

  const { data: existing } = await admin
    .from("memberships")
    .select("id, role")
    .eq("restaurant_id", input.restaurantId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.role === "owner") return "forbidden";
  if (existing?.role === "manager" && !input.actorIsOwner) return "forbidden";
  const { error } = existing
    ? await admin.from("memberships").update({ role: input.role, active: true }).eq("id", existing.id)
    : await admin
        .from("memberships")
        .insert({ restaurant_id: input.restaurantId, user_id: userId, role: input.role });
  if (error) return "failed";
  if (input.name) {
    await admin
      .from("profiles")
      .upsert({ user_id: userId, full_name: input.name }, { onConflict: "user_id" });
  }
  return invited.data.user ? "invited" : "added";
}
