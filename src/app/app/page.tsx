import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MezzaWordmark } from "@/components/ui/brand";
import { finishSignup } from "@/lib/auth/finish-signup";
import { currentUserId, homeFor, myRestaurants } from "@/lib/auth/staff";

/**
 * /app sends a member straight to their restaurant; people with several pick one. A new owner whose
 * restaurant is still waiting on email confirmation gets it created here.
 */
export default async function AppIndexPage() {
  const restaurants = await myRestaurants();
  if (restaurants.length === 0) {
    // Confirmed the signup email on another device (the callback couldn't sign in there): the
    // restaurant is created on first sign-in instead (P2-5).
    const userId = await currentUserId();
    const slug = userId ? await finishSignup(userId) : null;
    if (slug) redirect(`/app/${slug}/empezar`);
  }
  if (restaurants.length === 1) redirect(homeFor(restaurants[0]!.slug, restaurants[0]!.role));
  const t = await getTranslations();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <MezzaWordmark byline={t("common.byStratum")} />
      <h1 className="mt-8 text-2xl font-extrabold">{t("auth.pickRestaurant")}</h1>
      {restaurants.length === 0 ? (
        <p className="mt-2 text-muted">{t("auth.noRestaurants")}</p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {restaurants.map((r) => (
            <li key={r.slug}>
              <a
                href={homeFor(r.slug, r.role)}
                className="flex min-h-14 items-center rounded-card border border-line bg-surface px-5 font-bold"
              >
                {r.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
