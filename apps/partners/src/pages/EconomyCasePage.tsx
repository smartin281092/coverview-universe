import { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Badge, Button } from "@coverview/ui";
import type { EconomyCase } from "@coverview/contracts/partner-economy";
import { partnerApi } from "../api";
import { usePartner } from "../features/PartnerSession";
import { EconomyEntryEditor } from "../features/EconomyEntryEditor";
import {
  EconomyLoading,
  EconomyPages,
  TermsView,
  economyQueryPolicy,
  useEconomyFormat,
} from "../features/EconomyViews";
export function EconomyCasePage() {
  const { caseId } = useParams({ from: "/remunerations/$caseId" }),
    { t } = useTranslation("economy"),
    session = usePartner(),
    f = useEconomyFormat();
  const [cursor, setCursor] = useState<string>(),
    [entry, setEntry] = useState<EconomyCase>();
  const query = useQuery({
    queryKey: [...session.queryKey, "economic-case", caseId, cursor],
    queryFn: ({ signal }) => partnerApi.economyCase(caseId, cursor, signal),
    ...economyQueryPolicy,
  });
  const data = query.isError ? undefined : query.data;
  return (
    <>
      <Link to="/remunerations" className="text-sm text-muted-foreground">
        {t("backArrow")}
        {t("economyTitle")}
      </Link>
      {entry && (
        <EconomyEntryEditor
          item={entry}
          enabled={!!data?.canRecord && entry.revision === data.revision}
          onClose={() => setEntry(undefined)}
        />
      )}
      {!data ? (
        <EconomyLoading error={query.isError} retry={() => void query.refetch()} />
      ) : (
        <>
          <header className="space-y-3">
            <Badge variant="secondary">{t(`stream.${data.stream}`)}</Badge>
            <h1 className="cv-app-heading break-words">{data.reference}</h1>
            <p className="whitespace-pre-wrap text-muted-foreground">{data.scopeReference}</p>
            <p>{t("collectorLabel", { collector: t(`collector.${data.collector}`) })}</p>
            {data.ownOnly && <p>{t("ownOnly")}</p>}
            {data.canRecord && <Button onClick={() => setEntry(data)}>{t("newEntry")}</Button>}
          </header>
          <section className="space-y-5">
            <h2 className="text-lg font-semibold">{t("balances")}</h2>
            {data.estimate ? (
              <p className="rounded-xl border border-border p-5">
                {t("estimateRange", {
                  min: f.money(data.estimate.minimumMinor),
                  max: f.money(data.estimate.maximumMinor),
                  probability:
                    data.estimate.probabilityBps === null
                      ? t("unknownProbability")
                      : f.percent(data.estimate.probabilityBps),
                })}
                <br />
                {data.estimate.assumptions}
                <br />
                {t("weightedRange", {
                  min: f.money(data.estimate.weightedMinimumMinor),
                  max: f.money(data.estimate.weightedMaximumMinor),
                })}
              </p>
            ) : (
              <p className="text-muted-foreground">{t("noEstimate")}</p>
            )}
            {data.balances.map((b) => (
              <article
                key={b.beneficiary}
                className="space-y-4 rounded-xl border border-border bg-card p-5"
              >
                <h3 className="font-semibold">{b.name}</h3>
                <dl className="grid grid-cols-2 gap-5 lg:grid-cols-4">
                  {(
                    [
                      "confirmedMinor",
                      "receivedMinor",
                      "reservedMinor",
                      "disputedMinor",
                      "clawbackMinor",
                      "availableMinor",
                      "paidMinor",
                      "recoveredMinor",
                      "recoveryDueMinor",
                    ] as const
                  ).map((k) => (
                    <div key={k}>
                      <dt className="text-sm text-muted-foreground">{t(`balance.${k}`)}</dt>
                      <dd className="mt-1 font-medium tabular-nums">{f.money(b[k])}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </section>
          {data.reconciliation && (
            <section className="space-y-3 rounded-xl border border-border p-5">
              <h2 className="font-semibold">{t("reconciliation")}</h2>
              <Badge variant="secondary">
                {t(data.reconciliation.current ? "reconciledCurrent" : "reconciledOld")}
              </Badge>
              <p>
                {t("reconciliationAmounts", {
                  expected: f.money(data.reconciliation.expectedMinor),
                  observed: f.money(data.reconciliation.observedMinor),
                  difference: f.money(data.reconciliation.differenceMinor),
                })}
              </p>
              <p className="whitespace-pre-wrap">{data.reconciliation.explanation}</p>
            </section>
          )}
          {data.terms && (
            <details className="rounded-xl border border-border p-5">
              <summary className="cursor-pointer font-semibold">{t("exactTerms")}</summary>
              <div className="mt-5">
                <TermsView terms={data.terms} />
              </div>
            </details>
          )}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t("history")}</h2>
            {!data.history.length && <p>{t("noEntries")}</p>}
            {data.history.map((h) => (
              <article key={h.id} className="space-y-3 rounded-xl border border-border p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-semibold">
                    {h.revision}
                    {t("separator")}
                    {t(`kind.${h.entry.kind}`)}
                  </h3>
                  {h.reversed && <Badge variant="outline">{t("reversed")}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {f.date(h.createdAt)}
                  {t("separator")}
                  {h.authorId}
                </p>
                {"amountMinor" in h.entry && (
                  <p>
                    {f.money(h.entry.amountMinor)}
                    {t("separator")}{" "}
                    {
                      data.balances.find(
                        (b) => "beneficiary" in h.entry && b.beneficiary === h.entry.beneficiary,
                      )?.name
                    }
                  </p>
                )}
                {"grossMinor" in h.entry && (
                  <p>
                    {f.money(h.entry.grossMinor)}
                    {h.entry.deductions.map((d) => (
                      <span key={d.code}>
                        {" "}
                        {t("separator")}
                        {d.code}
                        {t("minus")}
                        {f.money(d.amountMinor)}
                      </span>
                    ))}
                  </p>
                )}
                {"settlementReference" in h.entry && (
                  <p className="whitespace-pre-wrap">
                    {h.entry.statementReference}
                    <br />
                    {h.entry.settlementReference}
                  </p>
                )}
                {"triggerReference" in h.entry && <p>{h.entry.triggerReference}</p>}
                {"reason" in h.entry && <p>{h.entry.reason}</p>}
                <p className="whitespace-pre-wrap">
                  {t("proof", { date: f.date(h.entry.proof.occurredAt) })}
                  <br />
                  {h.entry.proof.reference}
                </p>
              </article>
            ))}
            <EconomyPages
              next={data.nextCursor}
              reset={() => setCursor(undefined)}
              onNext={setCursor}
            />
          </section>
        </>
      )}
    </>
  );
}
