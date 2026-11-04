import { useState } from "react";
import { ArrowLeft, Link2, Settings2 } from "lucide-react";
import { auditCopy as copy } from "../../content/fr/audit";
import { SceneBackdrop } from "../scene/SceneBackdrop";
import { AnimatedNumber } from "./AnimatedNumber";
import type { AuditReport } from "./audit-compute";
import { chf, interpolate, pct } from "./format";
import { InfoTip } from "./InfoTip";
import { MAX_YEARS_NEEDED } from "./projection";
import { providerLogos } from "./provider-logos";
import type { Answers } from "./audit-state";

const percentOf = (value: number) => `${Math.round(value * 100)} %`;

/** Le bandeau des résultats : la scène de l’accueil, le verdict en années, puis quatre chiffres. */
export function ResultsHero({
  report,
  answers,
  onRestart,
  onOpenAssumptions,
}: {
  report: AuditReport;
  answers: Answers;
  onRestart: () => void;
  onOpenAssumptions: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { inputs } = report;
  const own = report.outcomes[0];
  if (!own) return null;
  const expected = own.simulation?.percentiles.p50 ?? own.deterministic.final;
  const needed = inputs.need.atRetirement;
  const reached = needed > 0 ? expected / needed : 1;
  const years = own.yearsNeeded;
  const r = copy.results;
  const headline =
    years === null
      ? r.headline.never
      : years === 0
        ? r.headline.reached
        : years >= MAX_YEARS_NEEDED
          ? interpolate(r.headline.beyond, { max: MAX_YEARS_NEEDED })
          : years === 1
            ? r.headline.year
            : interpolate(r.headline.years, { years });
  const sub = interpolate(years === null ? r.headline.subNone : r.headline.sub, {
    age: answers.retirementAge,
    rate: pct(own.cagr, 2),
    left: inputs.yearsToRetirement,
  });
  const logo = answers.provider ? providerLogos[answers.provider] : undefined;
  const strategyLine = own.solution.provider
    ? interpolate(r.strategyLine, { provider: own.solution.provider, strategy: own.solution.label })
    : own.solution.label;
  const share = () => {
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      })
      .catch(() => setCopied(false));
  };
  return (
    <section className="audit-hero" aria-labelledby="audit-headline">
      <SceneBackdrop />
      <div className="audit-container audit-hero-inner">
        <div className="audit-hero-top">
          <button type="button" className="audit-hero-back" onClick={onRestart}>
            <ArrowLeft aria-hidden="true" />
            {copy.nav.restart}
          </button>
          <button type="button" className="audit-hero-back" onClick={onOpenAssumptions}>
            <Settings2 aria-hidden="true" />
            {r.assumptions}
          </button>
        </div>
        <p className="audit-eyebrow audit-eyebrow-light">{r.eyebrow}</p>
        <h1 id="audit-headline" className="audit-headline">
          {headline}
        </h1>
        <p className="audit-hero-sub">
          {sub} <InfoTip text={r.tips.yearsNeeded} label={copy.info} />
        </p>
        <div className="audit-hero-strategy">
          {logo && (
            <span
              className="audit-hero-logo"
              style={logo.background ? { background: logo.background } : undefined}
            >
              <img src={logo.src} alt="" width="48" height="24" />
            </span>
          )}
          <span>{strategyLine}</span>
          <button type="button" className="audit-link audit-link-light" onClick={onOpenAssumptions}>
            {r.change}
          </button>
        </div>
        <dl className="audit-kpis">
          <div>
            <dt>{r.kpis.monthly}</dt>
            <dd>
              <AnimatedNumber value={inputs.monthly} format={chf} />
              <small>{r.kpis.monthlyUnit}</small>
            </dd>
          </div>
          <div>
            <dt>
              {interpolate(r.kpis.expected, { age: answers.retirementAge })}
              <InfoTip text={r.tips.median} label={copy.info} />
            </dt>
            <dd>
              <AnimatedNumber value={expected} format={chf} />
              <small>{r.kpis.chf}</small>
            </dd>
            <p>{r.kpis.expectedHint}</p>
          </div>
          <div>
            <dt>
              {r.kpis.needed}
              <InfoTip text={r.tips.inflation} label={copy.info} />
            </dt>
            <dd>
              <AnimatedNumber value={needed} format={chf} />
              <small>{r.kpis.chf}</small>
            </dd>
            <p>{interpolate(r.kpis.neededHint, { inflation: pct(answers.inflation, 1) })}</p>
          </div>
          <div>
            <dt>{r.kpis.reached}</dt>
            <dd className={reached >= 1 ? "is-good" : reached >= 0.6 ? "is-mid" : "is-low"}>
              <AnimatedNumber value={reached} format={percentOf} />
            </dd>
            <div className="audit-meter audit-meter-light" aria-hidden="true">
              <span style={{ width: `${Math.min(100, reached * 100)}%` }} />
            </div>
          </div>
        </dl>
        <div className="audit-hero-share">
          <button type="button" className="audit-hero-back" onClick={share}>
            <Link2 aria-hidden="true" />
            {copied ? r.shared : r.share}
          </button>
          <span>{r.shareNote}</span>
        </div>
      </div>
    </section>
  );
}
