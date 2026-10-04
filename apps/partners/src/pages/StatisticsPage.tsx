import { useState } from "react";
import { useSearch, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Badge, LoadingState, ErrorState } from "@coverview/ui";
import type { PilotageMeasure } from "@coverview/contracts/partner-pilotage";
import { usePartner } from "../features/PartnerSession";
import { partnerApi } from "../api";
import { PilotageFilterDialog } from "../features/PilotageFilterDialog";
import { PilotageSourcesDialog } from "../features/PilotageSourcesDialog";
import { formatMeasure } from "../features/pilotage-display";
import { formatDate } from "../features/Field";
export function StatisticsPage() {
  const { t, i18n } = useTranslation("pilotage"),
    session = usePartner(),
    search = useSearch({ from: "/statistics" }),
    navigate = useNavigate({ from: "/statistics" });
  const [filters, setFilters] = useState(false),
    [group, setGroup] = useState<PilotageMeasure["group"]>("activity"),
    [source, setSource] = useState<PilotageMeasure | null>(null);
  const policy = { gcTime: 0, staleTime: 0, retry: false, refetchInterval: 30000 };
  const options = useQuery({
    queryKey: [...session.queryKey, "pilotage-options"],
    queryFn: ({ signal }) => partnerApi.pilotageOptions(signal),
    ...policy,
  });
  const report = useQuery({
    queryKey: [...session.queryKey, "pilotage", search],
    queryFn: ({ signal }) => partnerApi.pilotage(search, signal),
    ...policy,
  });
  const data = report.isError ? undefined : report.data;
  return (
    <>
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("description")}</p>
      </header>
      <div className="flex flex-wrap gap-3">
        <Button disabled={!options.data || options.isError} onClick={() => setFilters(true)}>
          {t("filters")}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/goals" search={{ state: "active" }}>
            {t("goalsTitle")}
          </Link>
        </Button>
      </div>
      {filters && options.data && !options.isError && (
        <PilotageFilterDialog
          query={search}
          options={options.data}
          onClose={() => setFilters(false)}
          onApply={(value) => {
            setSource(null);
            void navigate({ search: value });
          }}
        />
      )}
      {source && data && (
        <PilotageSourcesDialog query={search} measure={source} onClose={() => setSource(null)} />
      )}
      {report.isPending ? (
        <LoadingState label={t("loading")} />
      ) : report.isError ? (
        <ErrorState
          title={t("changed")}
          description={t("reloadDescription")}
          retryLabel={t("reload")}
          pendingLabel={t("loading")}
          onRetry={() => void report.refetch()}
        />
      ) : (
        data && (
          <>
            <section className="space-y-2 text-sm">
              <p>{t("period", { from: formatDate(data.from), to: formatDate(data.to) })}</p>
              <p>
                {t("comparisonPeriod", {
                  from: formatDate(data.comparisonFrom),
                  to: formatDate(data.comparisonTo),
                })}
              </p>
              <p>
                {t("scopeSummary", {
                  scope: t(`scopes.${data.scope.kind}`),
                  count: data.leadCount,
                })}
              </p>
              <p>{t("calculatedAt", { date: formatDate(data.calculatedAt) })}</p>
              <p className="text-muted-foreground">{t("populationDefinition")}</p>
            </section>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t("groupsLabel")}>
              {(["activity", "conversion", "offers", "quality", "economy"] as const).map(
                (value) => (
                  <Button
                    key={value}
                    variant={group === value ? "default" : "outline"}
                    aria-pressed={group === value}
                    onClick={() => setGroup(value)}
                  >
                    {t(`groups.${value}`)}
                  </Button>
                ),
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <caption className="sr-only">{t(`groups.${group}`)}</caption>
                <thead className="bg-muted">
                  <tr>
                    {["indicator", "actual", "previous", "sources"].map((key) => (
                      <th key={key} scope="col" className="p-4">
                        {t(key)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.measures
                    .filter((m) => m.group === group)
                    .map((measure) => {
                      const previous = data.comparison.find((m) => m.metric === measure.metric);
                      return (
                        <tr key={measure.metric} className="border-t border-border">
                          <th scope="row" className="max-w-lg p-4 align-top font-normal">
                            <p className="font-semibold">{t(`metrics.${measure.metric}`)}</p>
                            <p className="mt-2 text-muted-foreground">
                              {t(`definitions.${measure.metric}`)}
                            </p>
                            <Badge variant="outline" className="mt-2">
                              {t(`basis.${measure.basis}`)}
                            </Badge>
                          </th>
                          <td className="p-4 align-top">
                            <p className="whitespace-nowrap text-lg font-semibold tabular-nums">
                              {formatMeasure(measure.value, measure.unit, i18n.language)}
                              {measure.value !== null && measure.unit === "days" && t("daySuffix")}
                            </p>
                            <p className="mt-2 text-xs">{t(`status.${measure.status}`)}</p>
                            {measure.reason && (
                              <p className="mt-2 max-w-52 text-xs text-muted-foreground">
                                {t(`reasons.${measure.reason}`)}
                              </p>
                            )}
                            {measure.denominator !== null && (
                              <p className="mt-2 text-xs">
                                {t("denominator", {
                                  count: measure.denominator,
                                  population: measure.population,
                                })}
                              </p>
                            )}
                          </td>
                          <td className="p-4 align-top tabular-nums">
                            {formatMeasure(previous?.value ?? null, measure.unit, i18n.language)}
                            {measure.basis === "snapshot" && (
                              <p className="mt-2 max-w-40 text-xs text-muted-foreground">
                                {t("reasons.historical_snapshot")}
                              </p>
                            )}
                          </td>
                          <td className="p-4 align-top">
                            {measure.canInspect ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSource(measure)}
                              >
                                {t("inspect")}
                              </Button>
                            ) : (
                              <span>{t("notApplicable")}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {group === "activity" && (
              <section className="space-y-5">
                <h2 className="text-xl font-semibold">{t("breakdowns")}</h2>
                <p className="text-sm text-muted-foreground">{t("breakdownDescription")}</p>
                <div className="grid gap-6 md:grid-cols-2">
                  {data.breakdowns
                    .filter((b) => b.dimension !== "company")
                    .map((b) => (
                      <section
                        key={b.dimension}
                        className="space-y-3 rounded-xl border border-border p-4"
                      >
                        <h3 className="font-semibold">{t(`dimensions.${b.dimension}`)}</h3>
                        {b.items.length ? (
                          b.items.map((item) => (
                            <div key={item.key} className="flex items-start justify-between gap-4">
                              <span>
                                {b.dimension === "stage"
                                  ? t(`partner:stage.${item.key}`)
                                  : b.dimension === "category"
                                    ? t(`partner:category.${item.key}`)
                                    : item.label || t("notProvided")}
                              </span>
                              <span className="tabular-nums">{item.count}</span>
                            </div>
                          ))
                        ) : (
                          <p>{t("noSources")}</p>
                        )}
                        {b.truncated && <p>{t("breakdownTruncated")}</p>}
                      </section>
                    ))}
                </div>
              </section>
            )}
            {group === "offers" &&
              data.breakdowns
                .filter((b) => b.dimension === "company")
                .map((b) => (
                  <section key={b.dimension} className="space-y-3">
                    <h2 className="text-xl font-semibold">{t("companyBreakdown")}</h2>
                    {b.items.map((item) => (
                      <article
                        key={item.key}
                        className="flex flex-wrap justify-between gap-3 border-b border-border py-3"
                      >
                        <span>{item.label || t("notProvided")}</span>
                        <span>
                          {t("companyCounts", {
                            count: item.count,
                            selected: item.selected ?? 0,
                            rate: formatMeasure(item.selectionRate, "percent", i18n.language),
                          })}
                        </span>
                      </article>
                    ))}
                    {b.truncated && <p>{t("breakdownTruncated")}</p>}
                  </section>
                ))}
            {data.network && (
              <section className="space-y-4">
                <h2 className="text-xl font-semibold">{t("networkTitle")}</h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  {Object.entries(data.network).map(([key, value]) => (
                    <article key={key} className="rounded-xl border border-border p-4">
                      <p className="text-sm text-muted-foreground">{t(`network.${key}`)}</p>
                      <p className="mt-3 text-2xl tabular-nums">{value}</p>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )
      )}
    </>
  );
}
