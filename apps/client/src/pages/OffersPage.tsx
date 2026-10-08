import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FileText } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { WalletOffers } from "@coverview/contracts/partner-wallet-offers";
import { Button, EmptyState, ErrorState, LoadingState } from "@coverview/ui";
import { partnerApi } from "../partner-api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { useWalletProfileScope } from "../features/profile/use-wallet-profile-scope";
import { LeadWorkspace, requestSearch, walletLeadsKey } from "../features/offers/LeadWorkspace";
import { useWalletLiveUpdates } from "../features/offers/use-live-updates";

const money = (minor: number) =>
  new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF" }).format(minor / 100);
const day = (value: string) =>
  new Intl.DateTimeFormat("fr-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(
    new Date(value),
  );
type Item = WalletOffers["items"][number];
// Requests about the same object (same category and object, case aside) share one block.
function grouped(items: Item[]) {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const object = item.lead.object.trim().toLowerCase();
    const key = object ? `${item.lead.category}:${object}` : item.lead.id;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()];
}

// The offers the advisor transmitted, with their documents, grouped by object.
function Offers({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("offers"),
    { scope } = useWalletProfileScope(),
    search = useSearch({ from: "/offers" }),
    navigate = useNavigate({ from: "/offers" });
  useWalletLiveUpdates(identity);
  const list = useQuery({
    queryKey: [...walletLeadsKey(identity, scope), "offers"],
    queryFn: ({ signal }) =>
      partnerApi.walletOffers(scope === "all" ? {} : { clientProfileId: scope }, signal),
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 15000,
    retry: false,
  });
  const open = (lead: string) =>
    void navigate({ search: (previous) => requestSearch(previous, lead) });
  return (
    <>
      <header>
        <h1 className="cv-app-heading">{t("title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("workspace.pageDescription")}</p>
      </header>
      {list.isPending ? (
        <LoadingState label={t("loading")} />
      ) : list.isError ? (
        <ErrorState
          title={t("error")}
          description={t("error")}
          retryLabel={t("retry")}
          pendingLabel={t("loading")}
          onRetry={() => void list.refetch()}
        />
      ) : !list.data.items.length ? (
        <EmptyState
          title={t("workspace.pageEmpty")}
          description={t("workspace.pageEmptyDescription")}
        />
      ) : (
        <div className="space-y-6">
          {grouped(list.data.items).map((group) => {
            const first = group[0]!.lead;
            return (
              <section
                key={first.id}
                className="space-y-4 rounded-xl border border-border p-5"
                aria-label={first.object || first.title}
              >
                <div>
                  <h2 className="font-semibold">{first.object || first.title}</h2>
                  <p className="text-sm text-muted-foreground">
                    {t(`categories.${first.category}`)}
                  </p>
                </div>
                <ul className="divide-y divide-border">
                  {group.flatMap(({ lead, offers }) =>
                    offers.map((offer) => (
                      <li
                        key={offer.id}
                        className="flex flex-wrap items-center justify-between gap-4 py-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-muted-foreground">{offer.company}</p>
                          <p className="font-medium">{offer.product}</p>
                          <p className="text-sm">
                            {offer.annualPremiumMinor === null
                              ? t("missing")
                              : `${money(offer.annualPremiumMinor)} ${t("workspace.perYear")}`}
                            {offer.validUntil &&
                              ` · ${t("workspace.validUntil", { date: day(offer.validUntil) })}`}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {offer.canDownload && (
                            <Button variant="outline" asChild>
                              <a href={partnerApi.sourceUrl(lead.id, offer.id, true)}>
                                <FileText className="size-4" aria-hidden="true" />
                                {t("source")}
                              </a>
                            </Button>
                          )}
                          <Button onClick={() => open(lead.id)}>
                            {t("workspace.openRequest")}
                          </Button>
                        </div>
                      </li>
                    )),
                  )}
                </ul>
              </section>
            );
          })}
          {list.data.truncated && (
            <p className="text-sm text-muted-foreground">{t("workspace.truncated")}</p>
          )}
        </div>
      )}
      <LeadWorkspace
        identity={identity}
        leadId={search.lead ?? null}
        section={search.section}
        onClose={() => void navigate({ search: (previous) => requestSearch(previous) })}
        onSectionDone={() =>
          void navigate({ search: (previous) => requestSearch(previous, previous.lead) })
        }
      />
    </>
  );
}
export function OffersPage() {
  return <IdentityBoundary>{(identity) => <Offers identity={identity} />}</IdentityBoundary>;
}
