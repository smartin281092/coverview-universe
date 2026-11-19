import { useId, useMemo, type ReactNode } from "react";
import type { SupplementaryProduct } from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { ScInsurerLogo } from "./ScIdentity";
import {
  categoryLabel,
  facetCounts,
  interpolate,
  isTaxonomyTag,
  productTags,
  shortLabel,
  type CatalogIndex,
  type Filters,
  type PriceSummary,
} from "./supplementary-model";

const text = copy.filters;
const toggle = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

function Check({
  checked,
  onChange,
  label,
  count,
  title,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count: number;
  title?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <label className={`sc-check${count === 0 && !checked ? " is-empty" : ""}`} title={title}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      {children}
      <span className="sc-check-label">{label}</span>
      <span className="sc-check-count">{count}</span>
    </label>
  );
}

/**
 * The filters, in plain sections separated by rules (no card around them): categories, benefits
 * by family with the « all / at least one » choice, insurers, maximum price for the profile.
 */
export function ProductFilters({
  index,
  products,
  filters,
  prices,
  onChange,
  priceCeiling,
}: {
  index: CatalogIndex;
  products: SupplementaryProduct[];
  filters: Filters;
  prices: Map<string, PriceSummary>;
  onChange: (filters: Filters) => void;
  // Highest monthly price of the profile, whole francs, for the slider's range.
  priceCeiling: number;
}) {
  const id = useId();
  const categories = useMemo(
    () => facetCounts(products, filters, prices, "categories", (product) => [product.category]),
    [products, filters, prices],
  );
  const tags = useMemo(
    () => facetCounts(products, filters, prices, "tags", productTags),
    [products, filters, prices],
  );
  const insurers = useMemo(
    () => facetCounts(products, filters, prices, "insurers", (product) => [product.insurer]),
    [products, filters, prices],
  );
  const families = index.catalog.families.map((family) => ({
    family,
    tags: index.catalog.tags.filter((tag) => tag.family === family.key && isTaxonomyTag(tag.key)),
  }));
  const ceiling = Math.max(10, Math.ceil(priceCeiling / 10) * 10);
  return (
    <div className="sc-filters">
      <fieldset className="sc-filter-section">
        <legend>{text.categories}</legend>
        {index.catalog.categories
          .filter((category) => products.some((product) => product.category === category.key))
          .map((category) => (
            <Check
              key={category.key}
              checked={filters.categories.includes(category.key)}
              onChange={() =>
                onChange({ ...filters, categories: toggle(filters.categories, category.key) })
              }
              label={categoryLabel(index, category.key)}
              title={category.label}
              count={categories.get(category.key) ?? 0}
            />
          ))}
      </fieldset>
      <fieldset className="sc-filter-section">
        <legend>{text.benefits}</legend>
        <p className="sc-filter-hint">{text.benefitsHint}</p>
        <p className="sc-filter-hint" id={`${id}-mode`}>
          {text.modeLabel}
        </p>
        <div className="sc-segmented" role="radiogroup" aria-labelledby={`${id}-mode`}>
          {(["all", "any"] as const).map((mode) => (
            <label key={mode}>
              <input
                type="radio"
                name={`${id}-mode`}
                checked={filters.tagMode === mode}
                onChange={() => onChange({ ...filters, tagMode: mode })}
              />
              <span>{mode === "all" ? text.modeAll : text.modeAny}</span>
            </label>
          ))}
        </div>
        {families.map(
          ({ family, tags: items }) =>
            items.length > 0 && (
              <div className="sc-filter-family" key={family.key}>
                <p>{family.label}</p>
                {items.map((tag) => (
                  <Check
                    key={tag.key}
                    checked={filters.tags.includes(tag.key)}
                    onChange={() => onChange({ ...filters, tags: toggle(filters.tags, tag.key) })}
                    label={shortLabel(tag.label)}
                    title={tag.label}
                    count={tags.get(tag.key) ?? 0}
                  />
                ))}
              </div>
            ),
        )}
      </fieldset>
      <fieldset className="sc-filter-section">
        <legend>{text.insurers}</legend>
        {[...index.catalog.insurers]
          .sort((a, b) => a.name.localeCompare(b.name, "fr"))
          .map((insurer) => (
            <Check
              key={insurer.key}
              checked={filters.insurers.includes(insurer.key)}
              onChange={() =>
                onChange({ ...filters, insurers: toggle(filters.insurers, insurer.key) })
              }
              label={insurer.name}
              count={insurers.get(insurer.key) ?? 0}
            >
              <ScInsurerLogo insurer={insurer} />
            </Check>
          ))}
      </fieldset>
      <fieldset className="sc-filter-section">
        <legend>{text.maxPrice}</legend>
        <div className="sc-range">
          <input
            type="range"
            min={0}
            max={ceiling}
            step={5}
            value={filters.maxMonthly ?? ceiling}
            aria-label={text.maxPrice}
            aria-valuetext={
              filters.maxMonthly === null
                ? text.maxPriceNone
                : interpolate(text.maxPriceValue, { amount: filters.maxMonthly })
            }
            onChange={(event) => {
              const value = Number(event.target.value);
              onChange({ ...filters, maxMonthly: value >= ceiling ? null : value });
            }}
          />
          <output>
            {filters.maxMonthly === null
              ? text.maxPriceNone
              : interpolate(text.maxPriceValue, { amount: filters.maxMonthly })}
          </output>
        </div>
        {filters.maxMonthly !== null && <p className="sc-filter-hint">{text.maxPriceHint}</p>}
      </fieldset>
    </div>
  );
}
