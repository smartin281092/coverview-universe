import { useState } from "react";
import type {
  RecommendationResult,
  RankedRecommendation,
} from "@coverview/api-client/health-recommendation";
import type {
  HealthOffer,
  HealthPremiumDifference as Difference,
} from "@coverview/api-client/health-insurance";
import { HealthPremiumDifference } from "./HealthPremiumDifference";
import { recommendationCopy as copy } from "../../content/fr/health-recommendation";
import { HealthContactTags, HealthInsurerLogo, HealthOfferBadges } from "./HealthOfferIdentity";
import { healthCopy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";
import { money } from "./health-format";
function ResultCard({
  row,
  result,
  onOffer,
  difference,
  typeLabels,
}: {
  row: RankedRecommendation;
  result: RecommendationResult;
  onOffer: (offer: HealthOffer) => void;
  difference?: Difference | undefined;
  typeLabels: Map<string, string>;
}) {
  const offered = row.preferredBenefits.filter((item) =>
    ["counted", "counted_unconfirmed"].includes(item.status),
  ).length;
  return (
    <article className="hi-ranked-offer">
      <button className="hi-result-row" onClick={() => onOffer(row.offer)}>
        <HealthInsurerLogo offer={row.offer} labelled />
        <span>
          <strong>{row.offer.name}</strong>
          <HealthContactTags offer={row.offer} />
          <HealthOfferBadges
            preferred={
              result.questionStates.some(
                (q) => q.id === "priority" && q.responseStatus === "answered",
              ) && result.leaders.preferred.includes(row.offer.id)
            }
            provisional={result.outcome !== "established"}
          />
          {row.tied && <small>{copy.tied}</small>}
          <small>{copy.compatibility[row.compatibility]}</small>
          {row.preferredBenefits.length > 0 && (
            <small>{copy.preferredBenefitsCount(offered, row.preferredBenefits.length)}</small>
          )}
          {result.scope === "optimize_deductible" && (
            <small>
              {copy.deductible} · {money(row.offer.deductible * 100)} CHF
            </small>
          )}
        </span>
        <span className="hi-list-price">
          <strong>{money(row.offer.monthlyPremiumMinor)}</strong>
          <small>
            {healthCopy.currency} {healthCopy.perMonth}
          </small>
        </span>
        <HealthIcon name="chevron" size={16} />
        <HealthPremiumDifference value={difference} />
      </button>
      <details className="hi-ranked-explanation">
        <summary>
          {copy.explain}
          {row.annualInsuranceCareMinor !== null
            ? ` · ${money(row.annualInsuranceCareMinor)} ${copy.annualUnit}`
            : ""}
        </summary>
        <dl className="hi-specs">
          <div>
            <dt>{copy.deductible}</dt>
            <dd>{money(row.offer.deductible * 100)} CHF</dd>
          </div>
          <div>
            <dt>{copy.accident}</dt>
            <dd className={row.offer.accident ? "hi-included" : undefined}>
              {row.offer.accident ? copy.included : copy.excluded}
            </dd>
          </div>
          <div>
            <dt>{copy.price}</dt>
            <dd>{money(row.annualPremiumMinor)} CHF</dd>
          </div>
          <div>
            <dt>{copy.share}</dt>
            <dd>
              {row.costShareMinor === null ? copy.uncertain : `${money(row.costShareMinor)} CHF`}
            </dd>
          </div>
          <div>
            <dt>{copy.total}</dt>
            <dd>
              {row.annualInsuranceCareMinor === null
                ? copy.uncertain
                : `${money(row.annualInsuranceCareMinor)} ${copy.annualUnit}`}
            </dd>
          </div>
        </dl>
        {row.costScenarios.length > 1 && (
          <ul className="hi-small">
            {row.costScenarios.map((scenario) => (
              <li key={scenario.careMinor}>
                {money(scenario.careMinor)} CHF → {money(scenario.annualMinor)} {copy.annualUnit}
              </li>
            ))}
          </ul>
        )}
        {(row.affordability === "insufficient" ||
          (result.scope === "optimize_deductible" && row.affordability !== "sufficient")) && (
          <p className="hi-small hi-warning">{copy.reserve[row.affordability]}</p>
        )}
        {row.preferredBenefits.length > 0 && (
          <>
            <h4 className="hi-small">{copy.preferredBenefits}</h4>
            <ul className="hi-preferred-benefits">
              {row.preferredBenefits.map((item) => (
                <li key={item.type} className={`is-${item.status}`}>
                  <HealthIcon
                    name={
                      ["counted", "counted_unconfirmed"].includes(item.status)
                        ? "check-circle"
                        : "info"
                    }
                    size={15}
                  />
                  <span>
                    {typeLabels.get(item.type) ?? item.type}
                    <small>{copy.preferredStatus[item.status]}</small>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        <details className="hi-recommendation-explanation">
          <summary>{copy.explain}</summary>
          <ul className="hi-small">
            {row.reasons.map((reason) => (
              <li key={reason}>{copy.rules[reason] ?? reason}</li>
            ))}
            {(Object.keys(copy.utility) as (keyof typeof copy.utility)[])
              .filter((key) => row.utility[key] > 0)
              .map((key) => (
                <li key={key}>
                  {copy.utility[key]} · {row.utility[key]}
                </li>
              ))}
          </ul>
          <p className="hi-small">{copy.reserve[row.affordability]}</p>
          <p className="hi-small">
            {copy.ordinary} : {money(row.ordinaryExposureMinor)} CHF
          </p>
          {row.peripheralSavingMinor > 0 && (
            <p className="hi-small">
              {copy.peripheral} : {money(row.peripheralSavingMinor)} CHF
            </p>
          )}
          {row.uncertainties.length > 0 && (
            <>
              <h4>{copy.conditions}</h4>
              <ul className="hi-small">
                {row.uncertainties.map((reason) => (
                  <li key={reason}>{copy.rules[reason] ?? reason}</li>
                ))}
              </ul>
            </>
          )}
          {row.operatorCaseIds.length > 0 && (
            <p className="hi-small">
              {copy.sourceCases} : {row.operatorCaseIds.join(", ")}
            </p>
          )}
        </details>
      </details>
    </article>
  );
}
export function RecommendationResults({
  result,
  onOffer,
  differences,
}: {
  result: RecommendationResult;
  onOffer: (offer: HealthOffer) => void;
  differences: Map<string, Difference>;
}) {
  const [limit, setLimit] = useState(15);
  // Uniform labels of the canonical benefit types, as proposed by the server question.
  const typeLabels = new Map(
    result.questionStates
      .find((state) => state.id === "benefit_types")
      ?.question.options.map((option) => [option.value, option.label]) ?? [],
  );
  return (
    <section className="hi-personal-results" aria-label={copy.result}>
      <p className="hi-small">
        {copy.result} · {result.scope === "same_deductible" ? copy.same : copy.optimize}
      </p>
      {result.outcome !== "established" &&
        result.questionStates.some((q) => q.id === "priority" && q.responseStatus === "answered") &&
        result.leaders.preferred.length > 0 && (
          <p className="hi-small">* {healthCopy.provisionalBadge}</p>
        )}
      <div className="hi-recommendation-limits hi-small">
        {result.messages.map((key) => (
          <p key={key}>{copy.rules[key] ?? key}</p>
        ))}
      </div>
      <div className="hi-results-list">
        {result.ranked.slice(0, limit).map((row) => (
          <ResultCard
            key={row.offer.id}
            row={row}
            result={result}
            onOffer={onOffer}
            difference={differences.get(row.offer.id)}
            typeLabels={typeLabels}
          />
        ))}
      </div>
      {limit < result.ranked.length && (
        <button className="hi-secondary" onClick={() => setLimit((value) => value + 15)}>
          {copy.continue} ({result.ranked.length - limit})
        </button>
      )}
    </section>
  );
}
