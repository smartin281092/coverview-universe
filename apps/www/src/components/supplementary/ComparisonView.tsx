import { Fragment, useMemo, useState, type CSSProperties } from "react";
import type {
  SupplementaryBenefit,
  SupplementaryPrice,
  SupplementaryProduct,
} from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthIcon } from "../health-insurance/HealthIcon";
import { PriceTag } from "./PriceTag";
import type { PickerMode } from "./ProductPicker";
import { ProfilePills } from "./ProfilePills";
import { ScInsurerLogo, ScPartnerTag } from "./ScIdentity";
import {
  categoryLabel,
  coverageShort,
  interpolate,
  isTaxonomyTag,
  listPath,
  maxCompared,
  sortPrice,
  summaryAmount,
  tagLabel,
  variantName,
  type CatalogIndex,
  type PriceSummary,
  type Profile,
} from "./supplementary-model";
import { cheapestRow } from "./ProductPanel";

const text = copy.comparisonView;

// The products' pills and their big logos, on the page's dark band (efficient.app's header).
export function ComparisonHeader({
  index,
  products,
  onPick,
}: {
  index: CatalogIndex;
  products: SupplementaryProduct[];
  onPick: (mode: PickerMode) => void;
}) {
  return (
    <div className="sc-vs">
      <div className="sc-vs-pills" role="group" aria-label={text.pills}>
        {products.map((product, position) => (
          <Fragment key={product.key}>
            {position > 0 && (
              <span className="sc-vs-word" aria-hidden="true">
                {text.vs}
              </span>
            )}
            <button
              type="button"
              className="sc-vs-pill"
              aria-label={interpolate(text.change, { name: product.name })}
              aria-haspopup="dialog"
              onClick={() => onPick({ kind: "replace", key: product.key })}
            >
              <ScInsurerLogo insurer={index.insurers.get(product.insurer)} />
              <span>{product.name}</span>
              <span className="sc-vs-caret" aria-hidden="true">
                <HealthIcon name="chevron" size={13} />
              </span>
            </button>
          </Fragment>
        ))}
        {products.length < maxCompared && (
          <>
            {products.length > 0 && (
              <span className="sc-vs-word" aria-hidden="true">
                {text.vs}
              </span>
            )}
            <button
              type="button"
              className="sc-vs-pill is-add"
              aria-haspopup="dialog"
              onClick={() => onPick({ kind: "add" })}
            >
              <HealthIcon name="plus" size={15} />
              {text.add}
            </button>
          </>
        )}
      </div>
      {products.length > 0 && (
        <div
          className="sc-vs-logos"
          aria-hidden="true"
          style={{ "--sc-count": products.length } as CSSProperties}
        >
          {products.map((product, position) => (
            <Fragment key={product.key}>
              {position > 0 && <span className="sc-vs-badge">{text.vs}</span>}
              <span
                className="sc-vs-tile"
                style={
                  {
                    "--sc-turn": `${((products.length - 1) / 2 - position) * 6}deg`,
                  } as CSSProperties
                }
              >
                <ScInsurerLogo insurer={index.insurers.get(product.insurer)} size="tile" />
              </span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function cellBenefits(product: SupplementaryProduct, tag: string, variant: string) {
  return product.benefits.filter(
    (benefit) =>
      benefit.tags.includes(tag) && (!variant || !benefit.variant || benefit.variant === variant),
  );
}
function Cell({
  product,
  benefits,
}: {
  product: SupplementaryProduct;
  benefits: SupplementaryBenefit[];
}) {
  if (!benefits.length) return <span className="sc-matrix-none">{copy.dash}</span>;
  return (
    <ul className="sc-matrix-cell">
      {benefits.map((benefit) => {
        const variant = variantName(product, benefit.variant);
        return (
          <li key={benefit.id}>
            <strong>{coverageShort(benefit)}</strong>
            {variant && (
              <small className="sc-variant-tag">
                {interpolate(copy.coverage.variant, { name: variant })}
              </small>
            )}
            <span>{benefit.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The comparison: tabs (the comparison, then one per product, which opens its panel), the price
 * row for the profile, then one line per common benefit, grouped by family, one column per
 * product. On wide screens, the products ranked by price for the profile.
 */
export function ComparisonView({
  index,
  products,
  prices,
  rows,
  profile,
  onProfile,
  onOpen,
  onOrder,
  onRemove,
}: {
  index: CatalogIndex;
  products: SupplementaryProduct[];
  prices: Map<string, PriceSummary>;
  rows: Map<string, SupplementaryPrice[]>;
  profile: Profile;
  onProfile: (profile: Profile) => void;
  onOpen: (product: SupplementaryProduct) => void;
  onOrder: (product: SupplementaryProduct, row: SupplementaryPrice | null) => void;
  onRemove: (key: string) => void;
}) {
  const [differences, setDifferences] = useState(false);
  const [variants, setVariants] = useState<Record<string, string>>({});
  const groups = useMemo(() => {
    const present = new Set(products.flatMap((product) => product.tags.filter(isTaxonomyTag)));
    return index.catalog.families
      .map((family) => ({
        family,
        tags: index.catalog.tags.filter((tag) => tag.family === family.key && present.has(tag.key)),
      }))
      .filter((group) => group.tags.length > 0);
  }, [index, products]);
  const ranked = [...products].sort(
    (a, b) =>
      sortPrice(prices.get(a.key) ?? { kind: "none" }) -
      sortPrice(prices.get(b.key) ?? { kind: "none" }),
  );
  const signature = (product: SupplementaryProduct, tag: string) =>
    cellBenefits(product, tag, variants[product.key] ?? "")
      .map(coverageShort)
      .sort()
      .join("|");
  const differs = (tag: string) =>
    products.length < 2 || new Set(products.map((product) => signature(product, tag))).size > 1;
  const others = products.map((product) =>
    product.benefits.filter((benefit) => !benefit.tags.some(isTaxonomyTag)),
  );
  let shownRows = 0;
  return (
    <div className="sc-comparison">
      <nav className="sc-compare-tabs" aria-label={text.tabsLabel}>
        <span className="sc-compare-tab is-current" aria-current="page">
          <HealthIcon name="sliders" size={16} />
          {text.overview}
        </span>
        {products.map((product) => (
          <button
            key={product.key}
            type="button"
            className="sc-compare-tab"
            aria-haspopup="dialog"
            onClick={() => onOpen(product)}
          >
            <ScInsurerLogo insurer={index.insurers.get(product.insurer)} />
            <span className="sc-compare-tab-name">{product.name}</span>
          </button>
        ))}
      </nav>
      {products.length === 0 ? (
        <div className="sc-empty">
          <p>{text.empty}</p>
          <a className="hi-secondary" href={listPath}>
            {text.backToList}
          </a>
        </div>
      ) : (
        <div className="sc-compare-layout">
          <div className="sc-compare-main">
            <div className="sc-compare-toolbar">
              <ProfilePills
                prefix="sc-comparison-profile"
                profile={profile}
                onChange={onProfile}
                localities={index.catalog.localities}
                tone="light"
              />
              <label className="sc-switch">
                <input
                  type="checkbox"
                  checked={differences}
                  onChange={(event) => setDifferences(event.target.checked)}
                />
                <span>{text.differences}</span>
              </label>
            </div>
            <div className="sc-matrix-frame" tabIndex={0} role="region" aria-label={text.criterion}>
              <table className="sc-matrix" style={{ ["--sc-columns" as string]: products.length }}>
                <thead>
                  <tr>
                    <th scope="col" className="sc-matrix-corner">
                      {text.criterion}
                    </th>
                    {products.map((product) => {
                      const insurer = index.insurers.get(product.insurer);
                      return (
                        <th scope="col" key={product.key}>
                          <div className="sc-matrix-product">
                            <ScInsurerLogo insurer={insurer} />
                            <button
                              type="button"
                              className="sc-matrix-name"
                              onClick={() => onOpen(product)}
                            >
                              {product.name}
                            </button>
                            <span className="hi-sr-only">{insurer?.name}</span>
                            <span className="sc-matrix-insurer">
                              {categoryLabel(index, product.category)}
                            </span>
                            {insurer?.partner && index.partnerTags && <ScPartnerTag />}
                            <button
                              type="button"
                              className="hi-icon-button sc-matrix-remove"
                              aria-label={interpolate(copy.compare.remove, { name: product.name })}
                              onClick={() => onRemove(product.key)}
                            >
                              <HealthIcon name="close" size={14} />
                            </button>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  <tr className="sc-matrix-price">
                    <th scope="row">{text.priceRow}</th>
                    {products.map((product) => (
                      <td key={product.key}>
                        <PriceTag price={prices.get(product.key) ?? { kind: "none" }} compact />
                        {product.variants.length > 1 && (
                          <select
                            className="sc-matrix-variant"
                            aria-label={`${copy.panel.variantFilter} · ${product.name}`}
                            value={variants[product.key] ?? ""}
                            onChange={(event) =>
                              setVariants((current) => ({
                                ...current,
                                [product.key]: event.target.value,
                              }))
                            }
                          >
                            <option value="">{copy.coverage.allVariants}</option>
                            {product.variants.map((variant) => (
                              <option key={variant.key} value={variant.key}>
                                {variant.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                    ))}
                  </tr>
                  {groups.map((group) => {
                    const tags = group.tags.filter((tag) => !differences || differs(tag.key));
                    if (!tags.length) return null;
                    shownRows += tags.length;
                    return (
                      <Fragment key={group.family.key}>
                        <tr className="sc-matrix-family">
                          <th scope="colgroup" colSpan={products.length + 1}>
                            <span>{group.family.label}</span>
                          </th>
                        </tr>
                        {tags.map((tag) => (
                          <tr key={tag.key}>
                            <th scope="row" title={tag.label}>
                              {tagLabel(index, tag.key)}
                            </th>
                            {products.map((product) => (
                              <td key={product.key}>
                                <Cell
                                  product={product}
                                  benefits={cellBenefits(
                                    product,
                                    tag.key,
                                    variants[product.key] ?? "",
                                  )}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                  {!differences && others.some((items) => items.length > 0) && (
                    <tr className="sc-matrix-others">
                      <th scope="row">{text.others}</th>
                      {products.map((product, position) => (
                        <td key={product.key}>
                          {others[position]?.length ? (
                            <ul className="sc-matrix-cell">
                              {others[position].map((benefit) => (
                                <li key={benefit.id}>
                                  <span>{benefit.label}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="sc-matrix-none">{copy.dash}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )}
                  {differences && shownRows === 0 && (
                    <tr>
                      <td colSpan={products.length + 1} className="sc-empty-line">
                        {text.noRows}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <aside className="sc-ranking" aria-labelledby="sc-ranking-title">
            <h2 id="sc-ranking-title">{text.ranking}</h2>
            <p className="sc-ranking-hint">{text.rankingHint}</p>
            <ol>
              {ranked.map((product, position) => {
                const price = prices.get(product.key) ?? { kind: "none" };
                return (
                  <li key={product.key}>
                    <span className="sc-rank" aria-hidden="true">
                      {price.kind === "quote" ? position + 1 : "·"}
                    </span>
                    <ScInsurerLogo insurer={index.insurers.get(product.insurer)} />
                    <button
                      type="button"
                      className="sc-ranking-name"
                      onClick={() => onOpen(product)}
                    >
                      <strong>{product.name}</strong>
                      <small>
                        {price.kind === "quote"
                          ? `${summaryAmount(price) ?? ""} ${copy.currency} ${copy.perMonth}`
                          : copy.price.onRequest}
                      </small>
                    </button>
                    <button
                      type="button"
                      className="sc-ranking-order"
                      aria-label={`${copy.panel.order} · ${product.name}`}
                      onClick={() => onOrder(product, cheapestRow(rows.get(product.key) ?? []))}
                    >
                      {copy.panel.order}
                      <HealthIcon name="arrow" size={13} />
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
        </div>
      )}
    </div>
  );
}
