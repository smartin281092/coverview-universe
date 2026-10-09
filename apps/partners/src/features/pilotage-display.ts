import type { PilotageMeasure, PilotageQuery } from "@coverview/contracts/partner-pilotage";
import { parseZurichDateTime } from "@coverview/ui";
import { numberFormat } from "@coverview/ui/number-format";
export function pilotagePeriod(preset: "month" | "previous" | "quarter" | "year" = "month") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === "year")!.value),
    month = Number(parts.find((p) => p.type === "month")!.value) - 1;
  const startMonth =
    preset === "year"
      ? 0
      : preset === "quarter"
        ? Math.floor(month / 3) * 3
        : preset === "previous"
          ? month - 1
          : month;
  const start = new Date(Date.UTC(year, startMonth, 1)),
    end = new Date(
      Date.UTC(year, startMonth + (preset === "year" ? 12 : preset === "quarter" ? 3 : 1), 1),
    );
  const local = (date: Date) => parseZurichDateTime(`${date.toISOString().slice(0, 10)}T00:00`);
  return { from: local(start), to: local(end) };
}
export const defaultPilotageQuery = (): PilotageQuery => ({ ...pilotagePeriod(), scope: "self" });
export function formatMeasure(
  value: number | null,
  unit: PilotageMeasure["unit"],
  locale = "fr-CH",
) {
  if (value === null) return "—";
  return numberFormat(
    locale,
    unit === "chf_minor"
      ? { style: "currency", currency: "CHF", maximumFractionDigits: 2 }
      : unit === "percent"
        ? { style: "percent", maximumFractionDigits: 1 }
        : { maximumFractionDigits: 2 },
  ).format(unit === "chf_minor" ? value / 100 : unit === "percent" ? value / 100 : value);
}
