import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { NeedExpertiseEvidence } from "@coverview/contracts/partner";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  LoadingState,
  ErrorState,
  EmptyState,
} from "@coverview/ui";
import { partnerApi } from "../api";
import { usePartner } from "./PartnerSession";
import { CompetenceDialog } from "./CompetenceDialog";
import { ProfessionalScopeDetails } from "./ProfessionalScopeDetails";
import { formatDate } from "./Field";

export function NeedExpertiseDialog({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { t } = useTranslation(),
    session = usePartner();
  const [returning, setReturning] = useState(false);
  const [dossier, setDossier] = useState<{
    userId: string;
    category: NeedExpertiseEvidence["scope"]["category"];
  } | null>(null);
  const query = useQuery({
    queryKey: [...session.queryKey, "need-expertise-evidence", leadId],
    queryFn: ({ signal }) => partnerApi.needExpertiseEvidence(leadId, signal),
    enabled: !dossier,
    gcTime: 0,
    staleTime: 0,
    refetchInterval: 10000,
    retry: false,
  });
  // The personal category dossier has its own audience, lifecycle and fresh authorization.
  if (dossier)
    return (
      <CompetenceDialog
        userId={dossier.userId}
        initialCategory={dossier.category}
        onClose={() => {
          setReturning(true);
          setDossier(null);
          void query.refetch().finally(() => setReturning(false));
        }}
      />
    );
  const value = query.isError ? undefined : query.data,
    record = value?.competence.current;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl" closeLabel={t("close")}>
        <DialogHeader>
          <DialogTitle>{t("needExpertise.title")}</DialogTitle>
          <DialogDescription>{t("needExpertise.privacy")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={onClose}>
            {t("advisorAssessment.back")}
          </Button>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t(query.isFetching ? "loading" : "advisorAssessment.refresh")}
          </Button>
        </div>
        {query.isPending || returning ? (
          <LoadingState label={t("loading")} />
        ) : query.isError ? (
          <ErrorState
            title={t("error")}
            description={t("needExpertise.error")}
            retryLabel={t("retry")}
            pendingLabel={t("loading")}
            onRetry={() => void query.refetch()}
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
              <section className="space-y-2 text-sm">
                <h3 className="font-medium">{t("needExpertise.need")}</h3>
                <p className="break-words">{value.scope.title}</p>
                <p>{t(`category.${value.scope.category}`)}</p>
                <p className="whitespace-pre-wrap break-words">
                  {value.scope.object || t("advisorAssessment.unspecified")}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {value.scope.context || t("advisorAssessment.unspecified")}
                </p>
              </section>
              <section className="space-y-3 text-sm">
                <h3 className="font-medium">{t("needExpertise.evidence")}</h3>
                <Badge variant="outline">
                  {t(`competence.status.${value.competence.summary.status}`)}
                </Badge>
                <p className="text-muted-foreground">{t("needExpertise.lastRecord")}</p>
                {record ? (
                  <>
                    <ProfessionalScopeDetails record={record} />
                    <h4 className="font-medium">{t("needExpertise.declaration")}</h4>
                    <p className="whitespace-pre-wrap break-words">{record.declaration}</p>
                    <h4 className="font-medium">{t(`competence.decisions.${record.decision}`)}</h4>
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
                    {record.validUntil && (
                      <p>{t("competence.validity", { date: formatDate(record.validUntil) })}</p>
                    )}
                    <h4 className="font-medium">{t("needExpertise.source")}</h4>
                    <p className="break-words">{record.documentName}</p>
                    <p>{t(`needExpertise.sourceStatus.${value.competence.sourceStatus}`)}</p>
                    {value.competence.reviewedDocumentRevision !== null && (
                      <p className="text-xs text-muted-foreground">
                        {t("needExpertise.sourceVersions", {
                          reviewed: value.competence.reviewedDocumentRevision,
                          current: record.documentRevision,
                        })}
                      </p>
                    )}
                  </>
                ) : (
                  <EmptyState
                    title={t("competence.status.missing")}
                    description={t("needExpertise.missing")}
                  />
                )}
                {value.competence.canOpenDossier && (
                  <Button
                    variant="outline"
                    onClick={() =>
                      setDossier({ userId: value.advisorId, category: value.scope.category })
                    }
                  >
                    {t("needExpertise.openDossier")}
                  </Button>
                )}
                <p className="text-muted-foreground">{t("needExpertise.dossierHelp")}</p>
              </section>
              <section className="space-y-2 text-sm">
                <h3 className="font-medium">{t("needExpertise.reviewTitle")}</h3>
                <p>{t("needExpertise.review")}</p>
                <p className="text-muted-foreground">{t("needExpertise.limits")}</p>
              </section>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
