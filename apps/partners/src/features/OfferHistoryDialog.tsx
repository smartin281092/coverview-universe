import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { VersionHistoryDialog, Button } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
export function OfferHistoryDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const session = usePartner();
  const root = session.queryKey;
  const { t, i18n } = useTranslation();
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]);
  const cursor = pages.at(-1);
  const history = useQuery({
    queryKey: [...root, "offer-history", leadId, cursor],
    queryFn: ({ signal }) => partnerApi.offerHistory(leadId, cursor, signal, false),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  return (
    <VersionHistoryDialog
      title={t("history.title")}
      description={t("history.description")}
      labels={{
        close: t("history.close"),
        loading: t("history.loading"),
        error: t("history.error"),
        retry: t("history.retry"),
        empty: t("history.empty"),
        next: t("history.next"),
        previous: t("history.previous"),
        details: t("history.details"),
      }}
      loading={history.isPending}
      error={history.isError}
      hasNext={!!history.data?.nextCursor}
      hasPrevious={pages.length > 1}
      onNext={() => {
        if (history.data?.nextCursor) setPages([...pages, history.data.nextCursor]);
      }}
      onPrevious={() => setPages(pages.slice(0, -1))}
      onRetry={() => void history.refetch()}
      onClose={onClose}
      items={(history.data?.items ?? []).map((offer) => ({
        id: offer.id,
        title: t("history.heading", {
          company: offer.company,
          product: offer.product,
          version: offer.version,
        }),
        caption: t("history.caption", {
          state: t("history.states." + offer.state),
          date: date(offer.createdAt),
        }),
        body: (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("history.readOnly")}</p>
            <p>{t("history.sourceStatus." + (offer.sourceStatus ?? "unbound"))}</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t("history.premium")}</dt>
                <dd>
                  {offer.annualPremiumMinor === null
                    ? t("history.missing")
                    : new Intl.NumberFormat(i18n.language, {
                        style: "currency",
                        currency: offer.currency,
                      }).format(offer.annualPremiumMinor / 100)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("history.reference")}</dt>
                <dd>{offer.reference || t("history.missing")}</dd>
              </div>
              {offer.reviewedAt && (
                <div>
                  <dt className="text-muted-foreground">{t("history.reviewed")}</dt>
                  <dd>{date(offer.reviewedAt)}</dd>
                </div>
              )}
              {offer.publishedAt && (
                <div>
                  <dt className="text-muted-foreground">{t("history.published")}</dt>
                  <dd>{date(offer.publishedAt)}</dd>
                </div>
              )}
              {offer.validUntil && (
                <div>
                  <dt className="text-muted-foreground">{t("history.validUntil")}</dt>
                  <dd>{date(offer.validUntil)}</dd>
                </div>
              )}
              {offer.effectiveDate && (
                <div>
                  <dt className="text-muted-foreground">{t("history.effectiveDate")}</dt>
                  <dd>{date(offer.effectiveDate + "T12:00:00Z")}</dd>
                </div>
              )}
            </dl>
            {offer.summary && <p className="whitespace-pre-wrap text-sm">{offer.summary}</p>}
            {offer.limitations && (
              <p className="whitespace-pre-wrap text-sm">
                {t("history.limitations", { text: offer.limitations })}
              </p>
            )}
            <ul className="space-y-3">
              {offer.features.map((feature, index) => (
                <li key={index} className="space-y-2 rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">{feature.label}</p>
                  <p>{feature.value || t("history.missing")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("history.verification." + feature.verification)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("history.origin." + feature.origin)}
                  </p>
                  {feature.conditions && (
                    <p>{t("history.conditions", { text: feature.conditions })}</p>
                  )}
                  {feature.exclusions && (
                    <p>{t("history.exclusions", { text: feature.exclusions })}</p>
                  )}
                  {feature.source && (
                    <blockquote className="border-l-2 border-border pl-3">
                      {t("history.quote", {
                        page: feature.sourcePage ?? t("history.missing"),
                        quote: feature.source,
                      })}
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
            {offer.canDownload && (
              <Button asChild variant="outline">
                <a href={partnerApi.sourceUrl(leadId, offer.id, false)}>{t("history.source")}</a>
              </Button>
            )}
          </div>
        ),
      }))}
    />
  );
}
