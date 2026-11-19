import { useEffect, useId, useMemo, useState } from "react";
import type {
  SupplementaryPrice,
  SupplementaryProduct,
} from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthGradient } from "../health-insurance/HealthGradient";
import { HealthIcon } from "../health-insurance/HealthIcon";
import { BenefitList } from "./BenefitList";
import { PriceTag } from "./PriceTag";
import { ProfilePills } from "./ProfilePills";
import { ScDialog } from "./ScDialog";
import { ScInsurerLogo, ScPartnerBadge } from "./ScIdentity";
import {
  categoryLabel,
  chf,
  defaultRows,
  interpolate,
  plural,
  priceSummary,
  rowAmount,
  rowKey,
  rowLabel,
  type CatalogIndex,
  type Profile,
} from "./supplementary-model";

const text = copy.panel;
type Tab = "price" | "benefits" | "conditions";
const tabs: Tab[] = ["price", "benefits", "conditions"];
const tabIcons = { price: "info", benefits: "shield", conditions: "pencil" } as const;

export function cheapestRow(rows: SupplementaryPrice[]) {
  const pool = defaultRows(rows);
  return pool.length
    ? pool.reduce((best, row) => (row.minMinor < best.minMinor ? row : best))
    : null;
}

/**
 * The product's side panel, built like the base comparator's model panel: back to the list, logo
 * and partner badge, title, price area with its main action in the CTA's place, then tabs.
 * The order (« Commander ») is the main action; comparing stays a secondary one.
 */
