import { useTranslation } from "react-i18next";
import type { NeedExpertiseEvidence } from "@coverview/contracts/partner";
import { Badge, Button, EmptyState } from "@coverview/ui";
import { ProfessionalScopeDetails } from "./ProfessionalScopeDetails";
import { formatDate } from "./Field";
export function NeedExpertiseEvidenceDetails({
  value,
  onDossier,
}: {
  value: NeedExpertiseEvidence;
  onDossier: () => void;
}) {
  const { t } = useTranslation();
  const record = value.competence.current;
  return (
    <>
      {" "}
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
        <Badge variant="outline">{t(`competence.status.${value.competence.summary.status}`)}</Badge>
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
          <Button variant="outline" onClick={onDossier}>
            {t("needExpertise.openDossier")}
          </Button>
        )}
        <p className="text-muted-foreground">{t("needExpertise.dossierHelp")}</p>
      </section>
    </>
  );
}
