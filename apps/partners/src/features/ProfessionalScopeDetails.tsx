import { useTranslation } from "react-i18next";
import type { CompetenceDossier } from "@coverview/contracts/partner";

export function ProfessionalScopeDetails({
  record,
}: {
  record: Pick<
    NonNullable<CompetenceDossier["current"]>,
    "declaredName" | "declaredOrganization" | "professionalScope"
  >;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 text-sm">
      {record.declaredName && record.declaredOrganization && (
        <p className="break-words">
          {t("professionalScope.parties", {
            name: record.declaredName,
            organization: record.declaredOrganization,
          })}
        </p>
      )}
      {record.professionalScope !== "current" && (
        <p role="status" className="text-muted-foreground">
          {t(`professionalScope.${record.professionalScope}`)}
        </p>
      )}
    </div>
  );
}
