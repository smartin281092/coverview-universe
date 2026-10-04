import { useTranslation } from "react-i18next";
import type { LeadDetail } from "@coverview/contracts/partner";
import { SourcedComparison, Button } from "@coverview/ui";
import { partnerApi } from "../../partner-api";
export function ContractComparison({ lead }: { lead: LeadDetail }) {
  const { t, i18n } = useTranslation("offers");
  const tr = (key: string, values: Record<string, unknown> = {}) => t(`contract.${key}`, values);
  const current = lead.currentContract;
  const money = (value: number) =>
    new Intl.NumberFormat(i18n.language, { style: "currency", currency: "CHF" }).format(
      value / 100,
    );
  if (!current) return <p className="text-sm text-muted-foreground">{tr("unlinked")}</p>;
  const source = current.source;
  const feature = (
    value: {
      value: string;
      conditions: string;
      exclusions: string;
      verification: string;
      coverage: string;
      quote?: string;
      source?: string;
      page?: number | null;
      origin?: string;
    } | null,
  ) =>
    value ? (
      <div className="space-y-2">
        <p>{value.verification === "missing" ? tr("missing") : value.value || tr("missing")}</p>
        <p className="text-xs">
          {tr("joined", {
            first: tr(`coverage.${value.coverage}`),
            second: tr(`verification.${value.verification}`),
          })}
        </p>
        {value.origin && <p className="text-xs">{tr(`origin.${value.origin}`)}</p>}
        {value.conditions && (
          <p>{tr("fieldValue", { label: tr("conditions"), value: value.conditions })}</p>
        )}
        {value.exclusions && (
          <p>{tr("fieldValue", { label: tr("exclusions"), value: value.exclusions })}</p>
        )}
        {(value.quote || value.source) && (
          <blockquote className="border-l-2 border-border pl-3 text-xs text-muted-foreground">
            {value.page && tr("page", { page: value.page })} {value.quote || value.source}
          </blockquote>
        )}
      </div>
    ) : (
      <p>{tr("missing")}</p>
    );
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
            <a href={partnerApi.contractSourceUrl(lead.id, true)}>{tr("original")}</a>
          </Button>
        </div>
      )}
      <SourcedComparison
        title={tr("compare")}
        description={tr("description")}
        detailsLabel={tr("details")}
        closeLabel={tr("close")}
        currentLabel={tr("title")}
        proposedLabel={tr("proposed")}
        offers={lead.comparisons.map((comparison) => {
          const offer = lead.offers.find((value) => value.id === comparison.offerId)!;
          return {
            id: offer.id,
            title: `${offer.company} · ${offer.product}`,
            summary: (
              <div className="space-y-2 text-sm">
                <p>{tr("offerVersion", { version: comparison.offerVersion })}</p>
                <p>
                  {comparison.annualDifferenceMinor === null
                    ? tr(`premium.${comparison.premiumStatus}`)
                    : tr(
                        comparison.annualDifferenceMinor < 0
                          ? "saving"
                          : comparison.annualDifferenceMinor > 0
                            ? "extra"
                            : "samePremium",
                        { amount: money(Math.abs(comparison.annualDifferenceMinor)) },
                      )}
                </p>
                {comparison.currentAnnualMinor !== null && (
                  <p className="text-xs">
                    {tr("annualization", {
                      amount: money(comparison.currentAnnualMinor),
                      factor: comparison.annualFactor,
                    })}
                  </p>
                )}
                <p>
                  {tr("gainsLabel")}{" "}
                  {comparison.rows
                    .filter((row) => row.change === "gain")
                    .map((row) => row.label)
                    .join(", ") || tr("noneEstablished")}
                </p>
                <p>
                  {tr("lossesLabel")}{" "}
                  {comparison.rows
                    .filter((row) => row.change === "loss")
                    .map((row) => row.label)
                    .join(", ") || tr("noneEstablished")}
                </p>
                <p className="text-xs text-muted-foreground">{tr("incomplete")}</p>
              </div>
            ),
            rows: comparison.rows.map((row) => ({
              id: row.key,
              label: row.label,
              change: tr(`change.${row.change}`),
              current: feature(row.current),
              proposed: feature(row.proposed),
            })),
          };
        })}
      />
    </div>
  );
}
