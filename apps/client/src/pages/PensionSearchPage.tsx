import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import { pensionSearchStages, type PensionSearch } from "@coverview/api-client/pension-searches";
import { ErrorState, LoadingState, RequestProgress } from "@coverview/ui";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { pensionApi } from "../pension-api";

const date = (value: string, language: string) =>
  new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );
// A birth date is a calendar day, shown as given: no time zone moves it.
const day = (iso: string) => iso.split("-").reverse().join(".");

/** The highest step reached; a cancelled search keeps the steps it went through. */
function pensionSearchStep(search: Pick<PensionSearch, "history">) {
  return Math.max(
    0,
    ...search.history.map((event) =>
      (pensionSearchStages as readonly string[]).indexOf(event.state),
    ),
  );
}

// An LPP search ordered from the public site (4 November 2026): its steps, dated when the team
// records them, and the information given, read every 15 seconds while the page is visible.
function Search({ identity }: { identity: IdentityMe }) {
  const { t, i18n } = useTranslation("pensionSearches");
  const { searchId } = useParams({ strict: false });
  const detail = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "pension-searches", searchId],
    queryFn: ({ signal }) => pensionApi.get(searchId!, signal),
    enabled: Boolean(searchId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => (query.state.status === "error" ? false : 15000),
    refetchIntervalInBackground: false,
  });
  const search = detail.data;
  const period = (from: number | null, to: number | null) =>
    from && to
      ? t("period", { from, to })
      : from
        ? t("periodFrom", { from })
        : to
          ? t("periodTo", { to })
          : "";
  return (
    <div className="space-y-8">
      <Link
        to="/insurance-requests"
        className="wallet-back-link inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("back")}
      </Link>
      <header className="space-y-1">
        <h1 className="cv-app-heading">{t("name")}</h1>
        {search && (
          <p className="text-muted-foreground">
            {t("requested", { date: date(search.createdAt, i18n.language) })}
          </p>
        )}
      </header>
      {detail.isPending ? (
        <LoadingState label={t("loading")} />
      ) : detail.isError || !search ? (
        <ErrorState
          title={t("error")}
          description=""
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void detail.refetch()}
        />
      ) : (
        // Steps on the left, the information on the right from tablets on, as for the
        // comparator's requests (25 October 2026).
        <div className="grid gap-8 md:grid-cols-2 md:items-start md:gap-10">
          <div className="wallet-request-steps space-y-4">
            {search.state === "cancelled" && <p>{t("cancelled")}</p>}
            <RequestProgress
              current={pensionSearchStep(search)}
              cancelled={search.state === "cancelled"}
              complete={search.state === "completed"}
              steps={pensionSearchStages.map((state) => ({
                label: t(`states.${state}`),
                description: t(`descriptions.${state}`),
                at: search.history.find((event) => event.state === state)?.at,
              }))}
            />
          </div>
          <section className="space-y-6" aria-label={t("summary")}>
            <dl className="divide-y divide-border">
              <div className="space-y-1 py-5 md:pt-1.5">
                <dt className="text-sm text-muted-foreground">{t("identity")}</dt>
                <dd className="font-medium">
                  {search.details.firstName} {search.details.lastName}
                </dd>
                {search.details.previousNames && (
                  <dd className="text-sm">
                    {t("previousNames", { value: search.details.previousNames })}
                  </dd>
                )}
                <dd className="text-sm">
                  {t(`born_${search.details.sex}`, {
                    date: day(search.details.birthDate),
                    nationality: search.details.nationality,
                  })}
                </dd>
                <dd className="text-sm">{t("avs", { value: search.details.avsNumber })}</dd>
              </div>
              <div className="space-y-1 py-5">
                <dt className="text-sm text-muted-foreground">{t("address")}</dt>
                <dd className="text-sm">{search.details.street}</dd>
                <dd className="text-sm">
                  {t("locality", {
                    postalCode: search.details.postalCode,
                    city: search.details.city,
                    country: search.details.country,
                  })}
                </dd>
                <dd className="text-sm">{search.email}</dd>
                {search.details.phone && <dd className="text-sm">{search.details.phone}</dd>}
              </div>
              <div className="space-y-2 py-5">
                <dt className="text-sm text-muted-foreground">{t("path")}</dt>
                <dd className="text-sm">{t(`situations.${search.details.situation}`)}</dd>
                {search.details.employers.length ? (
                  <dd>
                    <ul className="space-y-2">
                      {search.details.employers.map((employer, index) => (
                        <li key={index} className="rounded-lg bg-muted px-4 py-3 text-sm">
                          <span className="font-medium">{employer.name}</span>
                          {(employer.city || employer.fromYear || employer.toYear) && (
                            <span className="block text-muted-foreground">
                              {[employer.city, period(employer.fromYear, employer.toYear)]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </dd>
                ) : (
                  <dd className="text-sm text-muted-foreground">{t("noEmployer")}</dd>
                )}
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">{t("mandate")}</p>
            <p className="text-sm text-muted-foreground">{t("free")}</p>
          </section>
        </div>
      )}
    </div>
  );
}
export function PensionSearchPage() {
  return <IdentityBoundary>{(identity) => <Search identity={identity} />}</IdentityBoundary>;
}
