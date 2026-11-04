import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { Award, Plus, X } from "lucide-react";
import { auditCopy as copy } from "../../content/fr/audit";
import type { AuditReport } from "./audit-compute";
import { MAX_COMPARISONS } from "./audit-compute";
import type { Answers } from "./audit-state";
import { ChartTooltip, axisStyle, francTick, gridStroke } from "./charts";
import { chf, interpolate, pct } from "./format";
import { InfoTip } from "./InfoTip";
import { MAX_YEARS_NEEDED } from "./projection";
import { releaseSeriesColor, seriesColor } from "./series-colors";
import { ACCOUNT_ID, HYPERION_ID, strategies } from "./strategies";

const yearsText = (years: number | null) =>
  years === null
    ? copy.results.compare.never
    : years >= MAX_YEARS_NEEDED
      ? interpolate(copy.results.compare.beyond, { max: MAX_YEARS_NEEDED })
      : String(years);

export function CompareTab({
  report,
  answers,
  onRevise,
}: {
  report: AuditReport;
  answers: Answers;
  onRevise: (answers: Answers) => void;
}) {
  const r = copy.results.compare;
  const present = new Set(report.outcomes.map((outcome) => outcome.solution.strategyId));
  const available = strategies.filter(
    (strategy) => !present.has(strategy.id) && strategy.id !== ACCOUNT_ID,
  );
  const compared = report.outcomes.filter(
    (outcome) => outcome.solution.id !== "own" && outcome.solution.strategyId !== HYPERION_ID,
  );
  const add = (id: string) => {
    if (compared.length >= MAX_COMPARISONS - 1) return;
    onRevise({ ...answers, compare: [...compared.map((o) => o.solution.strategyId), id] });
  };
  const remove = (id: string) => {
    releaseSeriesColor(id);
    onRevise({
      ...answers,
      compare: compared.map((o) => o.solution.strategyId).filter((item) => item !== id),
    });
  };
  const rows = report.outcomes.map((outcome) => ({
    outcome,
    id: outcome.solution.id,
    name:
      outcome.solution.id === "own"
        ? `${r.own}${outcome.solution.provider ? ` · ${outcome.solution.provider}` : ""}`
        : outcome.solution.label,
    median: outcome.simulation?.percentiles.p50 ?? outcome.deterministic.final,
    color: seriesColor(outcome.solution.id === "own" ? "own" : outcome.solution.strategyId),
  }));
  const chartRows = [...rows].sort((a, b) => b.median - a.median);
  const target = report.inputs.need.atRetirement;
  const renderTooltip = ({ active, payload }: TooltipContentProps) => {
    const entry = payload?.[0]?.payload as (typeof rows)[number] | undefined;
    if (!active || !entry) return null;
    return (
      <ChartTooltip
        title={entry.name}
        rows={[
          {
            id: entry.id,
            name: r.columns.median.replace("{{age}}", String(answers.retirementAge)),
            value: `${chf(entry.median)} CHF`,
            color: entry.color,
            emphasis: true,
          },
        ]}
      />
    );
  };
  return (
    <div className="audit-stack">
      <div className="audit-section-head">
        <h3>{r.title}</h3>
        <p>{r.text}</p>
      </div>
      <div className="audit-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              <th scope="col">{r.columns.solution}</th>
              <th scope="col">{r.columns.kind}</th>
              <th scope="col">{r.columns.fee}</th>
              <th scope="col">
                {r.columns.cagr}
                <InfoTip text={copy.results.tips.cagr} label={copy.info} />
              </th>
              <th scope="col">{interpolate(r.columns.median, { age: answers.retirementAge })}</th>
              <th scope="col">{r.columns.probability}</th>
              <th scope="col">
                {r.columns.years}
                <InfoTip text={copy.results.tips.yearsNeeded} label={copy.info} />
              </th>
              <th scope="col">
                <span className="audit-visually-hidden">{r.remove}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ outcome, id, name, median, color }) => {
              const { solution, simulation } = outcome;
              const isHyperion = solution.strategyId === HYPERION_ID;
              const removable = id !== "own" && !isHyperion;
              const fee = strategies.find((s) => s.id === solution.strategyId)?.fee ?? 0;
              return (
                <tr key={id} className={isHyperion ? "is-top" : id === "own" ? "is-own" : ""}>
                  <th scope="row">
                    <span
                      className="audit-chart-swatch is-square"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    <span>
                      <span className="audit-table-name">{name}</span>
                      <span className="audit-table-sub">
                        {id === "own" ? solution.label : solution.provider}
                        {isHyperion && (
                          <span className="audit-badge audit-badge-inline">
                            <Award aria-hidden="true" />
                            {r.top}
                          </span>
                        )}
                      </span>
                    </span>
                  </th>
                  <td>{solution.kind === "bank" ? r.bank : r.insurance}</td>
                  <td>{pct(fee, 2)}</td>
                  <td>{pct(outcome.cagr, 2)}</td>
                  <td>
                    <strong>{chf(median)} CHF</strong>
                  </td>
                  <td>
                    {simulation?.probabilityAtOrAbove !== null &&
                    simulation?.probabilityAtOrAbove !== undefined
                      ? pct(simulation.probabilityAtOrAbove, 1)
                      : "—"}
                  </td>
                  <td>{yearsText(outcome.yearsNeeded)}</td>
                  <td>
                    {removable && (
                      <button
                        type="button"
                        className="audit-icon-button"
                        aria-label={`${r.remove} ${name}`}
                        onClick={() => remove(solution.strategyId)}
                      >
                        <X aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="audit-add">
        <p>{r.add}</p>
        <div className="audit-presets">
          {available.map((strategy) => (
            <button
              key={strategy.id}
              type="button"
              className="audit-chip"
              disabled={compared.length >= MAX_COMPARISONS - 1}
              onClick={() => add(strategy.id)}
            >
              <Plus aria-hidden="true" />
              {strategy.provider} · {strategy.name}
            </button>
          ))}
        </div>
        {compared.length >= MAX_COMPARISONS - 1 && <p className="audit-hint">{r.max}</p>}
      </div>
      <figure className="audit-figure">
        <figcaption>{r.chartTitle}</figcaption>
        <div className="audit-chart" style={{ height: 56 + chartRows.length * 44 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartRows}
              layout="vertical"
              margin={{ top: 26, right: 120, bottom: 4, left: 4 }}
              barCategoryGap={10}
            >
              <CartesianGrid horizontal={false} stroke={gridStroke} />
              <XAxis
                type="number"
                tickFormatter={francTick}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={170}
                tick={{ ...axisStyle, fill: "#52514e" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={renderTooltip} cursor={{ fill: "#f3f4f8" }} />
              <ReferenceLine
                x={target}
                stroke="#898781"
                label={{
                  value: copy.results.projection.target,
                  position: "top",
                  fill: "#52514e",
                  fontSize: 11,
                }}
              />
              <Bar
                dataKey="median"
                maxBarSize={22}
                radius={[0, 4, 4, 0]}
                isAnimationActive
                animationDuration={700}
              >
                {chartRows.map((row) => (
                  <Cell key={row.id} fill={row.color} />
                ))}
                <LabelList
                  dataKey="median"
                  position="right"
                  formatter={(value: unknown) => `${chf(Number(value))} CHF`}
                  fill="#181923"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}
