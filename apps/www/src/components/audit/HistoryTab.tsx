import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { auditCopy as copy } from "../../content/fr/audit";
import type { AuditReport } from "./audit-compute";
import { ChartLegend, ChartTooltip, axisStyle, gridStroke, percentTick } from "./charts";
import { chf, signedPct } from "./format";
import { cumulativeIndex } from "./projection";
import { seriesColor } from "./series-colors";
import { FIRST_YEAR, YEARS, type YearNature } from "./strategies";

const natureOrder: YearNature[] = [
  "published",
  "proxy",
  "provider",
  "legacy",
  "communicated",
  "assumption",
];

export function HistoryTab({ report }: { report: AuditReport }) {
  const r = copy.results.history;
  const [table, setTable] = useState(false);
  const series = report.outcomes.map((outcome) => ({
    id: outcome.solution.id,
    key: outcome.solution.id === "own" ? "own" : outcome.solution.strategyId,
    name:
      outcome.solution.id === "own"
        ? `${copy.results.compare.own} · ${outcome.solution.label}`
        : outcome.solution.label,
    color: seriesColor(outcome.solution.id === "own" ? "own" : outcome.solution.strategyId),
    returns: outcome.solution.returns,
    natures: outcome.solution.natures,
    index: cumulativeIndex(outcome.solution.returns),
  }));
  const yearly = YEARS.map((year, position) => {
    const row: Record<string, number> = { year };
    for (const item of series) row[item.key] = item.returns[position] ?? 0;
    return row;
  });
  const cumulative = [FIRST_YEAR - 1, ...YEARS].map((year, position) => {
    const row: Record<string, number> = { year };
    for (const item of series) row[item.key] = item.index[position] ?? 100;
    return row;
  });
  const legend = series.map(({ id, name, color }) => ({ id, name, color }));
  const tooltip =
    (format: (value: number) => string) =>
    ({ active, payload, label }: TooltipContentProps) => {
      if (!active || !payload?.length) return null;
      return (
        <ChartTooltip
          title={String(label)}
          rows={payload.map((entry) => {
            const item = series.find((s) => s.key === entry.dataKey);
            return {
              id: String(entry.dataKey),
              name: item?.name ?? String(entry.name),
              value: format(Number(entry.value)),
              color: item?.color ?? "#898781",
            };
          })}
        />
      );
    };
  const usedNatures = natureOrder.filter((nature) =>
    series.some((item) => item.natures.includes(nature)),
  );
  return (
    <div className="audit-stack">
      <div className="audit-section-head">
        <h3>{r.title}</h3>
        <p>{r.text}</p>
      </div>
      <figure className="audit-figure">
        <figcaption>{r.yearly}</figcaption>
        <ChartLegend items={legend} />
        <div className="audit-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={yearly}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              barGap={2}
              barCategoryGap="22%"
            >
              <CartesianGrid vertical={false} stroke={gridStroke} />
              <XAxis dataKey="year" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={percentTick}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <ReferenceLine y={0} stroke="#c3c2b7" />
              <Tooltip
                content={tooltip((value) => signedPct(value, 2))}
                cursor={{ fill: "#f3f4f8" }}
              />
              {series.map((item) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  fill={item.color}
                  maxBarSize={18}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive
                  animationDuration={700}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <figure className="audit-figure">
        <figcaption>
          {r.cumulative} <span className="audit-figure-hint">· {r.cumulativeHint}</span>
        </figcaption>
        <ChartLegend items={legend} shape="line" />
        <div className="audit-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulative} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={gridStroke} />
              <XAxis dataKey="year" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis
                tickFormatter={(value: number) => chf(value)}
                tick={axisStyle}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip content={tooltip((value) => `${chf(value)} CHF`)} />
              {series.map((item) => (
                <Line
                  key={item.key}
                  type="monotone"
                  dataKey={item.key}
                  stroke={item.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
                  isAnimationActive
                  animationDuration={900}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>
      <div>
        <button
          type="button"
          className="audit-link"
          aria-expanded={table}
          onClick={() => setTable((value) => !value)}
        >
          {table ? r.hideTable : r.table}
        </button>
        {table && (
          <div className="audit-table-wrap">
            <table className="audit-table audit-table-dense">
              <thead>
                <tr>
                  <th scope="col">{r.year}</th>
                  {series.map((item) => (
                    <th key={item.key} scope="col">
                      {item.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {YEARS.map((year, position) => (
                  <tr key={year}>
                    <th scope="row">{year}</th>
                    {series.map((item) => (
                      <td key={item.key}>
                        {signedPct(item.returns[position] ?? 0, 2)}
                        <sup title={r.natures[item.natures[position] ?? "assumption"]}>
                          {r.natureShort[item.natures[position] ?? "assumption"]}
                        </sup>
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">{r.index}</th>
                  {series.map((item) => (
                    <td key={item.key}>{chf(item.index[item.index.length - 1] ?? 100)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="audit-hint">
              {r.legend} :{" "}
              {usedNatures
                .map((nature) => `${r.natureShort[nature]} = ${r.natures[nature]}`)
                .join(" · ")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
