import type { HealthPremiumDifference as Difference } from "@coverview/api-client/health-insurance";
import { healthCurrentCopy as copy } from "../../content/fr/health-current";
import { interpolate, money } from "./health-format";

export function HealthPremiumDifference({
  value,
  detail = false,
}: {
  value?: Difference | undefined;
  detail?: boolean;
}) {
  if (!value) return null;
  const label =
    value.direction === "equal"
      ? copy.equal
      : interpolate(copy[value.direction], { amount: money(Math.abs(value.annualSavingMinor)) });
  return (
    <span className={`hi-premium-difference is-${value.direction}${detail ? " is-detail" : ""}`}>
      <strong className="hi-difference-heading">
        {value.direction !== "equal" && (
          <svg
            className="hi-price-trend"
            viewBox="0 0 20 30"
            width="8"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m4 4 6 5 6-5" />
            <path d="m4 12 6 5 6-5" />
            <path d="m4 20 6 5 6-5" />
          </svg>
        )}
        <span>{label}</span>
      </strong>
      {detail && value.direction !== "equal" && (
        <span>
          {interpolate(value.direction === "saving" ? copy.monthlySaving : copy.monthlyIncrease, {
            amount: money(Math.abs(value.monthlySavingMinor)),
          })}{" "}
          · {copy.comparedWith}
        </span>
      )}
    </span>
  );
}
