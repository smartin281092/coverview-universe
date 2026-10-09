import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import type { IdentityMe } from "@coverview/api-client";
import { PartnerApiError } from "@coverview/api-client/partner";
import type { LeadCommand, LeadDetail, FinalPolicy } from "@coverview/contracts/partner";
import {
  Button,
  VersionHistoryDialog,
  PolicyEvidence,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { partnerApi } from "../../partner-api";
import { FinalPolicyLinkDialog } from "./FinalPolicyLinkDialog";
import { numberFormat } from "../../number-format";

export function FinalPoliciesDialog({
  lead,
  identity,
  onClose,
  onSaved,
}: {
  lead: LeadDetail;
  identity: IdentityMe;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, i18n } = useTranslation("offers");
  const tr = (key: string, values: Record<string, unknown> = {}) => t(`policy.${key}`, values);
  const [pages, setPages] = useState<(string | undefined)[]>([undefined]),
    [link, setLink] = useState(false);
  const [withdraw, setWithdraw] = useState<{ policy: FinalPolicy; revision: number } | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [blocked, setBlocked] = useState(false);
  const attempt = useRef<{ input: LeadCommand; key: string } | null>(null);
  const cursor = pages.at(-1);
  const query = useQuery({
    queryKey: ["private", identity.user.id, identity.session.id, "final-policies", lead.id, cursor],
    queryFn: ({ signal }) => partnerApi.finalPolicies(lead.id, cursor, signal, true),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchInterval: 10000,
  });
  const money = (value: number | null) =>
    value === null
      ? tr("missing")
      : numberFormat(i18n.language, { style: "currency", currency: "CHF" }).format(value / 100);
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeZone: "Europe/Zurich",
    }).format(new Date(value));
  const saved = () => {
    onSaved();
    void query.refetch();
  };
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
          empty: tr("empty"),
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
        actions={
          <Button onClick={() => setLink(true)} disabled={query.isPending || query.isError}>
            {tr("link")}
          </Button>
        }
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
              {policy.offer.sourceStatus === "current" && (
                <Button asChild variant="outline">
                  <a href={partnerApi.sourceUrl(lead.id, policy.offer.id, true)}>
                    {tr("offerSource")}
                  </a>
                </Button>
              )}
              {policy.canDownload && (
                <>
                  <Button asChild variant="outline">
                    <a href={partnerApi.finalPolicySourceUrl(lead.id, policy.id, true)}>
                      {tr("policySource")}
                    </a>
                  </Button>
                  <Button asChild variant="outline">
                    <Link
                      to="/documents/$documentId"
                      params={{ documentId: policy.documentId }}
                      search={{ profile: lead.clientProfileId ?? "self" }}
                    >
                      {tr("walletDocument")}
                    </Link>
                  </Button>
                </>
              )}
              {policy.active && (
                <Button
                  variant="outline"
                  onClick={() => {
                    attempt.current = null;
                    setError("");
                    setBlocked(false);
                    setWithdraw({ policy, revision: query.data!.leadRevision });
                  }}
                >
                  {tr("withdraw")}
                </Button>
              )}
            </PolicyEvidence>
          ),
        }))}
      />
      {link && !query.isError && (
        <FinalPolicyLinkDialog
          lead={{ ...lead, revision: query.data?.leadRevision ?? lead.revision }}
          identity={identity}
          onClose={() => setLink(false)}
          onSaved={saved}
        />
      )}
      {withdraw && !query.isError && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !pending) setWithdraw(null);
          }}
        >
          <DialogContent closeLabel={tr("close")} showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>{tr("withdraw")}</DialogTitle>
              <DialogDescription>{tr("withdrawHelp")}</DialogDescription>
            </DialogHeader>
            <p>{tr("offer", withdraw.policy.offer)}</p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              disabled={pending || blocked}
              onClick={() => {
                attempt.current ??= {
                  input: {
                    action: "final_policy_unlink",
                    revision: withdraw.revision,
                    policyId: withdraw.policy.id,
                  },
                  key: crypto.randomUUID(),
                };
                setPending(true);
                setError("");
                void partnerApi
                  .command(
                    lead.id,
                    attempt.current.input,
                    { csrfToken: identity.csrfToken, idempotencyKey: attempt.current.key },
                    true,
                  )
                  .then(() => {
                    saved();
                    setWithdraw(null);
                  })
                  .catch((cause) => {
                    const block =
                      cause instanceof PartnerApiError && cause.status >= 400 && cause.status < 500;
                    setBlocked(block);
                    setError(tr(block ? "conflict" : "retryExact"));
                  })
                  .finally(() => setPending(false));
              }}
            >
              {tr(pending ? "saving" : "confirmWithdraw")}
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
