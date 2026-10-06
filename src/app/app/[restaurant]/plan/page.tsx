import { getLocale, getTranslations } from "next-intl/server";
import { billing } from "@/connectors/billing";
import { Panel, Pill } from "@/components/ui/surface";
import { activePricingModel, pricing } from "@/config/pricing";
import { requireSection } from "@/lib/auth/staff";
import { formatCents } from "@/lib/money";
import { trialDaysLeft } from "@/lib/trial";

/** Plan: trial days left and the active pricing model from config. Checkout goes through BillingProvider later. */
export default async function PlanPage({ params }: PageProps<"/app/[restaurant]/plan">) {
  const { restaurant } = await params;
  const ctx = await requireSection(restaurant, "plan");
  const t = await getTranslations("settings.plan");
  const tp = await getTranslations("site.pricing");
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const current = await billing().current({
    restaurantId: ctx.restaurant.id,
    actorUserId: ctx.userId,
    locale,
  });
  const days = trialDaysLeft(current.trialEndsAt ?? ctx.restaurant.trial_ends_at);
  const model = activePricingModel();
  const pct = (bps: number) => `${(bps / 100).toLocaleString(locale === "es" ? "es-PR" : "en-US")}`;
  const features = tp.raw("features") as string[];

  return (
    <div className="grid max-w-3xl gap-4">
      <h1 className="text-[28px] font-extrabold tracking-[-0.02em]">{t("title")}</h1>
      <div className="rounded-card p-5 text-white" style={{ background: "var(--gradient)" }}>
        <p className="text-sm font-semibold text-white/80">{t("status")}</p>
        <p className="mt-1 text-[28px] font-extrabold leading-tight">{t(`statuses.${current.status}`)}</p>
        {current.status === "trial" && days !== null && (
          <p className="mt-1 text-white/90">{t("trialLeft", { days, total: pricing.trialDays })}</p>
        )}
      </div>
      <Panel title={tp("plan")}>
        {model.kind === "base_plus_card" && (
          <p className="text-2xl font-extrabold">
            {formatCents(model.monthlyCents, locale)}{" "}
            <span className="text-base font-semibold text-muted">{tp("month")}</span>
            <span className="mt-1 block text-base font-semibold text-ink-2">
              {tp("plusCard", { percent: pct(model.cardFeeBps) })}
            </span>
          </p>
        )}
        {model.kind === "percent_only" && (
          <p className="text-xl font-extrabold">
            {t("percentOnly", { card: pct(model.cardFeeBps), ath: pct(model.athFeeBps) })}
          </p>
        )}
        {model.kind === "tiers" && (
          <ul className="grid gap-1">
            {model.tiers.map((tier) => (
              <li key={tier.id} className="flex justify-between font-bold">
                <span className="capitalize">{tier.id}</span>
                <span>
                  {formatCents(tier.monthlyCents, locale)} {tp("month")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <ul className="mt-4 grid gap-1.5 text-sm">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <span aria-hidden className="text-ok">
                ✓
              </span>
              {f}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title={t("billing")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">{t("billingNote")}</p>
          <Pill tone="idle">{t("soon")}</Pill>
        </div>
      </Panel>
    </div>
  );
}
