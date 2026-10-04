import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Badge } from "@coverview/ui";
import { economyAgreementsSchema } from "@coverview/contracts/partner-economy";
import { z } from "zod";
import { partnerApi } from "../api";
import { usePartner } from "../features/PartnerSession";
import { EconomyCaseEditor } from "../features/EconomyCaseEditor";
import {
  EconomyLoading,
  EconomyPages,
  TermsView,
  economyQueryPolicy,
  useEconomyFormat,
} from "../features/EconomyViews";
export function RemunerationsPage() {
  const { t } = useTranslation("economy"),
    session = usePartner(),
    f = useEconomyFormat();
  const [cursor, setCursor] = useState<string>(),
    [agreementCursor, setAgreementCursor] = useState<string>(),
    [selected, setSelected] = useState<z.infer<typeof economyAgreementsSchema>["items"][number]>();
  const cases = useQuery({
    queryKey: [...session.queryKey, "economy", cursor],
    queryFn: ({ signal }) => partnerApi.economyCases(cursor, signal),
    ...economyQueryPolicy,
  });
  const agreements = useQuery({
    queryKey: [...session.queryKey, "agreements", agreementCursor],
    queryFn: ({ signal }) => partnerApi.economyAgreements(agreementCursor, signal),
    ...economyQueryPolicy,
  });
  const data = cases.isError ? undefined : cases.data,
    accepted = agreements.isError ? undefined : agreements.data;
  return (
    <>
      <header className="space-y-3">
        <h1 className="cv-app-heading">{t("economyTitle")}</h1>
        <p className="max-w-3xl text-muted-foreground">{t("economyIntro")}</p>
        {!session.context.operational && (
          <p className="rounded-lg border border-border p-4">{t("readOnlyRights")}</p>
        )}
      </header>
      {selected && (
        <EconomyCaseEditor agreement={selected} onClose={() => setSelected(undefined)} />
      )}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("cases")}</h2>
        {!data ? (
          <EconomyLoading error={cases.isError} retry={() => void cases.refetch()} />
        ) : (
          <>
            {!data.items.length && <p>{t("noCases")}</p>}
            <div className="grid gap-4 md:grid-cols-2">
              {data.items.map((c) => (
                <Link
                  key={c.id}
                  to="/remunerations/$caseId"
                  params={{ caseId: c.id }}
                  className="space-y-3 rounded-xl border border-border bg-card p-5 hover:bg-muted"
                >
                  <Badge variant="secondary">{t(`stream.${c.stream}`)}</Badge>
                  <h3 className="break-words font-semibold">{c.reference}</h3>
                  <p>{t("collectorLabel", { collector: t(`collector.${c.collector}`) })}</p>
                  <div className="flex flex-wrap gap-5">
                    <p>
                      {t("balance.confirmedMinor")}
                      <br />
                      {f.money(c.confirmedMinor)}
                    </p>
                    <p>
                      {t("balance.receivedMinor")}
                      <br />
                      {f.money(c.receivedMinor)}
                    </p>
                  </div>
                  {c.ownOnly && <p className="text-sm text-muted-foreground">{t("ownOnly")}</p>}
                </Link>
              ))}
            </div>
            <EconomyPages
              next={data.nextCursor}
              reset={() => setCursor(undefined)}
              onNext={setCursor}
            />
          </>
        )}
      </section>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("agreements")}</h2>
        {!accepted ? (
          <EconomyLoading error={agreements.isError} retry={() => void agreements.refetch()} />
        ) : (
          <>
            {!accepted.items.length && <p>{t("noAgreements")}</p>}
            {accepted.items.map((a) => (
              <details key={a.id} className="rounded-xl border border-border bg-card p-5">
                <summary className="cursor-pointer font-semibold">
                  {a.supplierName}
                  {t("arrow")}
                  {a.receiverName}
                  {t("separator")}
                  {f.date(a.acceptedAt)}
                </summary>
                <div className="mt-5 space-y-5">
                  <p className="text-sm text-muted-foreground">{a.id}</p>
                  <TermsView terms={a.terms} />
                  <div className="flex flex-wrap gap-3">
                    {session.context.administrator && (
                      <Button onClick={() => setSelected(a)}>{t("newCase")}</Button>
                    )}
                    {a.leadId && (
                      <Button variant="outline" asChild>
                        <Link to="/leads/$leadId" params={{ leadId: a.leadId }}>
                          {t("openLead")}
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </details>
            ))}
            <EconomyPages
              next={accepted.nextCursor}
              reset={() => setAgreementCursor(undefined)}
              onNext={setAgreementCursor}
            />
          </>
        )}
      </section>
    </>
  );
}
