import { useState } from "react";
import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowUpRight, Plus } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { InsuranceRequest } from "@coverview/contracts/insurance-requests";
import type { LeadSummary } from "@coverview/contracts/partner";
import { Button, EmptyState, ErrorState, LoadingState, RequestProgress } from "@coverview/ui";
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
import { useWalletLiveUpdates } from "../features/offers/use-live-updates";
import { timeline } from "../features/offers/request-timeline";
import { numberFormat } from "@coverview/ui/number-format";
const stages = ["submitted", "reviewing", "insurer_contacted", "offer_ready", "completed"] as const;
const amount = (minor: number) =>
  numberFormat("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
const card =
  "flex h-full w-full flex-col gap-2 rounded-xl border border-border p-5 text-left hover:bg-muted";
type Entry =
  | { kind: "lead"; id: string; at: number; lead: LeadSummary }
  | { kind: "comparator"; id: string; at: number; request: InsuranceRequest };
// The client's requests (8 October 2026): those sent to CoverView from Wallet, opened in the same
// request window as the offers, and those made from the health comparator, in one list.
function Requests({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("insuranceRequests");
  const { requestId } = useParams({ strict: false });
  const { filter, scope } = useWalletProfileScope();
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const client = useQueryClient();
  const [create, setCreate] = useState(false);
  useWalletLiveUpdates(identity);
  const leadsKey = walletLeadsKey(identity, scope);
  const requestsKey = ["private", identity.user.id, identity.session.id, "insurance-requests"];
  const leads = useInfiniteQuery({
    queryKey: [...leadsKey, "requests"],
    queryFn: ({ pageParam, signal }) =>
      partnerApi.list(
        {
          view: "all",
          ...(scope === "all" ? {} : { clientProfileId: scope }),
          ...(pageParam ? { cursor: pageParam } : {}),
        },
        signal,
        true,
      ),
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !requestId,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15000,
    retry: false,
  });
  const comparator = useInfiniteQuery({
    queryKey: [...requestsKey, scope],
    queryFn: async ({ pageParam, signal }) => {
      await insuranceApi.browser(signal);
      return insuranceApi.list({ ...filter, ...(pageParam ? { cursor: pageParam } : {}) }, signal);
    },
    initialPageParam: "",
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: !requestId,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => (query.state.status === "error" ? false : 15000),
    refetchIntervalInBackground: false,
  });
  const detail = useQuery({
    queryKey: [...requestsKey, "detail", requestId],
    queryFn: async ({ signal }) => {
      await insuranceApi.browser(signal);
      return insuranceApi.get(requestId!, signal);
    },
    enabled: !!requestId,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => (query.state.status === "error" ? false : 15000),
    refetchIntervalInBackground: false,
  });
  // Both sources are ordered by creation date: one list, newest first.
  const entries = timeline<Entry>([
    {
      items: (leads.data?.pages ?? [])
        .flatMap((page) => page.items)
        .map((lead): Entry => ({
          kind: "lead",
          id: lead.id,
          at: Date.parse(lead.createdAt),
          lead,
        })),
      more: leads.hasNextPage,
    },
    {
      items: (comparator.data?.pages ?? [])
        .flatMap((page) => page.requests)
        .map((request): Entry => ({
          kind: "comparator",
          id: request.id,
          at: Date.parse(request.createdAt),
          request,
        })),
      more: comparator.hasNextPage,
    },
  ]);
  // The request window is driven by the address, as on the offers page.
  const show = (lead?: string, section?: LeadSection) =>
    void navigate({
      to: "/insurance-requests",
      search: (previous) => requestSearch(previous, lead, section),
    });
  const open = (
    <span className="mt-auto inline-flex items-center gap-2 pt-1 text-sm">
      {t("openRequest")}
      <ArrowUpRight className="size-4" aria-hidden="true" />
    </span>
  );
  const selected = detail.data;
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="cv-app-heading">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
        {!requestId && (
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" aria-hidden="true" />
            {t("newRequest")}
          </Button>
        )}
      </header>
      {requestId ? (
        <>
          <Link className="text-sm underline" to="/insurance-requests">
            {t("backLink")}
          </Link>
          {detail.isPending ? (
            <LoadingState label={t("loading")} />
          ) : detail.isError ? (
            <ErrorState
              title={t("error")}
              description=""
              retryLabel={t("retry")}
              pendingLabel={t("loading")}
              onRetry={() => void detail.refetch()}
            />
          ) : (
            selected && (
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
                          deductible: numberFormat("fr-CH").format(item.deductible),
                          accident: t(item.accident ? "included" : "excluded"),
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("sexValue", { value: t(`sex.${item.sex}`) })}
                        {t("separator")}
                        {t("currentInsurerValue", {
                          name:
                            item.currentInsurerBrand ?? item.currentInsurerName ?? t("notProvided"),
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
            )
          )}
        </>
      ) : leads.isPending || comparator.isPending ? (
        <LoadingState label={t("loading")} />
      ) : leads.isError || comparator.isError ? (
        <ErrorState
          title={t("error")}
          description=""
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => {
            if (leads.isError) void leads.refetch();
            if (comparator.isError) void comparator.refetch();
          }}
        />
      ) : entries.items.length ? (
        <section className="space-y-4" aria-label={t("title")}>
          <ul className="grid gap-3 md:grid-cols-2">
            {entries.items.map((entry) => (
              <li key={entry.id}>
                {entry.kind === "lead" ? (
                  <button type="button" className={card} onClick={() => show(entry.lead.id)}>
                    <span className="font-medium">{entry.lead.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {entry.lead.stage === "completed"
                        ? t("closed")
                        : entry.lead.responsibleName
                          ? t("followedBy", { name: entry.lead.responsibleName })
                          : t("assigning")}
                    </span>
                    {open}
                  </button>
                ) : (
                  <Link
                    className={card}
                    to="/insurance-requests/$requestId"
                    params={{ requestId: entry.request.id }}
                  >
                    <span className="font-medium">{t("comparatorTitle")}</span>
                    <span className="text-sm text-muted-foreground">
                      {entry.request.items
                        .map((person) => `${person.firstName} ${person.lastName}`)
                        .join(", ")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t("statusAmount", {
                        state: t(`states.${entry.request.state}`),
                        amount: amount(entry.request.totalMonthlyMinor),
                      })}
                    </span>
                    {open}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {entries.more && (
            <Button
              variant="outline"
              disabled={leads.isFetchingNextPage || comparator.isFetchingNextPage}
              onClick={() => {
                if (leads.hasNextPage) void leads.fetchNextPage();
                if (comparator.hasNextPage) void comparator.fetchNextPage();
              }}
            >
              {t("loadMore")}
            </Button>
          )}
        </section>
      ) : (
        <EmptyState title={t("noRequests")} description={t("noRequestsDescription")} />
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
        onCreated={() => void client.invalidateQueries({ queryKey: leadsKey })}
      />
    </div>
  );
}
export function InsuranceRequestsPage() {
  return <IdentityBoundary>{(identity) => <Requests identity={identity} />}</IdentityBoundary>;
}
