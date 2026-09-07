import { useTranslation } from "react-i18next";
import type { DocumentSummary } from "@coverview/contracts";
import { Badge } from "@coverview/ui";

export function DocumentLabels({
  document,
}: {
  document: Pick<DocumentSummary, "companyId" | "insuranceDomain">;
}) {
  const { t } = useTranslation("insurance");
  const { t: ta } = useTranslation("authorizations");
  if (!document.insuranceDomain && !document.companyId) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {document.insuranceDomain && (
        <Badge
          variant="secondary"
          className="max-w-full whitespace-normal rounded-full px-2.5 py-0.5 text-xs font-normal"
        >
          {t(`domain.${document.insuranceDomain}`)}
        </Badge>
      )}
      {document.companyId && (
        <Badge
          variant="secondary"
          className="max-w-full whitespace-normal rounded-full px-2.5 py-0.5 text-xs font-normal"
        >
          {ta(`companies.names.${document.companyId}`)}
        </Badge>
      )}
    </div>
  );
}
