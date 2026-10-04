import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { FinalPolicy } from "@coverview/contracts/partner";
import { Button, VersionHistoryDialog, PolicyEvidence } from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { FinalPolicyReviewDialog } from "./FinalPolicyReviewDialog";

export function FinalPoliciesDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation(),
    session = usePartner(),
    client = useQueryClient();
  const tr = (key: string, values: Record<string, unknown> = {}) => t(`policy.${key}`, values);
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]),
    [review, setReview] = useState<{ policy: FinalPolicy; revision: number } | null>(null);
  const cursor = pages.at(-1);
  const query = useQuery({
    queryKey: [...session.queryKey, "final-policies", leadId, cursor],
    queryFn: ({ signal }) => partnerApi.finalPolicies(leadId, cursor, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const money = (value: number | null) =>
    value === null
      ? tr("missing")
      : new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CHF" }).format(
          value / 100,
        );
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  return (
    <>
      <VersionHistoryDialog
        title={tr("title")}
        description={tr("description")}
        labels={{
          close: tr("close"),
          loading: tr("loading"),
          error: tr("error"),
          retry: tr("retry"),
          empty: tr("emptyPartner"),
          next: tr("next"),
          previous: tr("previous"),
          details: tr("details"),
        }}
        loading={query.isPending}
        error={query.isError}
        hasNext={!!query.data?.nextCursor}
        hasPrevious={pages.length > 1}
        onNext={() => {
          if (query.data?.nextCursor) setPages([...pages, query.data.nextCursor]);
        }}
        onPrevious={() => setPages(pages.slice(0, -1))}
        onRetry={() => void query.refetch()}
        onClose={onClose}
        items={(query.data?.items ?? []).map((policy) => ({
          id: policy.id,
          title: tr("offer", policy.offer),
          caption: tr("caption", {
            date: date(policy.linkedAt),
            status: tr(`status.${policy.status}`),
          }),
          body: (
            <PolicyEvidence
              status={tr(`reviewState.${policy.reviewState}`)}
              notice={tr("conclusionProofs", {
                signature: tr(`signatureProof.${policy.signatureEvidence}`),
                insurer: tr(`insurerProof.${policy.insurerAcceptanceEvidence}`),
              })}
              calculation={tr("calculation", { factor: policy.premium.factor ?? tr("missing") })}
              facts={[
                {
                  label: tr("policyNumber"),
                  value: policy.source?.contract.policyNumber ?? tr("missing"),
                },
                {
                  label: tr("dates"),
                  value: tr("dateRange", {
                    start: policy.source?.contract.startsOn
                      ? date(policy.source.contract.startsOn + "T12:00:00Z")
                      : tr("missing"),
                    end: policy.source?.contract.endsOn
                      ? date(policy.source.contract.endsOn + "T12:00:00Z")
                      : tr("missing"),
                  }),
                },
                { label: tr("offerPremium"), value: money(policy.premium.offerAnnualMinor) },
                { label: tr("policyPremium"), value: money(policy.premium.policyAnnualMinor) },
                { label: tr("difference"), value: money(policy.premium.differenceMinor) },
                {
                  label: tr("reviewVersion"),
                  value: policy.review
                    ? tr("reviewStamp", {
                        version: policy.review.version,
                        date: date(policy.review.reviewedAt),
                      })
                    : tr("missing"),
                },
              ]}
              checks={(policy.review?.checks ?? []).map((check) => ({
                label: tr(`fields.${check.field}`),
                result: tr(`results.${check.result}`),
                note: check.note,
                citations: (["offerSource", "policySource"] as const).flatMap((side) =>
                  check[side]
                    ? [
                        tr("citation", {
                          source: tr(side),
                          page: check[side].page,
                          quote: check[side].quote,
                        }),
                      ]
                    : [],
                ),
              }))}
            >
              {policy.missingChecks.length > 0 && (
                <p className="w-full text-sm">
                  {tr("missingChecks", {
                    fields: new Intl.ListFormat(i18n.language).format(
                      policy.missingChecks.map((field) => tr(`fields.${field}`)),
                    ),
                  })}
                </p>
              )}
              {!policy.offer.active && (
                <p className="w-full text-sm text-muted-foreground">{tr("historicalOffer")}</p>
              )}
              {policy.canDownload && (
                <Button asChild variant="outline">
                  <a href={partnerApi.finalPolicySourceUrl(leadId, policy.id)}>
                    {tr("policySource")}
                  </a>
                </Button>
              )}
              {policy.offer.sourceStatus === "current" && (
                <Button asChild variant="outline">
                  <a href={partnerApi.sourceUrl(leadId, policy.offer.id)}>{tr("offerSource")}</a>
                </Button>
              )}
              {policy.canReview && (
                <Button onClick={() => setReview({ policy, revision: query.data!.leadRevision })}>
                  {tr("review")}
                </Button>
              )}
            </PolicyEvidence>
          ),
        }))}
      />
      {review &&
        !query.isError &&
        query.data?.items.some((policy) => policy.id === review.policy.id && policy.canReview) && (
          <FinalPolicyReviewDialog
            leadId={leadId}
            policy={review.policy}
            revision={review.revision}
            onClose={() => setReview(null)}
            onSaved={() => {
              void client.invalidateQueries({ queryKey: session.queryKey });
            }}
          />
        )}
    </>
  );
}
