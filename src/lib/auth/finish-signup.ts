import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import { slugify, uniqueSlug } from "@/lib/slug";

/**
 * Onboarding step 1, second half: once the email is confirmed, creates the restaurant from the
 * details saved at signup (pending_signups) with its owner membership, default QR design and 30-day
 * trial. Runs from the confirmation link's callback and on /app (the link may be opened on another
 * device, where the callback can't sign in). Returns the new restaurant's slug, or null when there
 * is nothing to do. The pending row is claimed with a delete, so two calls can't create two.
 */
export async function finishSignup(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: account } = await admin.auth.admin.getUserById(userId);
  if (!account?.user?.email_confirmed_at) return null;

  const { data: pending } = await admin
    .from("pending_signups")
    .delete()
    .eq("user_id", userId)
    .select("user_id, full_name, restaurant_name, phone, language")
    .maybeSingle();
  if (!pending) return null;

  // Chosen now, not at signup, so unconfirmed signups can't hold a slug.
  const slug = await uniqueSlug(slugify(pending.restaurant_name), async (s) => {
    const { count } = await admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("slug", s);
    return (count ?? 0) > 0;
  });
  const created = await admin.rpc("create_restaurant_with_owner", {
    p_owner_id: userId,
    p_name: pending.restaurant_name,
    p_slug: slug,
    p_phone: pending.phone ?? undefined,
    p_language: pending.language,
  });
  if (created.error) {
    await admin.from("pending_signups").insert(pending);
    return null;
  }
  await admin.from("profiles").update({ full_name: pending.full_name }).eq("user_id", userId);
  return slug;
}
