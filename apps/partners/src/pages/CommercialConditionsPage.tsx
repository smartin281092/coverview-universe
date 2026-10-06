import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@coverview/ui";
import { commercialReviewSchema } from "@coverview/contracts/partner-economy";
import { usePartner } from "../features/PartnerSession";
import { partnerApi } from "../api";
import { CommercialEditor } from "../features/CommercialEditor";
import { EconomyForm, value } from "../features/EconomyForm";
import {
  TermsView,
  EconomyLoading,
  EconomyPages,
  economyQueryPolicy,
  useEconomyFormat,
} from "../features/EconomyViews";
export function CommercialConditionsPage() {
  const { t } = useTranslation("economy"),
    session = usePartner(),
    f = useEconomyFormat();
  const [cursor, setCursor] = useState<string>(),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<string>(),
    [decision, setDecision] = useState<{
      id: string;
      decision: "approve" | "reject" | "withdraw";
    }>();
  const query = useQuery({
    queryKey: [...session.queryKey, "commercial", cursor],
    queryFn: ({ signal }) => partnerApi.commercialConditions(cursor, signal),
    ...economyQueryPolicy,
  });
  const data = query.isError ? undefined : query.data,
    condition = data?.items.find((c) => c.id === selected);
  return (
    <>
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("termsTitle")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("termsIntro")}</p>
        {session.context.operational &&
          session.context.application?.grantedRoles.some(
            (r) => r === "referrer" || r === "advisor",
          ) && <Button onClick={() => setCreate(true)}>{t("newTerms")}</Button>}
      </header>
      {create && <CommercialEditor onClose={() => setCreate(false)} />}
      {condition && (
        <Dialog open onOpenChange={(open) => !open && setSelected(undefined)}>
          <DialogContent
            className="max-h-[90svh] overflow-y-auto sm:max-w-3xl"
            closeLabel={t("close")}
          >
            <DialogHeader>
              <DialogTitle>
                {condition.name}
                {t("separator")}
                {condition.organization}
              </DialogTitle>
              <DialogDescription>
                {t("version", { id: condition.id, date: f.date(condition.createdAt) })}
              </DialogDescription>
            </DialogHeader>
            <TermsView terms={condition.terms} />
            {condition.reviews.map((review) => (
              <p key={review.at} className="whitespace-pre-wrap">
                {t(`decision.${review.decision}`)}
                {t("separator")}
                {review.reason}
                <br />
                {review.validationReference}
                <br />
                {f.date(review.at)}
                {t("separator")}
                {review.authorId}
              </p>
            ))}
            <div className="flex flex-wrap gap-3">
              {condition.canReview &&
                (["approve", "reject"] as const).map((d) => (
                  <Button
                    key={d}
                    onClick={() => {
                      setDecision({ id: condition.id, decision: d });
                      setSelected(undefined);
                    }}
                  >
                    {t(`decision.${d}`)}
                  </Button>
                ))}
              {condition.canWithdraw && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setDecision({ id: condition.id, decision: "withdraw" });
                    setSelected(undefined);
                  }}
                >
                  {t("decision.withdraw")}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      {decision && (
        <EconomyForm
          title={t(`decision.${decision.decision}`)}
          description={t("reviewTermsNotice")}
          enabled={
            !!data?.items.some(
              (c) =>
                c.id === decision.id &&
                (decision.decision === "withdraw" ? c.canWithdraw : c.canReview),
            )
          }
          fields={[
            { name: "reason", type: "textarea", label: t("fields.reason") },
            {
              name: "validationReference",
              type: "textarea",
              label: t("fields.validationReference"),
            },
            { name: "checked", type: "checkbox", label: t("reviewConsent") },
          ]}
          parse={(v) => {
            if (!v.checked) throw new Error("confirmation");
            return commercialReviewSchema.parse({
              decision: decision.decision,
              reason: value(v, "reason"),
              validationReference: value(v, "validationReference"),
            });
          }}
          onSend={(v, o) => partnerApi.reviewCommercialCondition(decision.id, v, o)}
          onClose={() => setDecision(undefined)}
        />
      )}
      {!data ? (
        <EconomyLoading error={query.isError} retry={() => void query.refetch()} />
      ) : (
        <div className="space-y-4">
          {!data.items.length && (
            <p className="rounded-xl border border-border p-6">{t("noTerms")}</p>
          )}
          {data.items.map((c) => (
            <button
              type="button"
              key={c.id}
              className="flex w-full flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 text-left hover:bg-muted"
              onClick={() => setSelected(c.id)}
            >
              <div>
                <p className="font-medium">
                  {c.name}
                  {t("separator")}
                  {c.organization}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`model.${c.terms.supplier.model}`)}
                  {t("separator")}
                  {f.date(c.createdAt)}
                </p>
              </div>
              <Badge variant="secondary">{t(`state.${c.state}`)}</Badge>
            </button>
          ))}
          <EconomyPages
            next={data.nextCursor}
            reset={() => setCursor(undefined)}
            onNext={setCursor}
          />
        </div>
      )}
    </>
  );
}
