import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { auditCopy as copy } from "../../content/fr/audit";
import type { AuditReport } from "./audit-compute";
import { ChartLegend, ChartTooltip, axisStyle, francTick, gridStroke } from "./charts";
import { chf, interpolate, pct } from "./format";
import { InfoTip } from "./InfoTip";
import { seriesColor } from "./series-colors";

export function ProjectionTab({ report }: { report: AuditReport }) {
  const r = copy.results.projection;
  const [picked, setPicked] = useState("own");
  const outcomes = report.outcomes.filter((outcome) => outcome.simulation);
  const current = outcomes.find((outcome) => outcome.solution.id === picked) ?? outcomes[0];
  if (!current?.simulation) return null;
  const colorOf = (id: string, strategyId: string) =>
    seriesColor(id === "own" ? "own" : strategyId);
  const nameOf = (id: string, label: string) =>
    id === "own" ? `${copy.results.compare.own} · ${label}` : label;
  const color = colorOf(current.solution.id, current.solution.strategyId);
  const { age } = report.inputs;
  const target = report.inputs.need.atRetirement;
  const data = current.simulation.yearly.map((point, position) => {
    const row: Record<string, number> = {
      age: age + point.year,
      low: point.p10,
      band: point.p90 - point.p10,
      quartileLow: point.p25,
      quartile: point.p75 - point.p25,
      median: point.p50,
    };
    for (const outcome of outcomes)
      if (outcome !== current && outcome.simulation)
        row[outcome.solution.id] = outcome.simulation.yearly[position]?.p50 ?? 0;
    return row;
  });
  const legend = [
    { id: "band", name: r.band, color: `${color}33` },
    { id: "quartiles", name: r.quartiles, color: `${color}66` },
    {
      id: "median",
      name: `${r.median} · ${nameOf(current.solution.id, current.solution.label)}`,
      color,
    },
    ...outcomes
      .filter((outcome) => outcome !== current)
      .map((outcome) => ({
        id: outcome.solution.id,
        name: `${r.median} · ${nameOf(outcome.solution.id, outcome.solution.label)}`,
        color: colorOf(outcome.solution.id, outcome.solution.strategyId),
      })),
  ];
  const renderTooltip = ({ active, payload, label }: TooltipContentProps) => {
    const row = payload?.[0]?.payload as Record<string, number> | undefined;
    if (!active || !row) return null;
    return (
      <ChartTooltip
        title={interpolate(r.age, { age: String(label) })}
        rows={[
          {
            id: "p90",
            name: "p90",
            value: `${chf(row.low! + row.band!)} CHF`,
            color: `${color}55`,
          },
          {
            id: "p75",
            name: "p75",
            value: `${chf(row.quartileLow! + row.quartile!)} CHF`,
            color: `${color}88`,
          },
          {
            id: "median",
            name: `${r.median} · ${current.solution.label}`,
            value: `${chf(row.median!)} CHF`,
            color,
            emphasis: true,
          },
          { id: "p25", name: "p25", value: `${chf(row.quartileLow!)} CHF`, color: `${color}88` },
          { id: "p10", name: "p10", value: `${chf(row.low!)} CHF`, color: `${color}55` },
          ...outcomes
            .filter((outcome) => outcome !== current)
            .map((outcome) => ({
              id: outcome.solution.id,
              name: `${r.median} · ${outcome.solution.label}`,
              value: `${chf(row[outcome.solution.id] ?? 0)} CHF`,
              color: colorOf(outcome.solution.id, outcome.solution.strategyId),
            })),
        ]}
      />
    );
  };
  const ranges = current.simulation.ranges;
  const probability = current.simulation.probabilityAtOrAbove;
  return (
    <div className="audit-stack">
      <div className="audit-section-head">
        <h3>{r.title}</h3>
        <p>
          {r.text} <InfoTip text={copy.results.tips.bootstrap} label={copy.info} />
        </p>
      </div>
      <div className="audit-picker" role="group" aria-label={r.strategyPicker}>
        <span>{r.strategyPicker}</span>
        {outcomes.map((outcome) => (
          <button
            key={outcome.solution.id}
            type="button"
            className={`audit-chip ${outcome === current ? "is-active" : ""}`}
            aria-pressed={outcome === current}
            onClick={() => setPicked(outcome.solution.id)}
          >
            <span
              className="audit-chart-swatch is-square"
              style={{ backgroundColor: colorOf(outcome.solution.id, outcome.solution.strategyId) }}
              aria-hidden="true"
            />
            {nameOf(outcome.solution.id, outcome.solution.label)}
          </button>
        ))}
      </div>
      <figure className="audit-figure">
        <ChartLegend items={legend} shape="line" />
        <div className="audit-chart audit-chart-tall">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} />
              <XAxis
                dataKey="age"
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value: number) => interpolate(r.age, { age: value })}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={francTick}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={56}
              />
              <Tooltip content={renderTooltip} />
              <Area
                dataKey="low"
                stackId="band"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                activeDot={false}
              />
              <Area
                dataKey="band"
                stackId="band"
                stroke="none"
                fill={color}
                fillOpacity={0.12}
                isAnimationActive
                animationDuration={800}
                activeDot={false}
              />
              <Area
                dataKey="quartileLow"
                stackId="quartiles"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                activeDot={false}
              />
              <Area
                dataKey="quartile"
                stackId="quartiles"
                stroke="none"
                fill={color}
                fillOpacity={0.18}
                isAnimationActive
                animationDuration={800}
                activeDot={false}
              />
              <ReferenceLine
                y={target}
                stroke="#898781"
                label={{
                  value: r.target,
                  position: "insideTopLeft",
                  fill: "#52514e",
                  fontSize: 11,
                }}
              />
              {outcomes
                .filter((outcome) => outcome !== current)
                .map((outcome) => (
                  <Line
                    key={outcome.solution.id}
                    type="monotone"
                    dataKey={outcome.solution.id}
                    stroke={colorOf(outcome.solution.id, outcome.solution.strategyId)}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 2, stroke: "#fff" }}
                    isAnimationActive
                    animationDuration={900}
                  />
                ))}
              <Line
                type="monotone"
                dataKey="median"
                stroke={color}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                isAnimationActive
                animationDuration={900}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <div className="audit-card">
        <h3>
          {r.ranges} · {nameOf(current.solution.id, current.solution.label)}
          <InfoTip text={copy.results.tips.percentile} label={copy.info} />
        </h3>
        <p className="audit-card-text">{r.rangesText}</p>
        {probability !== null && (
          <p className="audit-reach">
            <strong>{interpolate(r.reach, { probability: pct(probability, 1) })}</strong>
            <span className="audit-meter" aria-hidden="true">
              <span style={{ width: `${probability * 100}%` }} />
            </span>
          </p>
        )}
        <div className="audit-table-wrap">
          <table className="audit-table audit-table-dense">
            <thead>
              <tr>
                <th scope="col">{r.ranges}</th>
                <th scope="col">{r.probability}</th>
                <th scope="col">
                  {r.from} … {r.to}
                </th>
              </tr>
            </thead>
            <tbody>
              {ranges.map((range) => (
                <tr
                  key={range.id}
                  className={
                    range.id === "median-low" || range.id === "median-high" ? "is-core" : ""
                  }
                >
                  <th scope="row">{r.rangeLabels[range.id]}</th>
                  <td>
                    <span className="audit-range-bar" aria-hidden="true">
                      <span
                        style={{
                          width: `${Math.min(100, range.probability * 100 * 2.5)}%`,
                          backgroundColor: color,
                        }}
                      />
                    </span>
                    {pct(range.probability, 1)}
                  </td>
                  <td>
                    {range.extremes
                      ? `${r.below} ${chf(range.extremes.lowMax)} CHF (${pct(range.extremes.lowProbability, 1)}) · ${r.above} ${chf(range.extremes.highMin)} CHF (${pct(range.extremes.highProbability, 1)})`
                      : `${chf(range.min)} – ${chf(range.max)} CHF`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="audit-notice">{copy.results.synthesis.notice}</p>
      <p className="audit-hint">
        {interpolate(r.simulations, {
          count: chf(current.simulation.simulations),
          years: current.simulation.yearly.length - 1,
        })}
      </p>
    </div>
  );
}