export function ProductPanel({
  index,
  product,
  rows,
  quoteBusy,
  profile,
  onProfile,
  backLabel,
  onBack,
  onClose,
  compared,
  compareFull,
  onCompare,
  onOrder,
}: {
  index: CatalogIndex;
  product: SupplementaryProduct;
  rows: SupplementaryPrice[];
  quoteBusy: boolean;
  profile: Profile;
  onProfile: (profile: Profile) => void;
  backLabel: string;
  onBack: () => void;
  onClose: () => void;
  compared: boolean;
  compareFull: boolean;
  onCompare: () => void;
  onOrder: (row: SupplementaryPrice | null) => void;
}) {
  const id = useId();
  const [tab, setTab] = useState<Tab>("price");
  const [selected, setSelected] = useState<string | null>(null);
  const [variantFilter, setVariantFilter] = useState("");
  useEffect(() => {
    setTab("price");
    setSelected(null);
    setVariantFilter("");
  }, [product.key]);
  const insurer = index.insurers.get(product.insurer);
  const fallback = cheapestRow(rows);
  const row = rows.find((item) => rowKey(item) === selected) ?? fallback;
  const summary = priceSummary(product, rows);
  const benefits = useMemo(
    () =>
      variantFilter
        ? product.benefits.filter((item) => !item.variant || item.variant === variantFilter)
        : product.benefits,
    [product, variantFilter],
  );
  const counts: Record<Tab, number | null> = {
    price: rows.length || null,
    benefits: product.benefits.length,
    conditions: null,
  };
  return (
    <ScDialog
      open
      onClose={onClose}
      title={product.name}
      sheet
      className="sc-panel"
      header={
        <button type="button" className="hi-back-to-list" onClick={onBack}>
          <HealthIcon name="back" size={18} />
          {backLabel}
        </button>
      }
    >
      <div className="hi-model-brand">
        <div className="hi-model-brand-head">
          <ScInsurerLogo insurer={insurer} labelled size="large" />
          {insurer?.partner && <ScPartnerBadge id={`${id}-partner`} />}
        </div>
        <div className="hi-model-title">
          <h3>{product.name}</h3>
        </div>
        <p className="sc-panel-category">
          {insurer?.name} · {categoryLabel(index, product.category)}
        </p>
      </div>
      {product.summary && <p className="sc-panel-summary">{product.summary}</p>}
      <div className="hi-model-price-area" aria-busy={quoteBusy}>
        <div className="hi-model-price">
          {row ? (
            <div className="hi-model-price-line">
              <span className="sc-price-caption">{copy.price.indicative}</span>
              <p>
                {rowAmount(row)}
                <span className="hi-price-unit">
                  <small>{copy.currency}</small>
                  <em>{copy.perMonth}</em>
                </span>
              </p>
            </div>
          ) : (
            <PriceTag price={summary} />
          )}
          {rows.length > 1 && row && (
            <label className="sc-field">
              <span>{text.variant}</span>
              <select value={rowKey(row)} onChange={(event) => setSelected(event.target.value)}>
                {rows.map((item) => (
                  <option key={rowKey(item)} value={rowKey(item)}>
                    {`${rowLabel(item)} — ${rowAmount(item)} ${copy.currency}`}
                  </option>
                ))}
              </select>
            </label>
          )}
          {rows.length === 1 && row && <div className="sc-panel-variant">{rowLabel(row)}</div>}
          {row?.note && <div className="sc-panel-note">{row.note}</div>}
        </div>
        <button
          type="button"
          className="hi-primary hi-full hi-request-cta"
          onClick={() => onOrder(row ?? null)}
        >
          <HealthGradient />
          {text.order}
          <HealthIcon name="arrow" size={16} />
        </button>
        <button
          type="button"
          className="hi-secondary hi-full sc-panel-compare"
          aria-pressed={compared}
          disabled={!compared && compareFull}
          onClick={onCompare}
        >
          <HealthIcon name={compared ? "check" : "plus"} size={16} />
          {compared ? copy.compare.added : copy.compare.add}
        </button>
        {!compared && compareFull && <p className="hi-small">{copy.compare.full}</p>}
      </div>
      <div className="hi-tabs sc-tabs" role="tablist" aria-label={text.details}>
        {tabs.map((value) => (
          <button
            key={value}
            type="button"
            className={`sc-tab-${value}`}
            role="tab"
            id={`${id}-tab-${value}`}
            aria-controls={`${id}-panel-${value}`}
            aria-selected={value === tab}
            tabIndex={value === tab ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={(event) => {
              const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
              if (!direction) return;
              event.preventDefault();
              const next = tabs[(tabs.indexOf(tab) + direction + tabs.length) % tabs.length]!;
              setTab(next);
              document.getElementById(`${id}-tab-${next}`)?.focus();
            }}
          >
            <HealthIcon name={tabIcons[value]} size={18} />
            {text.tabs[value]}
            {counts[value] !== null && <span className="hi-tab-count">{counts[value]}</span>}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-${tab}`}
        aria-labelledby={`${id}-tab-${tab}`}
        className="hi-tab-content sc-tab-content"
        tabIndex={0}
      >
        {tab === "price" && (
          <>
            <h4 className="sc-panel-heading">{text.profile}</h4>
            <ProfilePills
              prefix={`${id}-profile`}
              profile={profile}
              onChange={onProfile}
              localities={index.catalog.localities}
              tone="light"
              title={false}
            />
            <h4 className="sc-panel-heading">{text.allPrices}</h4>
            {rows.length ? (
              <ul className="sc-price-rows">
                {rows.map((item) => (
                  <li
                    key={rowKey(item)}
                    className={row && rowKey(item) === rowKey(row) ? "is-selected" : undefined}
                  >
                    <span>
                      {rowLabel(item)}
                      {item.note && <small>{item.note}</small>}
                    </span>
                    <strong>
                      {rowAmount(item)} <small>{copy.currency}</small>
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="hi-small">{text.noPrices}</p>
            )}
            {product.publishedPrices.length > 0 && (
              <>
                <h4 className="sc-panel-heading">{copy.price.publishedFrom}</h4>
                <ul className="sc-price-rows">
                  {product.publishedPrices.map((item, position) => (
                    <li key={position}>
                      <span>
                        {item.profile}
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                            {copy.coverage.source} ↗
                          </a>
                        )}
                      </span>
                      {item.monthlyMinor !== null && (
                        <strong>
                          {chf(item.monthlyMinor)} <small>{copy.currency}</small>
                        </strong>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
        {tab === "benefits" && (
          <>
            <p className="hi-small">{plural(text.benefitsCount, benefits.length)}</p>
            {product.variants.length > 1 && (
              <label className="sc-field">
                <span>{text.variantFilter}</span>
                <select
                  value={variantFilter}
                  onChange={(event) => setVariantFilter(event.target.value)}
                >
                  <option value="">{copy.coverage.allVariants}</option>
                  {product.variants.map((variant) => (
                    <option key={variant.key} value={variant.key}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <BenefitList index={index} product={product} benefits={benefits} detailed />
          </>
        )}
        {tab === "conditions" && (
          <dl className="sc-conditions">
            {(
              [
                [text.prerequisites, product.prerequisites],
                [text.ageBands, product.ageBands],
                [text.discounts, product.discounts],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? text.nothing}</dd>
              </div>
            ))}
            {product.factors.length > 0 && (
              <div>
                <dt>{text.factors}</dt>
                <dd>
                  {product.factors.map((factor) => text.factorLabels[factor] ?? factor).join(", ")}
                </dd>
              </div>
            )}
            {product.conditionsDoc && (
              <div>
                <dt>{text.conditionsDoc}</dt>
                <dd>
                  {product.conditionsDoc.url ? (
                    <a href={product.conditionsDoc.url} target="_blank" rel="noreferrer">
                      {product.conditionsDoc.title} ↗
                    </a>
                  ) : (
                    product.conditionsDoc.title
                  )}
                  {product.conditionsDoc.edition && (
                    <small> · {product.conditionsDoc.edition}</small>
                  )}
                </dd>
              </div>
            )}
            {product.sourceUrls.length > 0 && (
              <div>
                <dt>{text.sources}</dt>
                <dd>
                  <ul className="sc-sources">
                    {product.sourceUrls.map((url, position) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer">
                          {interpolate(text.sourceLink, { index: position + 1 })} ·{" "}
                          {new URL(url).hostname.replace(/^www\./u, "")} ↗
                        </a>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </ScDialog>
  );
}
