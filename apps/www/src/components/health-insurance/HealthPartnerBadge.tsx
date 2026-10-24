import type { HealthOffer } from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";
import { interpolate } from "./health-format";

// The model page's partner badge, beside the price (user decision, 24 October 2026): CoverView's
// recommendation of every model of its partner insurers, in Gold, the « i » saying why. The other
// models carry nothing: no rating is invented.
export function HealthPartnerBadge({
  offer,
}: {
  offer: Pick<HealthOffer, "insurerBrand" | "insurerName">;
}) {
  return (
    <section className="hi-partner-badge" aria-labelledby="hi-partner-badge-title">
      <h4 id="hi-partner-badge-title">{copy.partnerBadge.title}</h4>
      <div className="hi-partner-badge-level">
        <span className="hi-partner-badge-gold">{copy.partnerBadge.level}</span>
        <div className="hi-info-tooltip hi-partner-badge-info">
          <button
            type="button"
            aria-label={copy.partnerBadge.details}
            aria-describedby="hi-partner-badge-why"
          >
            <HealthIcon name="info-i" size={18} />
          </button>
          <span role="tooltip" id="hi-partner-badge-why">
            {interpolate(copy.partnerBadge.disclosure, {
              insurer: offer.insurerBrand ?? offer.insurerName,
            })}
          </span>
        </div>
      </div>
    </section>
  );
}
