import type { ReactNode } from "react";
import { chf, pct } from "./format";
import { CHART_INK } from "./series-colors";

/** Lignes d’une infobulle de graphique : la valeur en avant, la série en second, une clé colorée. */
export type TooltipRow = {
  id: string;
  name: string;
  value: string;
  color: string;
  emphasis?: boolean;
};

export function ChartTooltip({ title, rows }: { title: ReactNode; rows: TooltipRow[] }) {
  return (
    <div className="audit-chart-tooltip" role="presentation">
      <p className="audit-chart-tooltip-title">{title}</p>
      <ul>
        {rows.map((row) => (
          <li key={row.id} className={row.emphasis ? "is-strong" : ""}>
            <span
              className="audit-chart-key"
              style={{ backgroundColor: row.color }}
              aria-hidden="true"
            />
            <strong>{row.value}</strong>
            <span>{row.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const axisStyle = { fill: CHART_INK.muted, fontSize: 11 } as const;
export const gridStroke = CHART_INK.grid;
export const percentTick = (value: number) => pct(value, 1).replace(",0 %", " %");
export const francTick = (value: number) =>
  Math.abs(value) >= 1_000_000
    ? `${(value / 1_000_000).toFixed(1).replace(".", ",")} M`
    : Math.abs(value) >= 1000
      ? `${Math.round(value / 1000)} k`
      : chf(value);

/** Légende commune : un carré ou un trait par série, le nom en encre, jamais en couleur. */
export function ChartLegend({
  items,
  shape = "square",
}: {
  items: { id: string; name: string; color: string }[];
  shape?: "square" | "line";
}) {
  return (
    <ul className="audit-chart-legend">
      {items.map((item) => (
        <li key={item.id}>
          <span
            className={`audit-chart-swatch is-${shape}`}
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.name}
        </li>
      ))}
    </ul>
  );
}
