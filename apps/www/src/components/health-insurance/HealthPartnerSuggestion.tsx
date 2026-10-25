import type {
  HealthOffer,
  HealthPremiumDifference as Difference,
} from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { offerCopy } from "../../content/fr/insurance-requests";
import { HealthGradient } from "./HealthGradient";
import { HealthInsurerLogo } from "./HealthOfferIdentity";
import { HealthPremiumDifference } from "./HealthPremiumDifference";
import { HealthProductImage } from "./HealthProductImage";
import { money } from "./health-format";

// Under the greyed request of a model CoverView cannot handle yet (user request, 25 October
// 2026): a model it can, its picture, insurer and model, savings, price and a small cart button.
// The whole box opens that model; the cart button stays a separate control above it.
export function HealthPartnerSuggestion({
  offer,
  difference,
  onOpen,
  onRequest,
}: {
  offer: HealthOffer;
  difference?: Difference | undefined;
  onOpen: (offer: HealthOffer) => void;
  onRequest: (offer: HealthOffer) => void;
}) {
  return (
    <div className="hi-suggestion">
      <HealthProductImage offer={offer} thumbnail fallback={<HealthInsurerLogo offer={offer} />} />
      <div className="hi-suggestion-model">
        {/* The insurer, then the model beneath it in the eyebrow font (25 October 2026). */}
        <button
          type="button"
          className="hi-suggestion-open"
          aria-label={`${offer.insurerBrand ?? offer.insurerName} · ${offer.name}`}
          onClick={() => onOpen(offer)}
        >
          <span>{offer.insurerBrand ?? offer.insurerName}</span>
          <span className="hi-suggestion-name">{offer.name}</span>
        </button>
        <HealthPremiumDifference value={difference} />
      </div>
      <div className="hi-suggestion-price">
        <p>
          {money(offer.monthlyPremiumMinor)}
          <span className="hi-price-unit">
            <small>{copy.currency}</small>
            <em>{copy.perMonth}</em>
          </span>
        </p>
        <button type="button" className="hi-primary" onClick={() => onRequest(offer)}>
          <HealthGradient />
          {offerCopy.add}
        </button>
      </div>
    </div>
  );
}
