import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { IdentityMe } from "@coverview/api-client";
import { Button, EmptyState, ErrorState, LoadingState, RequestProgress } from "@coverview/ui";
import { insuranceApi } from "../insurance-api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { useWalletProfileScope } from "../features/profile/use-wallet-profile-scope";
import { InsuranceLeadAction } from "../features/offers/InsuranceLeadAction";
const stages = ["submitted", "reviewing", "insurer_contacted", "offer_ready", "completed"] as const;
const amount = (minor: number) =>
  new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    minor / 100,
  );
function Requests({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("insuranceRequests");
  const { requestId } = useParams({ strict: false });
  const { filter, scope } = useWalletProfileScope();
  const [cursor, setCursor] = useState<string | undefined>();
  useEffect(() => setCursor(undefined), [scope]);
  const query = useQuery({
    queryKey: [
      "private",
      identity.user.id,
      identity.session.id,
      "insurance-requests",
      requestId,
      scope,
      cursor,
    ],
    queryFn: async ({ signal }) => {
      await insuranceApi.browser(signal);
      return requestId
        ? { requests: [await insuranceApi.get(requestId, signal)], nextCursor: null }
        : insuranceApi.list({ ...filter, ...(cursor ? { cursor } : {}) }, signal);
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => (query.state.status === "error" ? false : 15000),
    refetchIntervalInBackground: false,
  });
  const selected = requestId ? query.data?.requests[0] : null;
  return (
    <div className="space-y-8">
      <header>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      {requestId && (
        <Link className="text-sm underline" to="/insurance-requests">
          {t("backLink")}
        </Link>
      )}
      {query.isPending ? (
        <LoadingState label={t("loading")} />
      ) : query.isError ? (
        <ErrorState
          title={t("error")}
          description=""
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void query.refetch()}
        />
      ) : selected ? (
        <>
          <p className="break-all text-xs text-muted-foreground">{selected.id}</p>
          {selected.state === "cancelled" && <p>{t("states.cancelled")}</p>}
          <RequestProgress
            current={Math.max(
              0,
              ...selected.history.map((event) =>
                stages.indexOf(event.state as (typeof stages)[number]),
              ),
            )}
            cancelled={selected.state === "cancelled"}
            complete={selected.state === "completed"}
            steps={stages.map((state) => ({
              label: t(`states.${state}`),
              description: t(`descriptions.${state}`),
              at: selected.history.find((event) => event.state === state)?.at,
            }))}
          />
          <ul className="divide-y divide-border">
            {selected.items.map((item) => (
              <li key={item.id} className="space-y-3 py-5">
                <div className="flex justify-between gap-4">
                  <strong className="font-medium">
                    {item.firstName} {item.lastName}
                  </strong>
                  <span>
                    {amount(item.offer.monthlyPremiumMinor)} {t("amount")}
                  </span>
                </div>
                <p className="text-sm">
                  {t("product", {
                    insurer: item.offer.insurerBrand ?? item.offer.insurerName,
                    model: item.offer.name,
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("configuration", {
                    year: item.birthYear,
                    postalCode: item.locality.postalCode,
                    locality: item.locality.locality,
                    deductible: item.deductible,
                    accident: t(item.accident ? "included" : "excluded"),
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("sexValue", { value: t(`sex.${item.sex}`) })}
                  {t("separator")}
                  {t("currentInsurerValue", {
                    name: item.currentInsurerBrand ?? item.currentInsurerName ?? t("notProvided"),
                  })}
                </p>
                {item.profileId && (
                  <Link
                    className="text-sm underline"
                    to="/profile"
                    search={{ person: item.profileId, profile: item.profileId }}
                  >
                    {t("profile")}
                  </Link>
                )}
                <div>
                  <InsuranceLeadAction
                    key={`${selected.id}:${item.id}:${identity.session.id}`}
                    identity={identity}
                    requestId={selected.id}
                    personId={item.id}
                    profileId={item.profileId}
                    name={`${item.firstName} ${item.lastName}`}
                  />
                </div>
              </li>
            ))}
          </ul>
          <p className="text-lg">
            {t("totalAmount", { amount: amount(selected.totalMonthlyMinor) })}
          </p>
          <p className="text-sm text-muted-foreground">{t("notContract")}</p>
        </>
      ) : query.data?.requests.length ? (
        <ul className="divide-y divide-border">
          {query.data.requests.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <p className="font-medium">
                  {item.items.map((person) => `${person.firstName} ${person.lastName}`).join(", ")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("statusAmount", {
                    state: t(`states.${item.state}`),
                    amount: amount(item.totalMonthlyMinor),
                  })}
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/insurance-requests/$requestId" params={{ requestId: item.id }}>
                  {t("details")}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={t("empty")} description="" />
      )}
      {!requestId && (cursor || query.data?.nextCursor) && (
        <nav className="flex gap-3">
          <Button
            variant="outline"
            disabled={!cursor || query.isFetching}
            onClick={() => setCursor(undefined)}
          >
            {t("previous")}
          </Button>
          <Button
            disabled={!query.data?.nextCursor || query.isFetching}
            onClick={() => setCursor(query.data?.nextCursor ?? undefined)}
          >
            {t("next")}
          </Button>
        </nav>
      )}
    </div>
  );
}
export function InsuranceRequestsPage() {
  return <IdentityBoundary>{(identity) => <Requests identity={identity} />}</IdentityBoundary>;
}
