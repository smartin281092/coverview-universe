import { useEffect, useMemo, useRef, useState } from "react";
import type { SupplementaryProduct } from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthIcon } from "../health-insurance/HealthIcon";
import { ProductCard } from "./ProductCard";
import { ProductFilters } from "./ProductFilters";
import { ProductTable } from "./ProductTable";
import { ScDialog } from "./ScDialog";
import {
  categoryLabel,
  interpolate,
  matches,
  maxCompared,
  noFilters,
  plural,
  sortProducts,
  sorts,
  tagLabel,
  insurerName,
  type CatalogIndex,
  type Filters,
  type PriceSummary,
  type Sort,
} from "./supplementary-model";

export type View = "cards" | "table";
function ViewIcon({ view }: { view: View }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path
        d={
          view === "cards"
            ? "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"
            : "M4 6h16M4 12h16M4 18h16"
        }
      />
    </svg>
  );
}
const pageSizes: Record<View, number> = { cards: 24, table: 50 };
const text = copy.results;

/**
 * The catalogue: filters in a column (a side sheet on small screens), the result count, active
 * filters, sort and view, then cards or table, page by page (FRONT-14: no endless list).
 */
export function ListView({
  index,
  prices,
  filters,
  onFilters,
  sort,
  onSort,
  view,
  onView,
  assistant,
  onClearAssistant,
  compared,
  onCompare,
  onOpen,
  onBenefits,
  pricesBusy,
}: {
  index: CatalogIndex;
  prices: Map<string, PriceSummary>;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  sort: Sort;
  onSort: (sort: Sort) => void;
  view: View;
  onView: (view: View) => void;
  // Products the assistant recommends, in its order, with its reasons.
  assistant: { order: Map<string, number>; reasons: Map<string, string[]> } | null;
  onClearAssistant: () => void;
  compared: string[];
  onCompare: (product: SupplementaryProduct) => void;
  onOpen: (product: SupplementaryProduct) => void;
  onBenefits: (product: SupplementaryProduct) => void;
  pricesBusy: boolean;
}) {
  const [page, setPage] = useState(0);
  const [sheet, setSheet] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const products = index.catalog.products;
  const visible = useMemo(() => {
    const kept = products.filter(
      (product) =>
        (!assistant || assistant.order.has(product.key)) &&
        matches(product, filters, prices.get(product.key) ?? { kind: "none" }),
    );
    return sortProducts(index, kept, sort, prices, filters.tags, assistant?.order ?? null);
  }, [index, products, filters, prices, sort, assistant]);
  useEffect(() => setPage(0), [filters, sort, view, assistant]);
  const size = pageSizes[view];
  const pages = Math.max(1, Math.ceil(visible.length / size));
  const shown = visible.slice(page * size, page * size + size);
  const ceiling = useMemo(() => {
    let highest = 0;
    for (const price of prices.values())
      if (price.kind === "quote") highest = Math.max(highest, price.low);
    return Math.ceil(highest / 100);
  }, [prices]);
  const chips = [
    ...filters.categories.map((key) => ({
      label: categoryLabel(index, key),
      remove: () =>
        onFilters({ ...filters, categories: filters.categories.filter((item) => item !== key) }),
    })),
    ...filters.tags.map((key) => ({
      label: tagLabel(index, key),
      remove: () => onFilters({ ...filters, tags: filters.tags.filter((item) => item !== key) }),
    })),
    ...filters.insurers.map((key) => ({
      label: insurerName(index, key),
      remove: () =>
        onFilters({ ...filters, insurers: filters.insurers.filter((item) => item !== key) }),
    })),
    ...(filters.maxMonthly !== null
      ? [
          {
            label: interpolate(copy.filters.maxPriceValue, { amount: filters.maxMonthly }),
            remove: () => onFilters({ ...filters, maxMonthly: null }),
          },
        ]
      : []),
  ];
  const filterCount = chips.length;
  const full = compared.length >= maxCompared;
  const goTo = (next: number) => {
    setPage(next);
    top.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const filtersPanel = (
    <ProductFilters
      index={index}
      products={products}
      filters={filters}
      prices={prices}
      onChange={onFilters}
      priceCeiling={ceiling}
    />
  );
  return (
    <div className="sc-catalog" ref={top}>
      <aside className="sc-catalog-filters" aria-label={copy.filters.title}>
        <h2 className="sc-filters-title">{copy.filters.title}</h2>
        {filtersPanel}
      </aside>
      <section className="sc-results" aria-labelledby="sc-results-count" aria-busy={pricesBusy}>
        <div className="sc-toolbar">
          <h2 id="sc-results-count" className="sc-results-count" aria-live="polite">
            {plural(text.count, visible.length)}
          </h2>
          <button type="button" className="sc-filters-open" onClick={() => setSheet(true)}>
            <HealthIcon name="sliders" size={16} />
            {copy.filters.open}
            {filterCount > 0 && <span className="sc-badge">{filterCount}</span>}
          </button>
          <label className="sc-sort-select">
            <span>{text.sort}</span>
            <select value={sort} onChange={(event) => onSort(event.target.value as Sort)}>
              {sorts.map((value) => (
                <option key={value} value={value}>
                  {value === "relevance" && assistant
                    ? copy.assistant.mode
                    : text.sortOptions[value]}
                </option>
              ))}
            </select>
          </label>
          <div className="sc-view-switch" role="group" aria-label={text.view}>
            {(["cards", "table"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => onView(value)}
              >
                <ViewIcon view={value} />
                <span className="sc-view-label">{value === "cards" ? text.cards : text.table}</span>
              </button>
            ))}
          </div>
        </div>
        {(chips.length > 0 || assistant) && (
          <div className="sc-active" aria-label={copy.filters.active} role="group">
            {assistant && (
              <span className="sc-active-chip is-assistant">
                <HealthIcon name="spark" size={13} />
                {copy.assistant.mode}
                <button
                  type="button"
                  aria-label={interpolate(copy.filters.remove, { label: copy.assistant.mode })}
                  onClick={onClearAssistant}
                >
                  <HealthIcon name="close" size={12} />
                </button>
              </span>
            )}
            {chips.map((chip) => (
              <span className="sc-active-chip" key={chip.label}>
                {chip.label}
                <button
                  type="button"
                  aria-label={interpolate(copy.filters.remove, { label: chip.label })}
                  onClick={chip.remove}
                >
                  <HealthIcon name="close" size={12} />
                </button>
              </span>
            ))}
            {chips.length > 0 && (
              <button type="button" className="sc-link-button" onClick={() => onFilters(noFilters)}>
                {copy.filters.clearAll}
              </button>
            )}
          </div>
        )}
        {visible.length === 0 ? (
          <div className="sc-empty">
            <p>{text.empty}</p>
            <p className="hi-small">{text.emptyHint}</p>
            {chips.length > 0 && (
              <button type="button" className="hi-secondary" onClick={() => onFilters(noFilters)}>
                {copy.filters.clearAll}
              </button>
            )}
          </div>
        ) : view === "cards" ? (
          <div className="sc-grid">
            {shown.map((product) => (
              <ProductCard
                key={product.key}
                index={index}
                product={product}
                price={prices.get(product.key) ?? { kind: "none" }}
                chosenTags={filters.tags}
                reasons={assistant?.reasons.get(product.key)}
                compared={compared.includes(product.key)}
                compareDisabled={full}
                onOpen={() => onOpen(product)}
                onBenefits={() => onBenefits(product)}
                onCompare={() => onCompare(product)}
              />
            ))}
          </div>
        ) : (
          <ProductTable
            index={index}
            products={shown}
            prices={prices}
            tags={filters.tags}
            sort={sort}
            onSort={onSort}
            compared={compared}
            compareFull={full}
            onOpen={onOpen}
            onCompare={onCompare}
          />
        )}
        {pages > 1 && (
          <nav className="sc-pagination" aria-label={text.pagination}>
            <button
              type="button"
              className="hi-secondary"
              disabled={page === 0}
              onClick={() => goTo(page - 1)}
            >
              {text.previous}
            </button>
            <span>{interpolate(text.page, { page: page + 1, pages })}</span>
            <button
              type="button"
              className="hi-secondary"
              disabled={page >= pages - 1}
              onClick={() => goTo(page + 1)}
            >
              {text.next}
            </button>
          </nav>
        )}
      </section>
      <ScDialog
        open={sheet}
        onClose={() => setSheet(false)}
        title={copy.filters.title}
        sheet
        className="sc-filters-sheet"
      >
        {filtersPanel}
        <div className="sc-sheet-footer">
          <button type="button" className="hi-primary hi-full" onClick={() => setSheet(false)}>
            {plural(copy.filters.apply, visible.length)}
          </button>
        </div>
      </ScDialog>
    </div>
  );
}
