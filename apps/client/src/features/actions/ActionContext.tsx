import { useId, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
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

export function ActionContext({
  action,
  leaving = false,
}: {
  action: ActionCenterItem;
  leaving?: boolean;
}) {
  const { t } = useTranslation("actions");
  const { t: companies } = useTranslation("authorizations");
  const [pagination, setPagination] = useState({ id: action.id, page: 0 });
  const page = pagination.id === action.id ? pagination.page : 0;
  const headingId = useId();
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tween = gsap.fromTo(
      element,
      { opacity: 0 },
      { opacity: 1, duration: reduced ? 0 : 0.25, overwrite: true },
    );
    return () => {
      tween.kill();
    };
  }, [action.id]);
  useLayoutEffect(() => {
    if (!leaving || !container.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tween = gsap.to(container.current, {
      opacity: 0,
      duration: reduced ? 0 : 0.2,
      overwrite: true,
    });
    return () => {
      tween.kill();
    };
  }, [leaving]);
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
    <div ref={container} inert={leaving} className="space-y-6 px-4 sm:px-9">
      {companyIds.length > 0 && (
        <section
          aria-labelledby={`${headingId}-companies`}
          className="space-y-4 rounded-xl border border-border p-4 sm:p-5"
        >
          <h2 id={`${headingId}-companies`} className="cv-app-subheading">
            {t("context.companies")}
          </h2>
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
        </section>
      )}
      {sources.length > 0 && (
        <section
          aria-labelledby={`${headingId}-documents`}
          className="space-y-4 rounded-xl border border-border p-4 sm:p-5"
        >
          <h2 id={`${headingId}-documents`} className="cv-app-subheading">
            {t("context.documents")}
          </h2>
          <ul className="divide-y divide-border">
            {sources.slice(page * 6, page * 6 + 6).map((source) => (
              <li
                key={source.documentId}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
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
          {sources.length > 6 && (
            <nav aria-label={t("sourcePagination")} className="flex gap-3">
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPagination({ id: action.id, page: page - 1 })}
              >
                {t("previous")}
              </Button>
              <Button
                variant="outline"
                disabled={(page + 1) * 6 >= sources.length}
                onClick={() => setPagination({ id: action.id, page: page + 1 })}
              >
                {t("next")}
              </Button>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}
