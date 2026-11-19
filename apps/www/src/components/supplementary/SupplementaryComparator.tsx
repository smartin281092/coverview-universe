import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createSupplementaryClient,
  type SupplementaryPrice,
  type SupplementaryProduct,
} from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { AssistantBar, AssistantResult } from "./Assistant";
import { BenefitList } from "./BenefitList";
import { CompareBar } from "./CompareBar";
import { ComparisonHeader, ComparisonView } from "./ComparisonView";
import { ListView, type View } from "./ListView";
import { OrderDialog } from "./OrderDialog";
import { ProductPanel } from "./ProductPanel";
import { ProductPicker, type PickerMode } from "./ProductPicker";
import { openProfileSetting, ProfilePills } from "./ProfilePills";
import { ScDialog } from "./ScDialog";
import {
  interpolate,
  maxCompared,
  noFilters,
  plural,
  sorts,
  type Filters,
  type Sort,
} from "./supplementary-model";
import { useAssistant } from "./use-assistant";
import {
  useCatalog,
  useCompareSelection,
  usePriceSummaries,
  useProfile,
  useQuote,
} from "./use-supplementary";

// The list's state in its address (FRONT-11): view, filters and sort can be shared.
const listParams = {
  view: "vue",
  categories: "categories",
  tags: "prestations",
  insurers: "compagnies",
  mode: "couverture",
  max: "prixmax",
  sort: "tri",
} as const;
function readList(address: URL): { view: View; sort: Sort; filters: Filters } {
  const list = (name: string) =>
    (address.searchParams.get(name) ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 80);
  const max = Number(address.searchParams.get(listParams.max));
  const sort = address.searchParams.get(listParams.sort);
  return {
    view: address.searchParams.get(listParams.view) === "tableau" ? "table" : "cards",
    sort: sorts.find((item) => item === sort) ?? "relevance",
    filters: {
      categories: list(listParams.categories),
      tags: list(listParams.tags),
      insurers: list(listParams.insurers),
      maxMonthly: Number.isInteger(max) && max > 0 && max < 10000 ? max : null,
      tagMode: address.searchParams.get(listParams.mode) === "une" ? "any" : "all",
    },
  };
}
function writeList(view: View, sort: Sort, filters: Filters) {
  const address = new URL(window.location.href);
  const set = (name: string, value: string | null) => {
    if (value) address.searchParams.set(name, value);
    else address.searchParams.delete(name);
  };
  set(listParams.view, view === "table" ? "tableau" : null);
  set(listParams.sort, sort === "relevance" ? null : sort);
  set(listParams.categories, filters.categories.join(","));
  set(listParams.tags, filters.tags.join(","));
  set(listParams.insurers, filters.insurers.join(","));
  set(listParams.mode, filters.tagMode === "any" ? "une" : null);
  set(listParams.max, filters.maxMonthly === null ? null : String(filters.maxMonthly));
  if (address.href !== window.location.href)
    window.history.replaceState(window.history.state, "", address);
}

function Skeleton() {
  return (
    <div className="sc-skeleton" role="status" aria-label={copy.loading}>
      <div className="sc-skeleton-filters" aria-hidden="true">
        {Array.from({ length: 9 }, (_, position) => (
          <span key={position} />
        ))}
      </div>
      <div className="sc-skeleton-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, position) => (
          <span key={position} />
        ))}
      </div>
    </div>
  );
}

/**
 * The supplementary insurance comparator (19 November 2026), one island for both pages: the list
 * (assistant, profile, filters, cards or table) and the comparison of up to four products. The
 * catalogue, the prices and the assistant's ranking come from the public API; nothing is
 * computed or invented here beyond their arrangement.
 */
