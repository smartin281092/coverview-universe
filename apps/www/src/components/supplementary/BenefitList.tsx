import type {
  SupplementaryBenefit,
  SupplementaryProduct,
} from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import {
  coverageShort,
  familyLabel,
  groupBenefits,
  interpolate,
  structured,
  variantName,
  type CatalogIndex,
} from "./supplementary-model";

const text = copy.coverage;

/**
 * Every benefit of a product, grouped by family: the short coverage first, then, in the detailed
 * view, the insurer's wording, waiting period, conditions and source.
 */
export function BenefitList({
  index,
  product,
  benefits = product.benefits,
  detailed = false,
}: {
  index: CatalogIndex;
  product: SupplementaryProduct;
  benefits?: SupplementaryBenefit[];
  detailed?: boolean;
}) {
  return (
    <div className={`sc-benefit-groups${detailed ? " is-detailed" : ""}`}>
      {groupBenefits(index, benefits).map((group) => (
        <section key={group.family ?? "other"} className="sc-benefit-group">
          <h4>{group.family ? familyLabel(index, group.family) : copy.comparisonView.others}</h4>
          <ul>
            {group.benefits.map((benefit) => {
              const variant = variantName(product, benefit.variant);
              return (
                <li key={benefit.id}>
                  <div className="sc-benefit-line">
                    <span className="sc-benefit-label">
                      {benefit.label}
                      {variant && (
                        <small className="sc-variant-tag">
                          {interpolate(text.variant, { name: variant })}
                        </small>
                      )}
                    </span>
                    <strong
                      className={`sc-benefit-coverage${structured(benefit) ? " is-short" : ""}`}
                    >
                      {coverageShort(benefit)}
                    </strong>
                  </div>
                  {detailed && (
                    <div className="sc-benefit-detail">
                      {benefit.coverage && <p>{benefit.coverage}</p>}
                      {benefit.waitingPeriod && (
                        <p>{interpolate(text.waiting, { value: benefit.waitingPeriod })}</p>
                      )}
                      {benefit.conditions && (
                        <p>{interpolate(text.conditions, { value: benefit.conditions })}</p>
                      )}
                      {benefit.sourceUrl && (
                        <a href={benefit.sourceUrl} target="_blank" rel="noreferrer">
                          {text.source} ↗
                        </a>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
