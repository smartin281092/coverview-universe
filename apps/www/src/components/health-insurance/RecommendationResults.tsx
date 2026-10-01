import { useState } from "react";
import type {
  RecommendationResult,
  RankedRecommendation,
} from "@coverview/api-client/health-recommendation";
import type { HealthOffer } from "@coverview/api-client/health-insurance";
import { recommendationCopy as copy } from "../../content/fr/health-recommendation";
import { HealthDialog } from "./HealthDialog";
import { money } from "./health-format";
function ResultCard({
  row,
  result,
  onOffer,
}: {
  row: RankedRecommendation;
  result: RecommendationResult;
  onOffer: (offer: HealthOffer) => void;
}) {
  return (
    <article
      className={`hi-scenario ${result.leaders.preferred.includes(row.offer.id) ? "is-best" : ""}`}
    >
      <div className="hi-recommendation-badges">
        {(["premium", "annual", "preferred"] as const)
          .filter((key) => result.leaders[key].includes(row.offer.id))
          .map((key) => (
            <span key={key} className="hi-source-status">
              {copy[key]}
            </span>
          ))}
        {row.tied && <span className="hi-source-status">{copy.tied}</span>}
      </div>
      <h3>
        {row.offer.insurerBrand ?? row.offer.insurerName} · {row.offer.name}
      </h3>
      <p className="hi-small">
        {copy.available} · {copy.compatibility[row.compatibility]}
      </p>
      <div className="hi-scenario-total">
        <span>{copy.premiumAmount}</span>
        <strong>
          {money(row.offer.monthlyPremiumMinor)} {copy.monthly}
        </strong>
      </div>
      <dl className="hi-specs">
        <div>
          <dt>{copy.deductible}</dt>
          <dd>{money(row.offer.deductible * 100)} CHF</dd>
        </div>
        <div>
          <dt>{copy.accident}</dt>
          <dd>{row.offer.accident ? copy.included : copy.excluded}</dd>
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
      <button className="hi-secondary" onClick={() => onOffer(row.offer)}>
        {copy.details} ↗
      </button>
    </article>
  );
}
export function RecommendationResults({
  result,
  onOffer,
}: {
  result: RecommendationResult;
  onOffer: (offer: HealthOffer) => void;
}) {
  const [all, setAll] = useState(false),
    [limit, setLimit] = useState(15);
  const leaderIds = new Set([
    ...result.leaders.preferred,
    ...result.leaders.premium,
    ...result.leaders.annual,
  ]);
  const selected = result.ranked.filter((row) => leaderIds.has(row.offer.id)).slice(0, 4);
  return (
    <section className="hi-personal-results" aria-label={copy.result}>
      <div className="hi-recommendation-toolbar">
        <h2>{copy.result}</h2>
        <span className="hi-small">
          {result.year} · {result.scope === "same_deductible" ? copy.same : copy.optimize}
        </span>
      </div>
      <p className="hi-small">
        {result.examinedCandidateCount} {copy.offers} · {result.examinedScenarios} {copy.scenarios}
      </p>
      <div className="hi-personal-grid">
        {selected.map((row) => (
          <ResultCard key={row.offer.id} row={row} result={result} onOffer={onOffer} />
        ))}
      </div>
      <div className="hi-small hi-recommendation-limits">
        {result.messages.map((key) => (
          <p key={key}>{copy.rules[key] ?? key}</p>
        ))}
      </div>
      <button className="hi-secondary" onClick={() => setAll(true)}>
        {copy.all} ({result.ranked.length})
      </button>
      <HealthDialog open={all} onClose={() => setAll(false)} title={copy.all} sheet>
        <div className="hi-guide-results">
          {result.ranked.slice(0, limit).map((row) => (
            <ResultCard
              key={row.offer.id}
              row={row}
              result={result}
              onOffer={(offer) => {
                setAll(false);
                onOffer(offer);
              }}
            />
          ))}
        </div>
        {limit < result.ranked.length && (
          <button className="hi-secondary" onClick={() => setLimit((value) => value + 15)}>
            {copy.continue}
          </button>
        )}
      </HealthDialog>
    </section>
  );
}