export default function SupplementaryComparator({
  apiUrl,
  view,
}: {
  apiUrl: string;
  view: "list" | "comparison";
}) {
  const api = useMemo(() => createSupplementaryClient(apiUrl), [apiUrl]);
  const { index, failed, retry } = useCatalog(api);
  const { profile, setProfile } = useProfile();
  const quote = useQuote(api, profile, index !== null);
  const prices = usePriceSummaries(index, quote.rows);
  const comparing = view === "comparison";
  const compare = useCompareSelection(comparing);
  const assistant = useAssistant(api, profile, setProfile);
  const [filters, setFilters] = useState<Filters>(noFilters);
  const [sort, setSort] = useState<Sort>("relevance");
  const [display, setDisplay] = useState<View>("cards");
  const [addressRead, setAddressRead] = useState(false);
  const [panelKey, setPanelKey] = useState<string | null>(null);
  const [benefitsKey, setBenefitsKey] = useState<string | null>(null);
  const [order, setOrder] = useState<{ key: string; row: SupplementaryPrice | null } | null>(null);
  const [picker, setPicker] = useState<PickerMode | null>(null);
  const [notice, setNotice] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (comparing) return;
    const state = readList(new URL(window.location.href));
    setFilters(state.filters);
    setSort(state.sort);
    setDisplay(state.view);
    setAddressRead(true);
  }, [comparing]);
  useEffect(() => {
    if (!comparing && addressRead) writeList(display, sort, filters);
  }, [comparing, addressRead, display, sort, filters]);
  // The comparison's address names its products; the tab keeps them too.
  useEffect(() => {
    if (!comparing || !compare.restored) return;
    const address = new URL(window.location.href);
    // Commas stay readable in the shared address: ?produits=a,b,c.
    address.search = compare.keys.length
      ? `?produits=${compare.keys.map(encodeURIComponent).join(",")}`
      : "";
    if (address.href !== window.location.href)
      window.history.replaceState(window.history.state, "", address);
  }, [comparing, compare.keys, compare.restored]);
  // Keys the catalogue no longer has are dropped once it is loaded.
  useEffect(() => {
    if (!index || !compare.restored) return;
    const known = compare.keys.filter((key) => index.products.has(key));
    if (known.length !== compare.keys.length) compare.setKeys(known);
  }, [index, compare.keys, compare.restored, compare.setKeys]);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const toggleCompare = useCallback(
    (product: SupplementaryProduct) => {
      const keys = compare.keys;
      if (keys.includes(product.key)) {
        compare.setKeys(keys.filter((key) => key !== product.key));
        return;
      }
      if (keys.length >= maxCompared) {
        setNotice(true);
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(false), 5000);
        return;
      }
      compare.setKeys([...keys, product.key]);
    },
    [compare],
  );
  const assistantView = useMemo(() => {
    if (!assistant.result) return null;
    return {
      order: new Map(assistant.result.results.map((item, position) => [item.productKey, position])),
      reasons: new Map(assistant.result.results.map((item) => [item.productKey, item.reasons])),
    };
  }, [assistant.result]);
  const compared = useMemo(
    () => compare.keys.flatMap((key) => index?.products.get(key) ?? []),
    [compare.keys, index],
  );
  const panelProduct = panelKey ? index?.products.get(panelKey) : undefined;
  const benefitsProduct = benefitsKey ? index?.products.get(benefitsKey) : undefined;
  const orderProduct = order ? index?.products.get(order.key) : undefined;
  const status = failed ? (
    <div className="sc-state" role="alert">
      <p>{copy.unavailable}</p>
      <button type="button" className="hi-secondary" onClick={retry}>
        {copy.retry}
      </button>
    </div>
  ) : !index ? (
    <Skeleton />
  ) : index.catalog.products.length === 0 ? (
    <div className="sc-state">
      <p>{copy.emptyCatalog}</p>
    </div>
  ) : null;

  return (
    <div className={`health-comparator sc-app${comparing ? " is-comparison" : ""}`}>
      <div className="sc-band sc-band-tools">
        <div className="sc-shell">
          {comparing ? (
            index && <ComparisonHeader index={index} products={compared} onPick={setPicker} />
          ) : (
            <>
              <AssistantBar busy={assistant.busy} onAsk={assistant.ask} />
              <ProfilePills
                prefix="sc-profile"
                profile={profile}
                onChange={setProfile}
                localities={index?.catalog.localities}
              />
            </>
          )}
        </div>
      </div>
      <div className="sc-shell sc-body">
        {quote.failed && index && (
          <p className="sc-inline-error" role="alert">
            {copy.profile.quoteFailed}
            <button type="button" className="sc-link-button" onClick={quote.retry}>
              {copy.retry}
            </button>
          </p>
        )}
        {status ??
          (index &&
            (comparing ? (
              <ComparisonView
                index={index}
                products={compared}
                prices={prices}
                rows={quote.rows}
                profile={profile}
                onProfile={setProfile}
                onOpen={(product) => setPanelKey(product.key)}
                onOrder={(product, row) => setOrder({ key: product.key, row })}
                onRemove={(key) => compare.setKeys(compare.keys.filter((item) => item !== key))}
              />
            ) : (
              <>
                {assistant.query && (
                  <AssistantResult
                    index={index}
                    query={assistant.query.message}
                    result={assistant.result}
                    busy={assistant.busy}
                    failed={assistant.failed}
                    onRetry={assistant.retry}
                    onClear={assistant.clear}
                    onAnswer={assistant.answer}
                    onSetting={(setting) => openProfileSetting("sc-profile", setting)}
                  />
                )}
                <ListView
                  index={index}
                  prices={prices}
                  filters={filters}
                  onFilters={setFilters}
                  sort={sort}
                  onSort={setSort}
                  view={display}
                  onView={setDisplay}
                  assistant={assistantView}
                  onClearAssistant={assistant.clear}
                  compared={compare.keys}
                  onCompare={toggleCompare}
                  onOpen={(product) => setPanelKey(product.key)}
                  onBenefits={(product) => setBenefitsKey(product.key)}
                  pricesBusy={quote.busy}
                />
              </>
            )))}
      </div>
      {index && !comparing && (
        <CompareBar
          index={index}
          keys={compare.keys}
          onRemove={(key) => compare.setKeys(compare.keys.filter((item) => item !== key))}
          onClear={() => compare.setKeys([])}
          notice={notice}
        />
      )}
      {index && benefitsProduct && (
        <ScDialog
          open
          onClose={() => setBenefitsKey(null)}
          title={interpolate(copy.card.benefitsTitle, { name: benefitsProduct.name })}
          className="sc-benefits-dialog"
        >
          <p className="hi-small">
            {plural(copy.panel.benefitsCount, benefitsProduct.benefits.length)}
          </p>
          <BenefitList index={index} product={benefitsProduct} />
        </ScDialog>
      )}
      {index && panelProduct && (
        <ProductPanel
          index={index}
          product={panelProduct}
          rows={quote.rows.get(panelProduct.key) ?? []}
          quoteBusy={quote.busy}
          profile={profile}
          onProfile={setProfile}
          backLabel={comparing ? copy.panel.backToComparison : copy.panel.backToList}
          onBack={() => setPanelKey(null)}
          onClose={() => setPanelKey(null)}
          compared={compare.keys.includes(panelProduct.key)}
          compareFull={compare.keys.length >= maxCompared}
          onCompare={() => toggleCompare(panelProduct)}
          onOrder={(row) => setOrder({ key: panelProduct.key, row })}
        />
      )}
      {index && orderProduct && order && (
        <OrderDialog
          api={api}
          index={index}
          product={orderProduct}
          row={order.row}
          rows={quote.rows.get(orderProduct.key) ?? []}
          profile={profile}
          onProfile={setProfile}
          onClose={() => setOrder(null)}
        />
      )}
      {index && picker && (
        <ProductPicker
          index={index}
          prices={prices}
          compared={compare.keys}
          mode={picker}
          onPick={(key) => {
            compare.setKeys(
              picker.kind === "replace"
                ? compare.keys.map((item) => (item === picker.key ? key : item))
                : [...compare.keys, key].slice(0, maxCompared),
            );
            setPicker(null);
          }}
          onRemove={() => {
            if (picker.kind === "replace")
              compare.setKeys(compare.keys.filter((item) => item !== picker.key));
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      <noscript>
        <p className="sc-state">{copy.noScript}</p>
      </noscript>
    </div>
  );
}
