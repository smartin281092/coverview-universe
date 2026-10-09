import { useTranslation } from "react-i18next";
import type { CapacityAdvisorAssessment } from "@coverview/contracts/partner";
import { formatDate } from "./Field";
import { numberFormat } from "@coverview/ui/number-format";

export function AdvisorCapacity({ value }: { value: CapacityAdvisorAssessment }) {
  const { t, i18n } = useTranslation();
  const { capacity, workload } = value;
  const source = capacity.declaration;
  return (
    <section className="space-y-5 text-sm">
      <h3 className="font-medium">{t("advisorAssessment.capacity.title")}</h3>
      <p>{t(`advisorAssessment.capacity.status.${capacity.status}`)}</p>
      {capacity.position && (
        <p className="font-medium">{t(`capacity.position.${capacity.position}`)}</p>
      )}
      <p>{t("advisorAssessment.capacity.decision")}</p>
      <div className="space-y-2">
        <h4 className="font-medium">{t("advisorAssessment.capacity.source")}</h4>
        <p>{t("advisorAssessment.capacity.audience")}</p>
        {source && (
          <>
            <p>
              {t("capacity.record", {
                revision: source.revision,
                date: formatDate(source.declaredAt),
              })}
            </p>
            <p>
              {t("capacity.categories", {
                values: new Intl.ListFormat(i18n.language).format(
                  source.categories.map((category) => t(`category.${category}`)),
                ),
              })}
            </p>
            <p>{t(`advisorAssessment.capacity.scope.${source.professionalScope}`)}</p>
            {source.validUntil && (
              <p>
                {t("advisorAssessment.capacity.expiry", {
                  date: formatDate(source.validUntil),
                })}
              </p>
            )}
          </>
        )}
        <p className="text-muted-foreground">{t("advisorAssessment.capacity.manage")}</p>
      </div>
      <div className="space-y-3 border-t border-border pt-4">
        <h4 className="font-medium">{t("capacity.workload.title")}</h4>
        <p>{t("capacity.workload.observed", { date: formatDate(workload.observedAt) })}</p>
        <dl className="space-y-2">
          {(["accepted", "proposed", "contributing"] as const).map((key) => (
            <div key={key} className="flex justify-between gap-4">
              <dt>{t(`capacity.workload.${key}`)}</dt>
              <dd className="font-medium tabular-nums">
                {numberFormat(i18n.language).format(workload[key])}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-muted-foreground">{t("capacity.workload.definition")}</p>
        <p>{t("capacity.limits")}</p>
      </div>
    </section>
  );
}
