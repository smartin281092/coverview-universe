import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleAlert, Clock3 } from "lucide-react";
import type { ActionCenterItem, CompanyAction } from "@coverview/contracts";
import { Button } from "@coverview/ui";

function CompanyStatus({ company }: { company: CompanyAction }) {
  const { t, i18n } = useTranslation("actions");
  const green = ["current", "notified", "confirmed"].includes(company.status);
  const waiting = ["requested", "in_progress"].includes(company.status);
  const Icon = green ? CheckCircle2 : waiting ? Clock3 : CircleAlert;
  const date = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <div
      className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
        green
          ? "bg-emerald-50 text-emerald-800"
          : waiting
            ? "bg-muted text-muted-foreground"
            : "bg-amber-50 text-amber-900"
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium">{t(`status.${company.status}`)}</p>
        <p>{t(`help.${company.status}`)}</p>
        {company.evidence ? (
          <div className="space-y-1 pt-1">
            <p>
              {t("evidenceDate", {
                kind: t(`status.${company.evidence.kind}`),
                date: date.format(new Date(company.evidence.occurredAt)),
              })}
            </p>
            <p className="break-words">
              {t("reference", { reference: company.evidence.reference })}
            </p>
            <p>
              {t("evidenceRecorded", {
                date: date.format(new Date(company.evidence.recordedAt)),
              })}
            </p>
          </div>
        ) : (
          waiting &&
          company.request && (
            <p>
              {t("evidenceRecorded", {
                date: date.format(new Date(company.request.updatedAt)),
              })}
            </p>
          )
        )}
      </div>
    </div>
  );
}

export function ActionContext({ action }: { action: ActionCenterItem }) {
  const { t } = useTranslation("actions");
  const { t: companies } = useTranslation("authorizations");
  const [page, setPage] = useState(0);
  const sources = [
    ...new Map(
      [
        ...action.companies.flatMap((company) =>
          company.observations.map((observation) => ({
            documentId: observation.documentId,
            title: observation.documentTitle,
            companyId: company.companyId,
            policyNumber: null as string | null,
          })),
        ),
        ...action.variants.flatMap((variant) => variant.sources),
      ].map((source) => [source.documentId, source]),
    ).values(),
  ];
  const companyIds = [
    ...new Set([
      ...action.companies.map((item) => item.companyId),
      ...sources.flatMap((source) => (source.companyId ? [source.companyId] : [])),
    ]),
  ];
  if (sources.length === 0 && companyIds.length === 0) return null;

  return (
    <section className="space-y-5 border-t border-border pt-6">
      <h2 className="cv-app-subheading">{t("context.title")}</h2>
      {companyIds.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {companyIds.map((companyId) => {
            const company = action.companies.find((item) => item.companyId === companyId);
            return (
              <li key={companyId} className="space-y-3 rounded-xl border border-border p-4">
                <Button asChild variant="outline">
                  <Link to="/insurance-companies/$companyId" params={{ companyId }}>
                    {companies(`companies.names.${companyId}`)}
                  </Link>
                </Button>
                {company && <CompanyStatus company={company} />}
              </li>
            );
          })}
        </ul>
      )}
      {sources.length ? (
        <ul className="divide-y divide-border">
          {sources.slice(page * 6, page * 6 + 6).map((source) => (
            <li
              key={source.documentId}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0 space-y-1">
                <p className="break-words font-medium">{source.title}</p>
                {source.policyNumber && (
                  <p className="text-sm text-muted-foreground">
                    {t("context.contract", { reference: source.policyNumber })}
                  </p>
                )}
              </div>
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/documents/$documentId" params={{ documentId: source.documentId }}>
                  {t("viewSource")}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("context.profile")}</p>
      )}
      {sources.length > 6 && (
        <nav aria-label={t("sourcePagination")} className="flex gap-3">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            {t("previous")}
          </Button>
          <Button
            variant="outline"
            disabled={(page + 1) * 6 >= sources.length}
            onClick={() => setPage((value) => value + 1)}
          >
            {t("next")}
          </Button>
        </nav>
      )}
    </section>
  );
}
