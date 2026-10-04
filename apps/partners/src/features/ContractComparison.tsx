import { useTranslation } from "react-i18next";
import type { LeadDetail } from "@coverview/contracts/partner";
import { Button } from "@coverview/ui";
import { partnerApi } from "../api";
// The current contract chosen as reference; the comparison itself is in the offer matrix.
export function ContractComparison({ lead }: { lead: LeadDetail }) {
  const { t } = useTranslation("partner");
  const tr = (key: string, values: Record<string, unknown> = {}) => t(`contract.${key}`, values);
  const current = lead.currentContract;
  if (!current) return <p className="text-sm text-muted-foreground">{tr("unlinked")}</p>;
  const source = current.source;
  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <h3 className="font-semibold">{tr("title")}</h3>
      <p className="text-sm">{tr(`status.${current.status}`)}</p>
      {source && (
        <div className="space-y-2 text-sm">
          <p>{tr("joined", { first: source.contract.title, second: source.facts.companyId })}</p>
          <p>
            {tr("fieldValue", {
              label: tr("policy"),
              value: source.contract.policyNumber ?? tr("missing"),
            })}
          </p>
          <p>
            {tr("fieldValue", {
              label: tr("object"),
              value: source.contract.insuredSubject ?? tr("missing"),
            })}
          </p>
          <p>
            {tr("documentDates", {
              start: source.contract.startsOn ?? tr("missing"),
              end: source.contract.endsOn ?? tr("missing"),
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {tr("version", { generation: source.generation, review: current.reviewVersion })}
          </p>
          {source.facts.premium && (
            <blockquote className="border-l-2 border-border pl-3 text-xs">
              {tr("page", { page: source.facts.premium.source.page })}{" "}
              {source.facts.premium.source.text}
            </blockquote>
          )}
          <Button asChild variant="outline" size="sm">
            <a href={partnerApi.contractSourceUrl(lead.id, false)}>{tr("original")}</a>
          </Button>
        </div>
      )}
    </div>
  );
}
