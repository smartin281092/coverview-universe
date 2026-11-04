import { useEffect, useMemo, useState } from "react";
import { PixelField } from "@coverview/ui/pixel-field";
import { hyperionUi } from "../../content/fr/hyperion-ui";
import { HealthGradient } from "../health-insurance/HealthGradient";
import { ArrowIcon } from "./HyperionIcons";
import { HyperionFields } from "./HyperionFields";
import { simulateMonteCarlo } from "./hyperion-monte-carlo-client";
import {
  annualisedReturn,
  formatFrancs,
  formatPercent,
  formatProbability,
  historicalProjection,
  netReturns,
  yearsUntilRetirement,
  type Projection,
} from "./hyperion-model";
import type { MonteCarloResult } from "./hyperion-monte-carlo";
import { requestOrder, updateConfig, useHyperionConfig } from "./hyperion-store";

const copy = hyperionUi.simulator;
const mc = copy.monteCarlo;
const rate = annualisedReturn(netReturns());
const interpolate = (template: string, values: Record<string, string>) =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );
type MonteCarloState =
  { status: "loading" } | { status: "ready"; result: MonteCarloResult } | { status: "error" };

function ProjectionChart({ projection, startYear }: { projection: Projection; startYear: number }) {
  const width = 720;
  const height = 260;
  const left = 16;
  const right = 704;
  const top = 24;
  const bottom = 236;
  const max = Math.max(projection.finalCapital, 1);
  const x = (index: number) =>
    left + (index / Math.max(projection.points.length - 1, 1)) * (right - left);
  const y = (value: number) => bottom - (value / max) * (bottom - top);
  const path = (key: "invested" | "capital") =>
    projection.points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point[key]).toFixed(2)}`,
      )
      .join(" ");
  const capital = path("capital");
  return (
    <div className="hp-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={copy.chart.alt}>
        <defs>
          <linearGradient id="hp-projection-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3d3fb5" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#3d3fb5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <path
            key={fraction}
            d={`M${left},${y(max * fraction)} H${right}`}
            className="graph-grid"
          />
        ))}
        <path
          d={`${capital} L${right},${bottom} L${left},${bottom} Z`}
          fill="url(#hp-projection-fill)"
        />
        <path d={path("invested")} className="graph-line graph-line-a" />
        <path d={capital} className="graph-line graph-line-b" />
        <circle cx={right} cy={y(projection.finalCapital)} r="5" className="graph-dot" />
      </svg>
      <div className="graph-axis">
        <span>{startYear}</span>
        <span>{startYear + projection.points.length}</span>
      </div>
      <div className="hp-chart-legend">
        <span>
          <i className="dot dot-a" />
          {copy.chart.invested}
        </span>
        <span>
          <i className="dot dot-b" />
          {copy.chart.capital}
        </span>
      </div>
    </div>
  );
}

function MonteCarloPanel({
  state,
  projection,
  invested,
}: {
  state: MonteCarloState;
  projection: number;
  invested: number;
}) {
  if (state.status === "loading")
    return (
      <p className="hp-mc-status" aria-live="polite">
        {mc.computing}
      </p>
    );
  if (state.status === "error")
    return (
      <p className="hp-mc-status" role="alert">
        {mc.unavailable}
      </p>
    );
  const { result } = state;
  const central = result.ranges.central.filter((range) => range.probability > 0);
  const centralShare = central.reduce((sum, range) => sum + range.probability, 0);
  const peak = Math.max(...result.histogram.bins, 1);
  const position = (value: number) =>
    Math.max(
      0,
      Math.min(
        100,
        ((value - result.histogram.from) / (result.histogram.to - result.histogram.from)) * 100,
      ),
    );
  const chf = (value: number) => `${formatFrancs(value)} CHF`;
  return (
    <div className="hp-mc">
      <div className="hp-mc-head">
        <div>
          <h3>{mc.title}</h3>
          <p className="hp-mc-count">
            {interpolate(mc.count, { count: formatFrancs(result.simulations) })}
          </p>
        </div>
        <p className="hp-mc-method">
          {interpolate(mc.method, { observations: String(result.observations) })}
        </p>
      </div>
      <div className="hp-mc-tiles">
        <div className="hp-mc-tile hp-mc-tile-median hp-card-dark">
          <PixelField className="hp-pixels" />
          <p>{mc.median}</p>
          <strong>{chf(result.median)}</strong>
          <small>{mc.medianNote}</small>
        </div>
        <div className="hp-mc-tile">
          <p>{mc.position}</p>
          <strong>{formatProbability(result.probabilityAboveHistoricalProjection)}</strong>
          <small>
            {interpolate(mc.positionNote, {
              probability: formatProbability(result.probabilityAboveHistoricalProjection),
            })}
          </small>
          <span className="hp-mc-bar" aria-hidden="true">
            <i style={{ width: `${result.probabilityAboveHistoricalProjection * 100}%` }} />
          </span>
        </div>
      </div>
      <figure className="hp-histogram">
        <figcaption>{mc.histogram}</figcaption>
        <div className="hp-histogram-bars" aria-hidden="true">
          {result.histogram.bins.map((count, index) => (
            <i key={index} style={{ height: `${(count / peak) * 100}%` }} />
          ))}
          <span
            className="hp-histogram-marker hp-histogram-median"
            style={{ left: `${position(result.median)}%` }}
          >
            <em>{mc.median}</em>
          </span>
          <span
            className="hp-histogram-marker hp-histogram-projection"
            style={{ left: `${position(projection)}%` }}
          >
            <em>{copy.projection}</em>
          </span>
        </div>
        <div className="hp-histogram-axis" aria-hidden="true">
          <span>{chf(result.histogram.from)}</span>
          <span>{chf(result.histogram.to)}</span>
        </div>
      </figure>
      <div className="hp-mc-ranges">
        <div className="hp-mc-ranges-head">
          <div>
            <p>{mc.central}</p>
            <small>{mc.centralNote}</small>
          </div>
          <span>
            {interpolate(mc.centralShare, { probability: formatProbability(centralShare) })}
          </span>
        </div>
        <ul>
          {central.map((range) => (
            <li key={range.id} className={range.emphasis === "central" ? "is-central" : undefined}>
              <span>{mc.ranges[range.id]}</span>
              <strong>{`${chf(range.min)} – ${chf(range.max)}`}</strong>
              <em>{formatProbability(range.probability)}</em>
            </li>
          ))}
        </ul>
        <ul className="hp-mc-extremes">
          <li>
            <span>{mc.extremeLow}</span>
            <strong>{`< ${chf(result.ranges.extremes.low.max)}`}</strong>
            <em>{formatProbability(result.ranges.extremes.low.probability)}</em>
          </li>
          <li>
            <span>{mc.extremeHigh}</span>
            <strong>{`> ${chf(result.ranges.extremes.high.min)}`}</strong>
            <em>{formatProbability(result.ranges.extremes.high.probability)}</em>
          </li>
        </ul>
        <p className="hp-mc-below">
          {interpolate(mc.belowInvested, {
            probability: formatProbability(result.probabilityBelowInvested),
          })}
          {` (${chf(invested)})`}
        </p>
      </div>
      <p className="hp-mc-disclaimer">{mc.disclaimer}</p>
    </div>
  );
}

/** The simulator section: projection at the annualised rate and the Monte Carlo distribution. */
export default function HyperionSimulator({ currentYear }: { currentYear: number }) {
  const config = useHyperionConfig();
  const years = yearsUntilRetirement(config.birthYear, currentYear);
  const input = useMemo(
    () => ({
      investment: config.investment,
      frequency: config.frequency,
      years,
      initialCapital: config.initialCapital,
    }),
    [config.investment, config.frequency, years, config.initialCapital],
  );
  const projection = years >= 1 ? historicalProjection(input, rate) : null;
  const finalCapital = projection?.finalCapital ?? 0;
  const [state, setState] = useState<MonteCarloState>({ status: "loading" });
  useEffect(() => {
    if (!projection) return;
    let active = true;
    setState({ status: "loading" });
    const timeout = window.setTimeout(() => {
      simulateMonteCarlo({ ...input, historicalProjection: finalCapital })
        .then((result) => {
          if (active) setState({ status: "ready", result });
        })
        .catch(() => {
          if (active) setState({ status: "error" });
        });
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [input, finalCapital]);
  return (
    <div className="hp-simulator">
      <div className="hp-simulator-controls">
        <p className="lp-eyebrow">{copy.parameters}</p>
        <HyperionFields
          config={config}
          onChange={updateConfig}
          currentYear={currentYear}
          prefix="hp-sim"
        />
        <button type="button" className="lp-text-link" data-open-dialog="hyperion-assumptions">
          {copy.assumptions}
          <span aria-hidden="true">↗</span>
        </button>
      </div>
      <div className="hp-simulator-results">
        {projection ? (
          <>
            <div className="hp-projection">
              <div className="hp-projection-head">
                <div>
                  <p className="lp-eyebrow">{copy.projection}</p>
                  <p className="hp-projection-note">
                    {interpolate(copy.projectionNote, { rate: formatPercent(rate) })}
                  </p>
                </div>
                <span className="hp-projection-horizon">{`${copy.horizon} · ${years} ${copy.years}`}</span>
              </div>
              <div className="hp-projection-figures">
                <div>
                  <p>{copy.invested}</p>
                  <strong>{`${formatFrancs(projection.totalInvested)} CHF`}</strong>
                </div>
                <div className="is-capital">
                  <p>{copy.capital}</p>
                  <strong>{`${formatFrancs(projection.finalCapital)} CHF`}</strong>
                </div>
                <div>
                  <p>{copy.gain}</p>
                  <strong>{`${formatFrancs(projection.finalCapital - projection.totalInvested)} CHF`}</strong>
                </div>
              </div>
              <ProjectionChart projection={projection} startYear={currentYear} />
            </div>
            <MonteCarloPanel
              state={state}
              projection={projection.finalCapital}
              invested={projection.totalInvested}
            />
            <button type="button" className="lp-button hp-cta" onClick={requestOrder}>
              <HealthGradient />
              {copy.cta}
              <ArrowIcon />
            </button>
          </>
        ) : (
          <p className="hp-buy-note">{hyperionUi.buy.horizonShort}</p>
        )}
      </div>
    </div>
  );
}
