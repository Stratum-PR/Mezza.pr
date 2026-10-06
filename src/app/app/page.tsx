import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MezzaWordmark } from "@/components/ui/brand";
import { homeFor, myRestaurants } from "@/lib/auth/staff";

/** /app sends a member straight to their restaurant; people with several pick one. */
export default async function AppIndexPage() {
  const restaurants = await myRestaurants();
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
