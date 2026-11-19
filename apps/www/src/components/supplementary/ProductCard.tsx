import type { SupplementaryProduct } from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthIcon } from "../health-insurance/HealthIcon";
import { ScInsurerLogo, ScPartnerTag } from "./ScIdentity";
import { PriceTag } from "./PriceTag";
import {
  benefitTitle,
  categoryLabel,
  coverageShort,
  familyLabel,
  mainBenefits,
  plural,
  structured,
  type CatalogIndex,
  type PriceSummary,
} from "./supplementary-model";

const shownBenefits = 4;
const shownFamilies = 3;

/**
 * One product as an e-commerce card: identity, category, price for the profile, benefit families,
 * four main benefits and the rest in a dialog. The name opens the side panel; the whole card is
 * its hit area, the other controls stay above it.
 */
export function ProductCard({
  index,
  product,
  price,
  chosenTags,
  reasons,
  compared,
  compareDisabled,
  onOpen,
  onBenefits,
  onCompare,
}: {
  index: CatalogIndex;
  product: SupplementaryProduct;
  price: PriceSummary;
  chosenTags: string[];
  reasons: string[] | undefined;
  compared: boolean;
  compareDisabled: boolean;
  onOpen: () => void;
  onBenefits: () => void;
  onCompare: () => void;
}) {
  const insurer = index.insurers.get(product.insurer);
  const main = mainBenefits(product, chosenTags, shownBenefits);
  const more = product.benefits.length - main.length;
  const families = product.families.filter((family) => index.taxonomyFamilies.has(family));
  return (
    <article className="sc-card" aria-labelledby={`sc-card-${product.key}`}>
      <div className="sc-card-brand">
        <ScInsurerLogo insurer={insurer} />
        <span className="sc-card-insurer">{insurer?.name}</span>
        {insurer?.partner && <ScPartnerTag />}
      </div>
      <h3 className="sc-card-title">
        <button
          type="button"
          id={`sc-card-${product.key}`}
          className="sc-card-open"
          onClick={onOpen}
        >
          {product.name}
        </button>
      </h3>
      <p className="sc-card-category">{categoryLabel(index, product.category)}</p>
      <PriceTag price={price} />
      {families.length > 0 && (
        <ul className="sc-chips" aria-label={copy.filters.benefits}>
          {families.slice(0, shownFamilies).map((family) => (
            <li key={family}>{familyLabel(index, family)}</li>
          ))}
          {families.length > shownFamilies && <li>+{families.length - shownFamilies}</li>}
        </ul>
      )}
      {reasons && reasons.length > 0 && (
        <ul className="sc-reasons" aria-label={copy.assistant.reasons}>
          {reasons.slice(0, 2).map((reason) => (
            <li key={reason}>
              <HealthIcon name="spark" size={13} />
              {reason}
            </li>
          ))}
        </ul>
      )}
      <ul className="sc-card-benefits">
        {main.map((benefit) => (
          <li key={benefit.id}>
            <span title={benefit.label}>{benefitTitle(index, benefit)}</span>
            <strong className={structured(benefit) ? "is-short" : undefined}>
              {coverageShort(benefit)}
            </strong>
          </li>
        ))}
      </ul>
      <div className="sc-card-footer">
        {more > 0 ? (
          <button type="button" className="sc-more" onClick={onBenefits}>
            {plural(copy.card.moreBenefits, more)}
          </button>
        ) : (
          <span />
        )}
        <label className={`sc-compare-check${compareDisabled && !compared ? " is-disabled" : ""}`}>
          <input
            type="checkbox"
            checked={compared}
            disabled={compareDisabled && !compared}
            onChange={onCompare}
          />
          {copy.card.compare}
        </label>
      </div>
    </article>
  );
}
