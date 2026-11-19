import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { chf, interpolate, summaryAmount, type PriceSummary } from "./supplementary-model";

// A product's price for the profile: « dès X », a female–male range, or « Prix sur demande »
// with the insurer's published price when there is one.
export function PriceTag({ price, compact = false }: { price: PriceSummary; compact?: boolean }) {
  if (price.kind === "quote")
    return (
      <div className={`sc-price${compact ? " is-compact" : ""}`}>
        <strong>{summaryAmount(price)}</strong>
        <span>
          {copy.currency} {copy.perMonth}
        </span>
      </div>
    );
  return (
    <div className={`sc-price is-request${compact ? " is-compact" : ""}`}>
      <strong>{copy.price.onRequest}</strong>
      {price.kind === "published" && (
        <span title={price.profile}>
          {interpolate(copy.price.published, { amount: chf(price.monthlyMinor) })}
        </span>
      )}
    </div>
  );
}
