import type { SupplementaryProduct } from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthIcon } from "../health-insurance/HealthIcon";
import { PriceTag } from "./PriceTag";
import { ScInsurerLogo, ScPartnerTag } from "./ScIdentity";
import {
  categoryLabel,
  coverageShort,
  interpolate,
  tagLabel,
  type CatalogIndex,
  type PriceSummary,
  type Sort,
} from "./supplementary-model";

const text = copy.table;
type Column = "product" | "price";
// A coverage breaks only after its rate: « 60 %, » then « max. 250 CHF / an » in one piece.
const unbroken = (value: string) => {
  const comma = value.lastIndexOf(", ");
  return comma < 0
    ? value.replaceAll(" ", "\u00a0")
    : value.slice(0, comma + 2) + value.slice(comma + 2).replaceAll(" ", "\u00a0");
};
// Column sorts are the list's sorts, also offered in its sort menu.
const sorts: Partial<Record<Column, { asc: Sort; desc?: Sort }>> = {
  product: { asc: "name" },
  price: { asc: "price-asc", desc: "price-desc" },
};

/**
 * The table view: one row per product, its price for the profile, and one column per benefit the
 * visitor filtered on (before any filter, the coverages asked most often). Header and first
 * column stay in view; the table scrolls inside its frame.
 */
export function ProductTable({
  index,
  products,
  prices,
  tags,
  sort,
  onSort,
  compared,
  compareFull,
  onOpen,
  onCompare,
}: {
  index: CatalogIndex;
  products: SupplementaryProduct[];
  prices: Map<string, PriceSummary>;
  tags: string[];
  sort: Sort;
  onSort: (sort: Sort) => void;
  compared: string[];
  compareFull: boolean;
  onOpen: (product: SupplementaryProduct) => void;
  onCompare: (product: SupplementaryProduct) => void;
}) {
  const columns = tags.length
    ? tags
    : Object.keys(text.defaultColumns).filter((tag) => index.tags.has(tag));
  const header = (column: Column, label: string) => {
    const option = sorts[column];
    if (!option) return <th scope="col">{label}</th>;
    const active = sort === option.asc || sort === option.desc;
    const descending = sort === option.desc;
    return (
      <th
        scope="col"
        aria-sort={active ? (descending ? "descending" : "ascending") : undefined}
        className={column === "price" ? "is-number" : undefined}
      >
        <button
          type="button"
          className={`sc-sort${active ? " is-active" : ""}`}
          title={interpolate(text.sortBy, { column: label })}
          onClick={() => onSort(option.desc && sort === option.asc ? option.desc : option.asc)}
        >
          {label}
          <span className={`sc-sort-mark${descending ? " is-desc" : ""}`} aria-hidden="true">
            <HealthIcon name="chevron" size={12} />
          </span>
        </button>
      </th>
    );
  };
  return (
    <div className="sc-table-frame" tabIndex={0} role="region" aria-label={text.caption}>
      <table className="sc-table">
        <caption className="hi-sr-only">{text.caption}</caption>
        <thead>
          <tr>
            <th scope="col" className="sc-table-check">
              <span className="hi-sr-only">{text.compare}</span>
            </th>
            {header("product", text.product)}
            {header("price", text.price)}
            {columns.map((tag) => (
              <th scope="col" key={tag} className="sc-table-tag" title={index.tags.get(tag)?.label}>
                {tags.length
                  ? tagLabel(index, tag)
                  : (text.defaultColumns[tag] ?? tagLabel(index, tag))}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const insurer = index.insurers.get(product.insurer);
            const isCompared = compared.includes(product.key);
            return (
              <tr key={product.key} onClick={() => onOpen(product)}>
                <td className="sc-table-check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={`${text.compare} ${product.name}`}
                    checked={isCompared}
                    disabled={compareFull && !isCompared}
                    onChange={() => onCompare(product)}
                  />
                </td>
                <th scope="row">
                  <button
                    type="button"
                    className="sc-table-product"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(product);
                    }}
                  >
                    <ScInsurerLogo insurer={insurer} />
                    <span className="sc-table-name">
                      <span>
                        <span className="hi-sr-only">{insurer?.name} </span>
                        {product.name}
                        {insurer?.partner && <ScPartnerTag />}
                      </span>
                      <small>{categoryLabel(index, product.category)}</small>
                    </span>
                  </button>
                </th>
                <td className="is-number">
                  <PriceTag price={prices.get(product.key) ?? { kind: "none" }} compact />
                </td>
                {columns.map((tag) => {
                  const benefit = product.benefits.find((item) => item.tags.includes(tag));
                  return (
                    <td key={tag} className={benefit ? undefined : "sc-table-none"}>
                      {benefit ? unbroken(coverageShort(benefit)) : copy.dash}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
