import { ArrowRight, Award } from "lucide-react";
import { auditCopy as copy } from "../../content/fr/audit";
import type { AuditReport } from "./audit-compute";
import type { Answers } from "./audit-state";
import { chf, interpolate, pct } from "./format";
import { InfoTip } from "./InfoTip";
import { MAX_YEARS_NEEDED } from "./projection";
import { HYPERION_ID, LAST_YEAR } from "./strategies";

const yearsText = (years: number | null) =>
  years === null
    ? copy.results.compare.never
    : years >= MAX_YEARS_NEEDED
      ? interpolate(copy.results.compare.beyond, { max: MAX_YEARS_NEEDED })
      : String(years);

export function SynthesisTab({
  report,
  answers,
  walletUrl,
  onCompare,
}: {
  report: AuditReport;
  answers: Answers;
  walletUrl: string;
  onCompare: () => void;
}) {
  const r = copy.results.synthesis;
  const { inputs } = report;
  const own = report.outcomes[0];
  if (!own) return null;
  const hyperion =
    own.solution.strategyId === HYPERION_ID
      ? null
      : report.outcomes.find((outcome) => outcome.solution.strategyId === HYPERION_ID);
  const median = own.simulation?.percentiles.p50 ?? own.deterministic.final;
  const probability = own.simulation?.probabilityAtOrAbove ?? null;
  const since = answers.startYear ? LAST_YEAR - answers.startYear + 1 : 0;
  const profileLabel = own.solution.profile
    ? copy.steps.profile.options[own.solution.profile].label.toLowerCase()
    : null;
  return (
    <div className="audit-grid">
      <article className="audit-card">
        <h3>{r.situation}</h3>
        <dl className="audit-facts">
          {own.solution.provider && (
            <div>
              <dt>{r.provider}</dt>
              <dd>{own.solution.provider}</dd>
            </div>
          )}
          <div>
            <dt>{r.strategy}</dt>
            <dd>
              {own.solution.profile
                ? interpolate(r.proxy, {
                    profile: profileLabel ?? "",
                    strategy: own.solution.label,
                  })
                : own.solution.label}
            </dd>
          </div>
          {answers.has && answers.startYear && (
            <div>
              <dt>{r.since}</dt>
              <dd>
                {answers.startYear} · {interpolate(r.years, { count: since })}
              </dd>
            </div>
          )}
          <div>
            <dt>{r.capitalToday}</dt>
            <dd>
              {chf(inputs.initial)} CHF
              <small>
                {inputs.initialDeclared
                  ? r.capitalDeclared
                  : inputs.reconstructed
                    ? interpolate(r.capitalEstimated, { year: answers.startYear ?? LAST_YEAR })
                    : ""}
              </small>
            </dd>
          </div>
          {inputs.reconstructed && (
            <div>
              <dt>{r.invested}</dt>
              <dd>{chf(inputs.reconstructed.invested)} CHF</dd>
            </div>
          )}
          <div>
            <dt>{copy.steps.birth.title}</dt>
            <dd>{interpolate(r.ageLine, { age: inputs.age, left: inputs.yearsToRetirement })}</dd>
          </div>
        </dl>
      </article>
      <article className="audit-card">
        <h3>{interpolate(r.retirement, { age: answers.retirementAge })}</h3>
        <dl className="audit-facts">
          <div>
            <dt>
              {r.deterministic}
              <InfoTip text={copy.results.tips.cagr} label={copy.info} />
            </dt>
            <dd>
              {chf(own.deterministic.final)} CHF <small>{pct(own.cagr, 2)}</small>
            </dd>
          </div>
          <div>
            <dt>
              {r.median}
              <InfoTip text={copy.results.tips.median} label={copy.info} />
            </dt>
            <dd>{chf(median)} CHF</dd>
          </div>
          {own.simulation && (
            <div>
              <dt>
                {r.range}
                <InfoTip text={copy.results.tips.percentile} label={copy.info} />
              </dt>
              <dd>
                {chf(own.simulation.percentiles.p10)} {r.and} {chf(own.simulation.percentiles.p90)}{" "}
                CHF
              </dd>
            </div>
          )}
          {probability !== null && (
            <div className="audit-fact-wide">
              <dt>{r.probability}</dt>
              <dd>{pct(probability, 1)}</dd>
              <div className="audit-meter" aria-hidden="true">
                <span style={{ width: `${probability * 100}%` }} />
              </div>
            </div>
          )}
        </dl>
      </article>
      <article className="audit-card">
        <h3>{r.need}</h3>
        <dl className="audit-facts">
          <div>
            <dt>
              {r.gap}
              <InfoTip text={copy.results.tips.replacement} label={copy.info} />
            </dt>
            <dd>
              {chf(inputs.need.gapMonthly)} CHF
              <small>{interpolate(r.gapHint, { share: pct(1 - answers.replacement, 1) })}</small>
            </dd>
          </div>
          <div>
            <dt>{r.needToday}</dt>
            <dd>
              {chf(inputs.need.today)} CHF
              <small>
                {interpolate(r.needHint, {
                  years: answers.retirementYears,
                  age: answers.retirementAge,
                  end: answers.retirementAge + answers.retirementYears,
                })}
              </small>
            </dd>
          </div>
          <div>
            <dt>
              {interpolate(r.needAtRetirement, { age: answers.retirementAge })}
              <InfoTip text={copy.results.tips.inflation} label={copy.info} />
            </dt>
            <dd>
              {chf(inputs.need.atRetirement)} CHF
              <small>
                {interpolate(r.needAtRetirementHint, {
                  inflation: pct(answers.inflation, 1),
                  left: inputs.yearsToRetirement,
                })}
              </small>
            </dd>
          </div>
        </dl>
      </article>
      {hyperion && (
        <article className="audit-card audit-card-accent">
          <p className="audit-badge">
            <Award aria-hidden="true" />
            {copy.results.compare.top}
            <InfoTip text={copy.results.tips.topOne} label={copy.info} />
          </p>
          <h3>{r.hyperion}</h3>
          <p className="audit-card-text">{r.hyperionText}</p>
          <dl className="audit-facts audit-facts-row">
            <div>
              <dt>{r.hyperionMedian}</dt>
              <dd>
                {chf(hyperion.simulation?.percentiles.p50 ?? hyperion.deterministic.final)} CHF
              </dd>
            </div>
            <div>
              <dt>{r.hyperionProbability}</dt>
              <dd>
                {hyperion.simulation?.probabilityAtOrAbove !== null &&
                hyperion.simulation?.probabilityAtOrAbove !== undefined
                  ? pct(hyperion.simulation.probabilityAtOrAbove, 1)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{r.hyperionYears}</dt>
              <dd>{yearsText(hyperion.yearsNeeded)}</dd>
            </div>
          </dl>
          <div className="audit-actions">
            <button type="button" className="audit-button" onClick={onCompare}>
              {r.compareCta}
              <ArrowRight aria-hidden="true" />
            </button>
            <a className="audit-button audit-button-light" href={walletUrl}>
              {r.walletCta}
            </a>
            <a className="audit-link" href="/contact">
              {r.contactCta}
            </a>
          </div>
        </article>
      )}
      <p className="audit-notice">{r.notice}</p>
    </div>
  );
}
