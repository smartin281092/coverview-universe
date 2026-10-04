import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { createPartnerClient } from "@coverview/api-client/partner";
import { leadCategorySchema } from "@coverview/contracts/partner";
import type { PilotageMetric } from "@coverview/contracts/partner-pilotage";
import { Button, ErrorState, LoadingState } from "@coverview/ui";
import { AdminBoundary } from "../features/users/AdminBoundary";

const client = createPartnerClient(
  import.meta.env.VITE_API_URL ??
    (import.meta.env.DEV ? "http://127.0.0.1:4100" : window.location.origin),
);
const partnerUrl =
  import.meta.env.VITE_PARTNER_URL ??
  (import.meta.env.DEV ? "http://127.0.0.1:4104" : "https://partners.coverview.ch");
// Drill-down: the Partner leads list with the same filters, still bounded by Admin rights there.
const leads = (filters: Record<string, string>) =>
  `${partnerUrl}/leads?${new URLSearchParams({ view: "all", ...filters }).toString()}`;
const number = new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" });
const groups = {
  activity: [
    "new_leads",
    "contacts",
    "appointments_scheduled",
    "appointments_completed",
    "market_received",
    "market_transmitted",
    "verified_signatures",
  ],
  quality: [
    "satisfaction",
    "survey_responses",
    "on_time_rate",
    "complaints",
    "quality_pending",
    "inactive_leads",
    "undocumented_contracts",
  ],
  performance: ["transformation_rate", "cycle_days", "first_contact_days", "keep_current_rate"],
  economy: [
    "weighted_pipeline_minimum",
    "weighted_pipeline_maximum",
    "confirmed_commission",
    "signed_commission",
    "received_commission",
  ],
} as const;

