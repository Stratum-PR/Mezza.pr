import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { payments } from "@/connectors/payments";
import { MenuStep, PaymentsStep, StaffStep, TablesStep } from "@/components/wizard/steps";
import { Button, buttonClass } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import type { QrPresetId } from "@/config/qr-presets";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { cn } from "@/lib/cn";
import { trialDaysLeft } from "@/lib/trial";
import { wizardFinishStaff, wizardGoLive, wizardSkip } from "./actions";

const STEPS = [1, 2, 3, 4, 5, 6] as const;

/** The 6-step onboarding wizard. Resumable: progress lives in restaurants.onboarding_step (7 = done). */
export default async function OnboardingPage({
  params,
  searchParams,
}: PageProps<"/app/[restaurant]/empezar">) {
  const { restaurant: slug } = await params;
  const query = await searchParams;
  const ctx = await requireStaff(slug);
  if (ctx.role !== "owner") redirect(`/app/${slug}`);
  const progress = ctx.restaurant.onboarding_step;
  const requested = Number(query.paso);
  if (progress >= 7 && !requested) redirect(`/app/${slug}`);
  // You can revisit any step up to where you've reached, but not skip ahead.
  const step = Math.min(
    Math.max(Number.isInteger(requested) && requested >= 2 ? requested : progress, 2),
    Math.min(progress, 6),
  );

  const t = await getTranslations("wizard");
  const db = await createClient();
  const [{ count: tableCount }, { data: design }] = await Promise.all([
    db
      .from("dining_tables")
      .select("id", { count: "exact", head: true })
      .eq("restaurant_id", ctx.restaurant.id),
    db.from("qr_designs").select("preset").eq("restaurant_id", ctx.restaurant.id).maybeSingle(),
  ]);
  const paymentCtx = { restaurantId: ctx.restaurant.id, actorUserId: ctx.userId, locale: "es" as const };
  const providerStatus =
    step === 4
      ? { card: await payments().card.status(paymentCtx), ath: await payments().ath.status(paymentCtx) }
      : { card: "not_connected", ath: "not_connected" };
  const trialDays = trialDaysLeft(ctx.restaurant.trial_ends_at);

  const skip = wizardSkip.bind(null, slug, step);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">
        {t("title", { name: ctx.restaurant.name })}
      </h1>
      <p className="text-muted">{t("lead")}</p>
      {trialDays !== null && (
        <p className="mt-1 text-sm font-semibold text-ok">{t("trial", { days: trialDays })}</p>
      )}

      <nav aria-label={t("stepsLabel")} className="my-6">
        <ol className="grid grid-cols-6 gap-1.5">
          {STEPS.map((n) => {
            const done = n < progress && n !== step;
            const current = n === step;
            const reachable = n >= 2 && n <= Math.min(progress, 6);
            const inner = (
              <>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-sm font-extrabold",
                    current
                      ? "bg-accent text-accent-ink"
                      : done
                        ? "bg-ok-bg text-ok"
                        : "bg-line-2 text-muted",
                  )}
                >
                  {done ? "✓" : n}
                </span>
                <span className="text-[11px] font-semibold sm:text-xs">{t(`steps.${n}`)}</span>
              </>
            );
            return (
              <li key={n} aria-current={current ? "step" : undefined}>
                {reachable && !current ? (
                  <Link
                    href={`/app/${slug}/empezar?paso=${n}`}
                    className="grid min-h-11 justify-items-center gap-1 text-center"
                  >
                    {inner}
                  </Link>
                ) : (
                  <span className="grid min-h-11 justify-items-center gap-1 text-center">{inner}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <Panel className="p-6 sm:p-8">
        {step === 2 && (
          <>
            <h2 className="mb-1 text-xl font-extrabold">{t("menu.title")}</h2>
            <p className="mb-5 text-muted">{t("menu.body")}</p>
            <MenuStep slug={slug} />
            <form action={skip} className="mt-4">
              <Button type="submit" variant="ghost" size="sm">
                {t("menu.manual")}
              </Button>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="mb-5 text-xl font-extrabold">{t("tables.title")}</h2>
            <TablesStep
              slug={slug}
              existing={tableCount ?? 0}
              preset={(design?.preset as QrPresetId) ?? "house"}
            />
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="mb-1 text-xl font-extrabold">{t("payments.title")}</h2>
            <p className="mb-5 text-muted">{t("payments.body")}</p>
            <PaymentsStep slug={slug} status={providerStatus} />
            <form action={skip} className="mt-6">
              <Button type="submit" size="lg">
                {t("continue")}
              </Button>
            </form>
          </>
        )}

        {step === 5 && (
          <>
            <h2 className="mb-1 text-xl font-extrabold">{t("staff.title")}</h2>
            <p className="mb-5 text-muted">{t("staff.body")}</p>
            <StaffStep slug={slug} />
            <div className="mt-6 flex flex-wrap gap-3">
              <form action={wizardFinishStaff.bind(null, slug)}>
                <Button type="submit" size="lg">
                  {t("staff.done")}
                </Button>
              </form>
              <form action={skip}>
                <Button type="submit" size="lg" variant="soft">
                  {t("skip")}
                </Button>
              </form>
            </div>
          </>
        )}

        {step === 6 && (
          <>
            <h2 className="mb-1 text-xl font-extrabold">{t("print.title")}</h2>
            <p className="mb-5 text-muted">{t("print.body", { count: tableCount ?? 0 })}</p>
            <div className="flex flex-wrap gap-3">
              <a
                href={`/app/${slug}/qr/pdf?format=sheet`}
                download
                className={buttonClass({ size: "lg", variant: "soft" })}
              >
                {t("print.download")}
              </a>
              <Link href={`/app/${slug}/qr`} className={buttonClass({ variant: "ghost", size: "lg" })}>
                {t("print.studio")}
              </Link>
              <form action={wizardGoLive.bind(null, slug)}>
                <Button type="submit" size="lg">
                  {t("print.goLive")}
                </Button>
              </form>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
