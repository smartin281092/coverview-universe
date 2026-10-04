import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { insuranceCompanyIdSchema } from "@coverview/contracts";
import { solutionBindingFields, type BoundSolutionEvidence } from "@coverview/contracts/partner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Label,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { ConventionDialog } from "./ConventionDialog";
import { SolutionBindingDialog } from "./SolutionBindingDialog";
import { ProfessionalScopeDetails } from "./ProfessionalScopeDetails";
import { formatDate } from "./Field";

export function SolutionEvidenceDialog({
  leadId,
  offerId,
  onClose,
}: {
  leadId: string;
  offerId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation(),
    session = usePartner();
  const [companyId, setCompanyId] = useState<BoundSolutionEvidence["companyId"]>(null);
  const [view, setView] = useState<"offer" | "association" | "convention">("offer");
  const [dossier, setDossier] = useState<BoundSolutionEvidence | null>(null);
  const [returning, setReturning] = useState(false);
  const [binding, setBinding] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const query = useQuery({
    queryKey: [...session.queryKey, "solution-evidence", 2, leadId, offerId, companyId],
    queryFn: ({ signal }) =>
      partnerApi.boundSolutionEvidence(leadId, offerId, companyId ? { companyId } : {}, signal),
    enabled: !dossier && !binding,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  useEffect(() => {
    if (!query.isPending && !query.isError && !returning) heading.current?.focus();
  }, [view, dossier, returning, query.isPending, query.isError]);
  const reload = () => {
    setReturning(true);
    void query.refetch().finally(() => setReturning(false));
  };
  if (binding)
    return (
      <SolutionBindingDialog
        leadId={leadId}
        offerId={offerId}
        onClose={() => {
          setBinding(false);
          reload();
        }}
      />
    );
  if (dossier?.companyId)
    return (
      <ConventionDialog
        userId={dossier.advisorId}
        initialCategory={dossier.scope.category}
        initialCompanyId={dossier.companyId}
        onClose={() => {
          setDossier(null);
          reload();
        }}
      />
    );
  const value = query.isError ? undefined : query.data;
  const convention = value?.convention,
    record = convention?.current;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("solutionEvidence.title")}</DialogTitle>
          <DialogDescription>{t("solutionEvidence.privacy")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (view !== "offer") {
                setView("offer");
                reload();
              } else onClose();
            }}
          >
            {t("capacity.back")}
          </Button>
          <Button variant="outline" disabled={query.isFetching || returning} onClick={reload}>
            {t(query.isFetching ? "loading" : "capacity.refresh")}
          </Button>
        </div>
        {query.isPending || returning ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("solutionEvidence.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={reload}
          />
        ) : (
          value && (
            <>
              <p className="text-xs text-muted-foreground">
                {t("advisorAssessment.at", { date: formatDate(value.assessedAt) })}
              </p>
              {value.changeRequested && (
                <p role="status" className="text-sm font-medium">
                  {t("advisorAssessment.changeRequested")}
                </p>
              )}
              <h3 ref={heading} tabIndex={-1} className="font-medium">
                {t(
                  view === "association"
                    ? "boundSolutionEvidence.association"
                    : view === "offer"
                      ? "solutionEvidence.offer"
                      : "solutionEvidence.convention",
                )}
              </h3>
              <p className="break-words text-sm font-medium">
                {t("solutionEvidence.version", {
                  company: value.offer.company,
                  product: value.offer.product,
                  version: value.offer.version,
                })}
              </p>
              <p className="text-sm">{t("solutionEvidence.unconfirmed")}</p>
              {view === "offer" ? (
                <>
                  <section className="space-y-2 text-sm">
                    <h4 className="font-medium">{t("needExpertise.need")}</h4>
                    <p className="break-words">{value.scope.title}</p>
                    <p>{t(`category.${value.scope.category}`)}</p>
                    <p className="whitespace-pre-wrap break-words">
                      {value.scope.object || t("advisorAssessment.unspecified")}
                    </p>
                    <p className="whitespace-pre-wrap break-words">
                      {value.scope.context || t("advisorAssessment.unspecified")}
                    </p>
                  </section>
                  <section className="space-y-2 text-sm">
                    <h4 className="font-medium">{t("needExpertise.source")}</h4>
                    <Badge variant="outline">{t(`offer.${value.offer.state}`)}</Badge>
                    {!value.offer.active && <p role="status">{t("solutionEvidence.inactive")}</p>}
                    <p>{t(`solutionEvidence.source.${value.offer.sourceStatus}`)}</p>
                    <p>{t(`solutionEvidence.validity.${value.offer.validity}`)}</p>
                    {value.offer.validUntil && (
                      <p>
                        {t("competence.validity", { date: formatDate(value.offer.validUntil) })}
                      </p>
                    )}
                    <p>
                      {value.offer.reviewedAt
                        ? t("solutionEvidence.reviewed", {
                            date: formatDate(value.offer.reviewedAt),
                          })
                        : t("solutionEvidence.notReviewed")}
                    </p>
                    <p className="break-words">
                      {t("solutionEvidence.reference", {
                        reference: value.offer.reference || t("advisorAssessment.unspecified"),
                      })}
                    </p>
                    {value.offer.canDownload && (
                      <Button asChild variant="outline">
                        <a href={partnerApi.sourceUrl(leadId, value.offer.id)}>
                          {t("offer.source")}
                        </a>
                      </Button>
                    )}
                  </section>
                  <div className="space-y-2">
                    <h4 className="font-medium">{t("boundSolutionEvidence.association")}</h4>
                    <p role="status" className="text-sm">
                      {t(`solutionBinding.status.${value.binding.status}`)}
                    </p>
                    {value.binding.current && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          setView("association");
                          reload();
                        }}
                      >
                        {t("boundSolutionEvidence.seeAssociation")}
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => setBinding(true)}>
                      {t("solutionBinding.open")}
                    </Button>
                    <Label htmlFor="solution-company">{t("solutionEvidence.chooseCompany")}</Label>
                    <select
                      id="solution-company"
                      value={companyId ?? ""}
                      className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                      aria-describedby="solution-company-help"
                      onChange={(event) =>
                        setCompanyId(
                          event.target.value
                            ? insuranceCompanyIdSchema.parse(event.target.value)
                            : null,
                        )
                      }
                    >
                      <option value="">{t("solutionEvidence.noCompany")}</option>
                      {insuranceCompanyIdSchema.options.map((id) => (
                        <option key={id} value={id}>
                          {t(`convention.companies.${id}`)}
                        </option>
                      ))}
                    </select>
                    <p id="solution-company-help" className="text-sm text-muted-foreground">
                      {t("solutionEvidence.companyHelp")}
                    </p>
                  </div>
                  <Button
                    disabled={!value.companyId}
                    onClick={() => {
                      setView("convention");
                      reload();
                    }}
                  >
                    {t("solutionEvidence.examine")}
                  </Button>
                </>
              ) : view === "association" ? (
                <section className="space-y-3 text-sm">
                  <p role="status">{t(`solutionBinding.status.${value.binding.status}`)}</p>
                  {value.binding.current ? (
                    <>
                      <p>
                        {t("capacity.record", {
                          revision: value.binding.current.revision,
                          date: formatDate(value.binding.current.recordedAt),
                        })}
                      </p>
                      {value.binding.current.validUntil && (
                        <p>
                          {t("competence.validity", {
                            date: formatDate(value.binding.current.validUntil),
                          })}
                        </p>
                      )}
                      <dl className="space-y-3">
                        {solutionBindingFields.map((field) => {
                          const mention = value.binding.current?.mentions?.[field];
                          return (
                            <div key={field}>
                              <dt className="font-medium">{t(`solutionBinding.field.${field}`)}</dt>
                              <dd className="whitespace-pre-wrap break-words">
                                {mention?.quote ?? t("solutionBinding.unknown")}
                              </dd>
                              {mention && (
                                <dd className="text-muted-foreground">
                                  {t("solutionBinding.pageValue", { page: mention.page })}
                                </dd>
                              )}
                            </div>
                          );
                        })}
                      </dl>
                      <h4 className="font-medium">{t("solutionBinding.reason")}</h4>
                      <p className="whitespace-pre-wrap break-words">
                        {value.binding.current.reason}
                      </p>
                      {value.offer.canDownload && (
                        <Button asChild variant="outline">
                          <a href={partnerApi.sourceUrl(leadId, value.offer.id)}>
                            {t("offer.source")}
                          </a>
                        </Button>
                      )}
                      {value.binding.current.companyId ? (
                        <Button
                          onClick={() => {
                            const selected = value.binding.current?.companyId;
                            if (!selected) return;
                            setView("convention");
                            setCompanyId(selected);
                            if (selected === companyId) reload();
                          }}
                        >
                          {t("boundSolutionEvidence.useHumanChoice", {
                            company: t(`convention.companies.${value.binding.current.companyId}`),
                          })}
                        </Button>
                      ) : (
                        <p>{t("boundSolutionEvidence.noAssociatedCompany")}</p>
                      )}
                    </>
                  ) : (
                    <p>{t("boundSolutionEvidence.noCurrentAssociation")}</p>
                  )}
                  <Button variant="outline" onClick={() => setBinding(true)}>
                    {t("solutionBinding.open")}
                  </Button>
                </section>
              ) : (
                convention && (
                  <section className="space-y-3 text-sm">
                    <p className="font-medium">{t(`convention.companies.${value.companyId}`)}</p>
                    <p role="status">{t(`boundSolutionEvidence.selection.${value.selection}`)}</p>
                    {value.binding.current && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {t("capacity.record", {
                            revision: value.binding.current.revision,
                            date: formatDate(value.binding.current.recordedAt),
                          })}
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setView("association");
                            reload();
                          }}
                        >
                          {t("boundSolutionEvidence.seeAssociation")}
                        </Button>
                      </>
                    )}
                    <p className="text-muted-foreground">{t("boundSolutionEvidence.clauses")}</p>
                    <Badge variant="outline">
                      {t(`convention.status.${convention.summary.status}`)}
                    </Badge>
                    <p className="text-muted-foreground">{t("needExpertise.lastRecord")}</p>
                    {record ? (
                      <>
                        <ProfessionalScopeDetails record={record} />
                        <h4 className="font-medium">{t("convention.declaration")}</h4>
                        <p className="whitespace-pre-wrap break-words">{record.declaration}</p>
                        <h4 className="font-medium">
                          {t(`convention.decisions.${record.decision}`)}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          {t("competence.actor", {
                            name: record.actorName,
                            date: formatDate(record.createdAt),
                          })}
                        </p>
                        <p className="whitespace-pre-wrap break-words">
                          {record.reason || t("advisorAssessment.unspecified")}
                        </p>
                        {record.coverage && <p>{t(`needExpertise.coverage.${record.coverage}`)}</p>}
                        {record.scope && (
                          <p className="whitespace-pre-wrap break-words">
                            {t("competence.scopeValue", { scope: record.scope })}
                          </p>
                        )}
                        {record.validFrom && (
                          <p>
                            {t("convention.startValidity", { date: formatDate(record.validFrom) })}
                          </p>
                        )}
                        {record.validUntil && (
                          <p>{t("competence.validity", { date: formatDate(record.validUntil) })}</p>
                        )}
                        <h4 className="font-medium">{t("needExpertise.source")}</h4>
                        <p className="break-words">{record.documentName}</p>
                        <p>{t(`needExpertise.sourceStatus.${convention.sourceStatus}`)}</p>
                        {convention.reviewedDocumentRevision !== null && (
                          <p>
                            {t("needExpertise.sourceVersions", {
                              reviewed: convention.reviewedDocumentRevision,
                              current: record.documentRevision,
                            })}
                          </p>
                        )}
                      </>
                    ) : (
                      <EmptyState
                        title={t("convention.status.missing")}
                        description={t("convention.empty")}
                      />
                    )}
                    {convention.canOpenDossier && (
                      <Button variant="outline" onClick={() => setDossier(value)}>
                        {t("solutionEvidence.openDossier")}
                      </Button>
                    )}
                  </section>
                )
              )}
              <section className="space-y-2 text-sm">
                <h4 className="font-medium">{t("solutionEvidence.remaining")}</h4>
                <ul className="list-disc space-y-1 pl-5">
                  {value.remainingChecks.map((check) => (
                    <li key={check}>{t(`solutionEvidence.check.${check}`)}</li>
                  ))}
                </ul>
                <p className="text-muted-foreground">{t("solutionEvidence.limits")}</p>
              </section>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