function Dashboard({ identity, blocked }: { identity: IdentityMe; blocked: boolean }) {
  const { t } = useTranslation("dashboard");
  const [days, setDays] = useState(30),
    [category, setCategory] = useState<string>("");
  // The period ends on the current minute so the query key stays stable between renders.
  const [to] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now;
  });
  const from = new Date(to.getTime() - days * 86400000);
  const filters = {
    from: from.toISOString(),
    to: to.toISOString(),
    ...(category ? { category: leadCategorySchema.parse(category) } : {}),
  };
  const key = ["private", identity.user.id, identity.session.id, "partner-network", filters];
  const pilotage = useQuery({
    queryKey: [...key, "pilotage"],
    queryFn: ({ signal }) => client.pilotage({ ...filters, scope: "network" }, signal),
    enabled: !blocked,
    gcTime: 0,
    retry: false,
  });
  const overview = useQuery({
    queryKey: [...key, "overview"],
    queryFn: ({ signal }) => client.adminOverview(filters, signal),
    enabled: !blocked,
    gcTime: 0,
    retry: false,
  });
  const measure = (metric: PilotageMetric) => {
    const item = pilotage.data?.measures.find((value) => value.metric === metric);
    if (!item || item.status !== "available" || item.value === null)
      return t(`status.${item?.status ?? "source_unavailable"}`);
    return item.unit === "chf_minor"
      ? money.format(item.value / 100)
      : item.unit === "percent"
        ? t("percent", { value: number.format(item.value) })
        : item.unit === "days"
          ? t("days", { value: number.format(item.value) })
          : item.unit === "rating"
            ? t("rating", { value: number.format(item.value) })
            : number.format(item.value);
  };
  const filtersFor = category ? { category } : {};
  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <Link to="/partner" className="text-sm underline underline-offset-4">
          {t("back")}
        </Link>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("description")}</p>
      </header>
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-2 text-sm">
          <span>{t("period")}</span>
          <select
            className="block h-10 rounded-md border border-input bg-background px-3"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            {[30, 90, 365].map((value) => (
              <option key={value} value={value}>
                {t("lastDays", { count: value })}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2 text-sm">
          <span>{t("category")}</span>
          <select
            className="block h-10 rounded-md border border-input bg-background px-3"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">{t("allCategories")}</option>
            {leadCategorySchema.options.map((value) => (
              <option key={value} value={value}>
                {t(`categories.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" asChild>
          <a href={`${partnerUrl}/statistics`}>{t("allMeasures")}</a>
        </Button>
      </div>
      {pilotage.isPending || overview.isPending ? (
        <LoadingState label={t("loading")} />
      ) : pilotage.isError || overview.isError ? (
        <ErrorState
          title={t("error")}
          description={t("errorDescription")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => {
            void pilotage.refetch();
            void overview.refetch();
          }}
        />
      ) : (
        <>
          {pilotage.data.network && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{t("network.title")}</h2>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {(
                  [
                    "activeOrganizations",
                    "activeAdvisors",
                    "newMembers",
                    "pendingMembers",
                    "suspendedMembers",
                  ] as const
                ).map((item) => (
                  <div key={item} className="rounded-xl border border-border p-4">
                    <p className="text-sm text-muted-foreground">{t(`network.${item}`)}</p>
                    <p className="mt-2 text-2xl font-semibold">
                      {number.format(pilotage.data.network![item])}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("followUp.title")}</h2>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ["active", {}],
                  ["noNextAction", { view: "no_action" }],
                  ["firstActionOverdue", { alert: "overdue" }],
                  ["overdue", { view: "overdue" }],
                  ["unassigned", { alert: "unassigned" }],
                  ["coverviewQueue", { assignment: "coverview" }],
                ] as const
              ).map(([item, query]) => (
                <a
                  key={item}
                  href={leads({ ...filtersFor, ...query })}
                  className="rounded-xl border border-border p-4 hover:bg-muted/40"
                >
                  <p className="text-sm text-muted-foreground">{t(`followUp.${item}`)}</p>
                  <p className="mt-2 text-2xl font-semibold">
                    {number.format(overview.data.followUp[item])}
                  </p>
                </a>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              {t("followUp.reassignments", {
                manual: overview.data.reassignments.manual,
                automatic: overview.data.reassignments.automatic,
              })}
            </p>
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("pipeline.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("pipeline.leads", { count: pilotage.data.leadCount })}
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {pilotage.data.breakdowns
                .filter((breakdown) =>
                  ["category", "advisor", "organization"].includes(breakdown.dimension),
                )
                .map((breakdown) => (
                  <div key={breakdown.dimension} className="rounded-xl border border-border p-4">
                    <h3 className="font-medium">{t(`dimension.${breakdown.dimension}`)}</h3>
                    <ul className="mt-3 space-y-1 text-sm">
                      {breakdown.items.map((item) => (
                        <li key={item.key} className="flex justify-between gap-3">
                          <a
                            className="underline-offset-4 hover:underline"
                            href={leads({
                              ...filtersFor,
                              ...(breakdown.dimension === "category"
                                ? { category: item.key }
                                : breakdown.dimension === "advisor"
                                  ? { responsibleId: item.key }
                                  : { organizationId: item.key }),
                            })}
                          >
                            {breakdown.dimension === "category"
                              ? t(`categories.${item.key}`, { defaultValue: item.label })
                              : item.label}
                          </a>
                          <span>{number.format(item.count)}</span>
                        </li>
                      ))}
                    </ul>
                    {breakdown.truncated && (
                      <p className="mt-2 text-xs text-muted-foreground">{t("truncated")}</p>
                    )}
                  </div>
                ))}
            </div>
          </section>
          {(["activity", "quality", "performance", "economy"] as const).map((group) => (
            <section key={group} className="space-y-3">
              <h2 className="text-lg font-semibold">{t(`groups.${group}`)}</h2>
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {groups[group].map((metric) => (
                  <div key={metric} className="rounded-xl border border-border p-4">
                    <dt className="text-sm text-muted-foreground">{t(`metrics.${metric}`)}</dt>
                    <dd className="mt-2 text-xl font-semibold">{measure(metric)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("comparison.advisors")}</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    {(
                      [
                        "name",
                        "organization",
                        "active",
                        "closed",
                        "contracts",
                        "conversionRate",
                        "cycleDays",
                        "overdue",
                        "satisfaction",
                      ] as const
                    ).map((column) => (
                      <th key={column} scope="col" className="p-3">
                        {t(`comparison.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.data.advisors.map((row) => (
                    <tr key={row.userId} className="border-t border-border">
                      <th scope="row" className="p-3 font-medium">
                        <a
                          className="underline-offset-4 hover:underline"
                          href={leads({ ...filtersFor, responsibleId: row.userId })}
                        >
                          {row.name}
                        </a>
                      </th>
                      <td className="p-3">{row.organization}</td>
                      <td className="p-3">{row.active}</td>
                      <td className="p-3">{row.closed}</td>
                      <td className="p-3">{row.contracts}</td>
                      <td className="p-3">
                        {row.conversionRate === null
                          ? t("none")
                          : t("percent", { value: number.format(row.conversionRate) })}
                      </td>
                      <td className="p-3">
                        {row.cycleDays === null
                          ? t("none")
                          : t("days", { value: number.format(row.cycleDays) })}
                      </td>
                      <td className="p-3">
                        <a
                          className="underline-offset-4 hover:underline"
                          href={leads({
                            ...filtersFor,
                            responsibleId: row.userId,
                            view: "overdue",
                          })}
                        >
                          {row.overdue}
                        </a>
                      </td>
                      <td className="p-3">
                        {row.satisfaction === null
                          ? t("fewResponses", { count: row.responses })
                          : t("rating", { value: number.format(row.satisfaction) })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {overview.data.truncated && (
              <p className="text-xs text-muted-foreground">{t("truncated")}</p>
            )}
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("comparison.organizations")}</h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    {(
                      [
                        "organization",
                        "advisors",
                        "active",
                        "closed",
                        "contracts",
                        "conversionRate",
                        "overdue",
                      ] as const
                    ).map((column) => (
                      <th key={column} scope="col" className="p-3">
                        {t(`comparison.${column}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overview.data.organizations.map((row) => (
                    <tr key={row.organizationId} className="border-t border-border">
                      <th scope="row" className="p-3 font-medium">
                        <a
                          className="underline-offset-4 hover:underline"
                          href={leads({ ...filtersFor, organizationId: row.organizationId })}
                        >
                          {row.name}
                        </a>
                      </th>
                      <td className="p-3">{row.advisors}</td>
                      <td className="p-3">{row.active}</td>
                      <td className="p-3">{row.closed}</td>
                      <td className="p-3">{row.contracts}</td>
                      <td className="p-3">
                        {row.conversionRate === null
                          ? t("none")
                          : t("percent", { value: number.format(row.conversionRate) })}
                      </td>
                      <td className="p-3">{row.overdue}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="text-xs text-muted-foreground">{t("scope")}</p>
        </>
      )}
    </div>
  );
}

export function PartnerDashboardPage() {
  return (
    <AdminBoundary>
      {(identity, blocked) => <Dashboard identity={identity} blocked={blocked} />}
    </AdminBoundary>
  );
}
