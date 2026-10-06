import { getLocale, getTranslations } from "next-intl/server";
import { SupportRequestForm } from "@/components/admin/support-form";
import { Panel, Pill } from "@/components/ui/surface";
import { flags } from "@/config/flags";
import { loadAdmin } from "@/lib/admin/load";
import { formatCents } from "@/lib/money";

/** Stratum admin: restaurants, health flags, support access and feature flags (read-only). */
export default async function AdminPage() {
  const t = await getTranslations("admin");
  const locale = (await getLocale()) === "en" ? "en" : "es";
  const { restaurants, grants } = await loadAdmin();
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale === "es" ? "es-PR" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Puerto_Rico",
    }).format(new Date(iso));
  const flagged = restaurants.filter(
    (r) => r.flags.noOrders3d || r.flags.failedPayments || r.flags.failedPrints || r.flags.staleDevices,
  );

  return (
    <div className="grid gap-4">
      <Panel title={t("restaurants")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-ink-2">
                {(["name", "status", "setup", "trial", "volume", "lastOrder"] as const).map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className={`py-2 pr-3 font-bold ${c === "volume" ? "text-right" : ""}`}
                  >
                    {t(`cols.${c}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {restaurants.map((r) => (
                <tr key={r.id} className="border-b border-line-2">
                  <td className="py-2 pr-3">
                    <b>{r.name}</b>
                    <span className="block text-muted">/{r.slug}</span>
                  </td>
                  <td className="py-2 pr-3">
                    {t(`statuses.${r.status}`)} · {t("planValue", { plan: r.plan })}
                  </td>
                  <td className="py-2 pr-3">
                    {r.onboardingStep >= 7 ? t("setupDone") : t("setupStep", { step: r.onboardingStep })}
                  </td>
                  <td className="py-2 pr-3">{r.trialDays === null ? "—" : t("days", { n: r.trialDays })}</td>
                  <td className="tabular py-2 pr-3 text-right">{formatCents(r.volume30Cents, locale)}</td>
                  <td className="py-2 pr-3">{r.lastOrderAt ? when(r.lastOrderAt) : t("never")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("health")}>
          {flagged.length === 0 ? (
            <p className="text-sm text-muted">{t("healthy")}</p>
          ) : (
            <ul className="grid gap-3">
              {flagged.map((r) => (
                <li key={r.id}>
                  <p className="font-bold">{r.name}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {r.flags.noOrders3d && <Pill tone="warn">{t("healthFlags.noOrders")}</Pill>}
                    {r.flags.failedPayments > 0 && (
                      <Pill tone="bad">{t("healthFlags.failedPayments", { n: r.flags.failedPayments })}</Pill>
                    )}
                    {r.flags.failedPrints > 0 && (
                      <Pill tone="bad">{t("healthFlags.failedPrints", { n: r.flags.failedPrints })}</Pill>
                    )}
                    {r.flags.staleDevices > 0 && (
                      <Pill tone="warn">{t("healthFlags.staleDevices", { n: r.flags.staleDevices })}</Pill>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={t("support")}>
          <p className="mb-3 text-sm text-muted">{t("supportLead")}</p>
          <SupportRequestForm restaurants={restaurants.map((r) => ({ id: r.id, name: r.name }))} />
          {grants.length > 0 && (
            <ul className="mt-4 divide-y divide-line-2 border-t border-line">
              {grants.map((g) => {
                const expired = g.expired;
                return (
                  <li key={g.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{g.restaurant}</p>
                      <p className="text-muted">
                        {g.reason} · {when(g.createdAt)}
                      </p>
                    </div>
                    <Pill tone={expired ? "idle" : g.approvedAt ? "ok" : "warn"}>
                      {expired ? t("grant.expired") : g.approvedAt ? t("grant.active") : t("grant.pending")}
                    </Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title={t("flags")}>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {Object.entries(flags).map(([name, on]) => (
            <li
              key={name}
              className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2"
            >
              <code className="text-sm">{name}</code>
              <Pill tone={on ? "ok" : "idle"}>{on ? t("on") : t("off")}</Pill>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted">{t("flagsNote")}</p>
      </Panel>
    </div>
  );
}
