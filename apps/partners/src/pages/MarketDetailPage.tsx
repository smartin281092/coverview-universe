import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Badge } from "@coverview/ui";
import {
  marketApplicationInputSchema,
  marketDecisionSchema,
  type MarketDetail,
} from "@coverview/contracts/partner-economy";
import { z } from "zod";
import { partnerApi } from "../api";
import { usePartner } from "../features/PartnerSession";
import { EconomyForm, value } from "../features/EconomyForm";
import { MarketReservationDialog } from "../features/MarketReservationDialog";
import {
  EconomyLoading,
  MissionView,
  TermsView,
  economyQueryPolicy,
  useEconomyFormat,
} from "../features/EconomyViews";
export function MarketDetailPage() {
  const { marketId } = useParams({ from: "/marketplace/$marketId" }),
    { t } = useTranslation("economy"),
    session = usePartner(),
    f = useEconomyFormat();
  const [cursor, setCursor] = useState<string>(),
    [reserve, setReserve] = useState<MarketDetail | null>(null),
    [action, setAction] = useState<"apply" | "withdraw" | "withdrawApplication">(),
    [decision, setDecision] = useState<{ id: string; decision: "accept" | "decline" | "cancel" }>();
  const query = useQuery({
    queryKey: [...session.queryKey, "market", marketId, cursor],
    queryFn: ({ signal }) => partnerApi.marketDetail(marketId, cursor, signal),
    ...economyQueryPolicy,
  });
  const current = query.isError ? undefined : query.data,
    m = current?.publication;
  const reason = { name: "reason", type: "textarea" as const, label: t("fields.reason") },
    confirmed = { name: "confirmed", type: "checkbox" as const, label: t("decisionConsent") };
  const own = current?.applications.find((a) => a.userId === session.identity.user.id);
  return (
    <>
      <Link to="/marketplace" className="text-sm text-muted-foreground">
        {t("backArrow")}
        {t("marketTitle")}
      </Link>
      {reserve && (
        <MarketReservationDialog
          market={reserve}
          enabled={!!current?.canReserve}
          onClose={() => setReserve(null)}
        />
      )}
      {action === "apply" && (
        <EconomyForm
          title={t("apply")}
          description={t("applyIntro")}
          fields={[
            reason,
            { name: "suitabilityAcknowledged", type: "checkbox", label: t("suitabilityConsent") },
          ]}
          enabled={!!m?.canApply && !own}
          parse={(v) =>
            marketApplicationInputSchema.parse({
              reason: value(v, "reason"),
              suitabilityAcknowledged: v.suitabilityAcknowledged,
            })
          }
          onSend={(v, o) => partnerApi.applyMarket(marketId, v, o)}
          onClose={() => setAction(undefined)}
        />
      )}
      {action === "withdraw" && (
        <EconomyForm
          title={t("withdrawPublication")}
          description={t("withdrawIntro")}
          fields={[reason, confirmed]}
          enabled={!!m?.canManage && !["accepted", "withdrawn"].includes(m.state)}
          parse={(v) => {
            if (!v.confirmed) throw new Error("confirm");
            return z.string().trim().min(10).max(2000).parse(value(v, "reason"));
          }}
          onSend={(v, o) => partnerApi.withdrawMarket(marketId, v, o)}
          onClose={() => setAction(undefined)}
        />
      )}
      {action === "withdrawApplication" && (
        <EconomyForm
          title={t("withdrawApplication")}
          description={t("withdrawApplicationIntro")}
          fields={[confirmed]}
          enabled={!!own && !own.withdrawn}
          parse={(v) => z.literal(true).parse(v.confirmed)}
          onSend={(_v, o) => partnerApi.withdrawMarketApplication(marketId, o)}
          onClose={() => setAction(undefined)}
        />
      )}
      {decision && (
        <EconomyForm
          title={t(`decision.${decision.decision}`)}
          description={t("acceptIntro")}
          fields={[reason, confirmed]}
          enabled={
            !!current?.reservations.some(
              (r) =>
                r.id === decision.id &&
                (decision.decision === "cancel" ? r.canCancel : r.canRespond) &&
                (decision.decision !== "accept" || r.mandate === "accepted"),
            )
          }
          parse={(v) =>
            marketDecisionSchema.parse({
              decision: decision.decision,
              reason: value(v, "reason"),
              confirmed: v.confirmed,
            })
          }
          onSend={(v, o) => partnerApi.decideMarket(decision.id, v, o)}
          onClose={() => setDecision(undefined)}
        />
      )}
      {!current || !m ? (
        <EconomyLoading error={query.isError} retry={() => void query.refetch()} />
      ) : (
        <>
          <header className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="cv-app-heading">{t(`partner:category.${m.category}`)}</h1>
              <Badge variant="secondary">{t(`state.${m.state}`)}</Badge>
            </div>
            <p>
              {m.language.toUpperCase()}
              {t("separator")}
              {m.canton ?? t("unspecified")}
              {t("separator")} {m.modes.map((v) => t(`modes.${v}`)).join(", ")}
            </p>
            <p>
              {t(`qualification.${m.qualification}`)}
              {t("separator")}
              {t(`reason.${m.reason}`)}
            </p>
            <p>{t("leadAge", { date: f.date(m.leadCreatedAt) })}</p>
            <p>{t("reservationUntil", { date: f.date(m.expiresAt) })}</p>
            <p>
              {t(`model.${m.supplier.model}`)}
              {t("separator")}{" "}
              {m.supplier.model === "fixed"
                ? f.money(m.supplier.amountMinor)
                : f.percent(m.supplier.rateBps)}
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                ...m.steps.map((s) => t(`steps.${s}`)),
                ...m.constraints.map((s) => t(`constraints.${s}`)),
              ].map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {m.canApply && !own && (
                <Button onClick={() => setAction("apply")}>{t("apply")}</Button>
              )}
              {current.canReserve && (
                <Button onClick={() => setReserve(current)}>{t("reserve")}</Button>
              )}
              {m.canManage && !["accepted", "withdrawn"].includes(m.state) && (
                <Button variant="outline" onClick={() => setAction("withdraw")}>
                  {t("withdrawPublication")}
                </Button>
              )}
              {m.leadId && (
                <Button asChild variant="outline">
                  <Link to="/leads/$leadId" params={{ leadId: m.leadId }}>
                    {t("openLead")}
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link to="/remunerations">{t("economyTitle")}</Link>
              </Button>
            </div>
          </header>
          {current.condition && (
            <details className="rounded-xl border border-border bg-card p-5">
              <summary className="cursor-pointer font-semibold">{t("exactTerms")}</summary>
              <div className="mt-5">
                <TermsView terms={current.condition.terms} />
              </div>
            </details>
          )}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t("applications")}</h2>
            {!current.applications.length && (
              <p className="text-muted-foreground">{t("noApplications")}</p>
            )}
            {current.applications.map((a) => (
              <article key={a.id} className="space-y-3 rounded-xl border border-border p-5">
                <h3 className="font-semibold">{a.name}</h3>
                <p className="whitespace-pre-wrap">{a.reason}</p>
                <p className="text-sm text-muted-foreground">
                  {f.date(a.createdAt)}
                  {t("separator")}
                  {t(a.withdrawn ? "state.withdrawn" : "state.pending")}
                </p>
                {a.userId === session.identity.user.id && !a.withdrawn && (
                  <Button variant="outline" onClick={() => setAction("withdrawApplication")}>
                    {t("withdrawApplication")}
                  </Button>
                )}
              </article>
            ))}
            {current.nextApplicationsCursor && (
              <Button
                variant="outline"
                onClick={() => setCursor(current.nextApplicationsCursor ?? undefined)}
              >
                {t("nextApplications")}
              </Button>
            )}
          </section>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t("reservations")}</h2>
            {!current.reservations.length && (
              <p className="text-muted-foreground">{t("noReservations")}</p>
            )}
            {current.reservations.map((r) => (
              <article key={r.id} className="space-y-5 rounded-xl border border-border bg-card p-5">
                <MissionView reservation={r} />
                {r.condition && (
                  <details>
                    <summary className="cursor-pointer font-semibold">{t("exactTerms")}</summary>
                    <div className="mt-4">
                      <TermsView terms={r.condition.terms} />
                    </div>
                  </details>
                )}
                {r.canRespond && (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={r.mandate !== "accepted"}
                      onClick={() => setDecision({ id: r.id, decision: "accept" })}
                    >
                      {t("decision.accept")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setDecision({ id: r.id, decision: "decline" })}
                    >
                      {t("decision.decline")}
                    </Button>
                    {r.mandate !== "accepted" && (
                      <p className="text-sm text-muted-foreground">{t("waitingMandate")}</p>
                    )}
                  </div>
                )}
                {r.canCancel && (
                  <Button
                    variant="outline"
                    onClick={() => setDecision({ id: r.id, decision: "cancel" })}
                  >
                    {t("decision.cancel")}
                  </Button>
                )}
              </article>
            ))}
            {current.nextReservationsCursor && (
              <Button
                variant="outline"
                onClick={() => setCursor(current.nextReservationsCursor ?? undefined)}
              >
                {t("nextReservations")}
              </Button>
            )}
            {cursor && (
              <Button variant="ghost" onClick={() => setCursor(undefined)}>
                {t("first")}
              </Button>
            )}
          </section>
        </>
      )}
    </>
  );
}
