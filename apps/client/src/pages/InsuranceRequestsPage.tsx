import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Ellipsis, Plus } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  LoadingState,
  RequestProgress,
} from "@coverview/ui";
import { insuranceApi } from "../insurance-api";
import { partnerApi } from "../partner-api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { useWalletProfileScope } from "../features/profile/use-wallet-profile-scope";
import { InsuranceLeadAction } from "../features/offers/InsuranceLeadAction";
import {
  LeadWorkspace,
  requestSearch,
  walletLeadsKey,
  type LeadSection,
} from "../features/offers/LeadWorkspace";
import { NewRequestDialog } from "../features/offers/NewRequestDialog";
import { ReferentsDialog } from "../features/offers/ReferentsDialog";
import { CoordinatedBookingsDialog } from "../features/offers/CoordinatedBookingsDialog";
import { useWalletLiveUpdates } from "../features/offers/use-live-updates";
const stages = ["submitted", "reviewing", "insurer_contacted", "offer_ready", "completed"] as const;
const amount = (minor: number) =>
  new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    minor / 100,
  );
// The client's requests (8 October 2026): those sent to CoverView from Wallet, followed in the
// same request window as the offers, and those made from the health comparator.
function Requests({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("insuranceRequests");
  const { requestId } = useParams({ strict: false });
  const { filter, scope } = useWalletProfileScope();
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const client = useQueryClient();
  const [cursor, setCursor] = useState<string | undefined>();
  const [create, setCreate] = useState(false);
  const [referents, setReferents] = useState(false);
  const [coordination, setCoordination] = useState(false);
  useEffect(() => setCursor(undefined), [scope]);
  useWalletLiveUpdates(identity);
  const leadsKey = walletLeadsKey(identity, scope);
  const leads = useQuery({
    queryKey: [...leadsKey, "requests"],
    queryFn: ({ signal }) =>
      partnerApi.list(
        { view: "all", ...(scope === "all" ? {} : { clientProfileId: scope }) },
        signal,
        true,
      ),
    enabled: !requestId,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15000,
    retry: false,
  });
  // The request window is driven by the address, as on the offers page.
  const show = (lead?: string, section?: LeadSection) =>
    void navigate({
      to: "/insurance-requests",
      search: (previous) => requestSearch(previous, lead, section),
    });
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
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="cv-app-heading">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        {!requestId && (
          <div className="flex items-center gap-2">
            <Button onClick={() => setCreate(true)}>
              <Plus className="size-4" aria-hidden="true" />
              {t("newRequest")}
            </Button>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" aria-label={t("more")}>
                  <Ellipsis className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem asChild>
                  <Link
                    to="/offers/notifications"
                    search={{
                      status: "all",
                      ...(scope === "all" ? {} : { clientProfileId: scope }),
                    }}
                  >
                    {t("notifications")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setReferents(true)}>
                  {t("referents")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCoordination(true)}>
                  {t("coordination")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </header>
      {!requestId && (
        <section className="space-y-4" aria-labelledby="wallet-requests">
          <h2 id="wallet-requests" className="text-lg font-medium">
            {t("myRequests")}
          </h2>
          {leads.isPending ? (
            <LoadingState label={t("loading")} />
          ) : leads.isError ? (
            <ErrorState
              title={t("error")}
              description=""
              retryLabel={t("retry")}
              pendingLabel={t("loading")}
              onRetry={() => void leads.refetch()}
            />
          ) : leads.data.items.length ? (
            <ul className="grid gap-3 md:grid-cols-2">
              {leads.data.items.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-2 rounded-xl border border-border p-5 text-left hover:bg-muted"
                    onClick={() => show(lead.id)}
                  >
                    <span className="font-medium">{lead.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {lead.stage === "completed"
                        ? t("closed")
                        : lead.responsibleName
                          ? t("followedBy", { name: lead.responsibleName })
                          : t("assigning")}
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm">
                      {t("openRequest")}
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={t("noRequests")} description={t("noRequestsDescription")} />
          )}
          <h2 className="pt-4 text-lg font-medium">{t("comparatorRequests")}</h2>
        </section>
      )}
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
      <LeadWorkspace
        identity={identity}
        leadId={search.lead ?? null}
        section={search.section}
        onClose={() => show(undefined, undefined)}
        onSectionDone={() => show(search.lead, undefined)}
      />
      <NewRequestDialog
        identity={identity}
        open={create}
        onClose={() => setCreate(false)}
        onCreated={(id) => {
          void client.invalidateQueries({ queryKey: leadsKey });
          show(id);
        }}
      />
      {referents && (
        <ReferentsDialog
          identity={identity}
          initialProfile={scope}
          onClose={() => setReferents(false)}
        />
      )}
      {coordination && (
        <CoordinatedBookingsDialog
          key={`${identity.user.id}:${identity.session.id}:${scope}`}
          identity={identity}
          scope={scope}
          onClose={() => setCoordination(false)}
        />
      )}
    </div>
  );
}
export function InsuranceRequestsPage() {
  return <IdentityBoundary>{(identity) => <Requests identity={identity} />}</IdentityBoundary>;
}
