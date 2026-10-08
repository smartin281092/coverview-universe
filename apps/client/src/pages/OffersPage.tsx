import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowUpRight } from "lucide-react";
import type { IdentityMe } from "@coverview/api-client";
import type { LeadOffer } from "@coverview/api-client/partner";
import { EmptyState, ErrorState, LoadingState } from "@coverview/ui";
import { partnerApi } from "../partner-api";
import { IdentityBoundary } from "../features/identity/IdentityBoundary";
import { useWalletProfileScope } from "../features/profile/use-wallet-profile-scope";
import { LeadWorkspace, requestSearch, walletLeadsKey } from "../features/offers/LeadWorkspace";
import { OfferCard, type OfferAction } from "../features/offers/OfferCard";
import { OfferSourcePreview } from "../features/offers/OfferSourcePreview";
import { offerGroups } from "../features/offers/offer-groups";
import { useWalletLiveUpdates } from "../features/offers/use-live-updates";

// The offers the advisor transmitted, as cards grouped by object (8 October 2026). Choosing
// opens the request window on the choice; the original opens in the in-app preview.
function Offers({ identity }: { identity: IdentityMe }) {
  const { t } = useTranslation("offers"),
    { scope } = useWalletProfileScope(),
    search = useSearch({ from: "/offers" }),
    navigate = useNavigate({ from: "/offers" });
  const [intent, setIntent] = useState<{ offerId: string; type: OfferAction } | null>(null);
  const [preview, setPreview] = useState<{ leadId: string; offer: LeadOffer } | null>(null);
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
      ) : !list.data ? (
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
        <div className="space-y-10">
          {offerGroups(list.data.items).map((group) => {
            const first = group[0]!.lead;
            return (
              <section
                key={first.id}
                className="space-y-4"
                aria-label={first.object || first.title}
              >
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{first.object || first.title}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t(`categories.${first.category}`)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {group.map(({ lead }) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="inline-flex min-h-11 items-center gap-1 text-sm underline underline-offset-4"
                        onClick={() => open(lead.id)}
                      >
                        {group.length > 1 ? lead.title : t("workspace.viewRequest")}
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.flatMap(({ lead, offers }) =>
                    offers.map((offer) => (
                      <OfferCard
                        key={offer.id}
                        leadId={lead.id}
                        offer={offer}
                        onAction={(type) => {
                          setIntent({ offerId: offer.id, type });
                          open(lead.id);
                        }}
                        onPreview={() => setPreview({ leadId: lead.id, offer })}
                      />
                    )),
                  )}
                </div>
              </section>
            );
          })}
          {list.data.truncated && (
            <p className="text-sm text-muted-foreground">{t("workspace.truncated")}</p>
          )}
        </div>
      )}
      {preview && (
        <OfferSourcePreview
          key={`${identity.user.id}:${identity.session.id}:${preview.offer.id}`}
          identity={identity}
          leadId={preview.leadId}
          offer={preview.offer}
          onClose={() => setPreview(null)}
        />
      )}
      <LeadWorkspace
        identity={identity}
        leadId={search.lead ?? null}
        section={search.section}
        intent={intent}
        onIntentDone={() => setIntent(null)}
        onClose={() => {
          setIntent(null);
          void navigate({ search: (previous) => requestSearch(previous) });
        }}
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
