import { useId, useMemo, useState } from "react";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthIcon } from "../health-insurance/HealthIcon";
import { PriceTag } from "./PriceTag";
import { ScDialog } from "./ScDialog";
import { ScInsurerLogo } from "./ScIdentity";
import {
  categoryLabel,
  interpolate,
  isTaxonomyTag,
  plural,
  shortLabel,
  type CatalogIndex,
  type PriceSummary,
} from "./supplementary-model";

const text = copy.picker;
const shownMax = 60;
const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export type PickerMode = { kind: "add" } | { kind: "replace"; key: string };

/**
 * Choosing a product for the comparison: text search, a theme (a benefit family: « Dentaire »
 * keeps the products with a dental coverage), a precise benefit and a category.
 */
export function ProductPicker({
  index,
  prices,
  compared,
  mode,
  onPick,
  onRemove,
  onClose,
}: {
  index: CatalogIndex;
  prices: Map<string, PriceSummary>;
  compared: string[];
  mode: PickerMode;
  onPick: (key: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState("");
  const [tag, setTag] = useState("");
  const [category, setCategory] = useState("");
  const replaced = mode.kind === "replace" ? index.products.get(mode.key) : undefined;
  const familyTags = useMemo(
    () =>
      index.catalog.tags.filter(
        (item) => isTaxonomyTag(item.key) && (!family || item.family === family),
      ),
    [index, family],
  );
  const found = useMemo(() => {
    const words = fold(query).split(/\s+/u).filter(Boolean);
    return index.catalog.products.filter((product) => {
      if (category && product.category !== category) return false;
      if (tag && !product.tags.includes(tag)) return false;
      if (family && !product.tags.some((item) => index.tags.get(item)?.family === family))
        return false;
      if (!words.length) return true;
      const haystack = fold(`${product.name} ${index.insurers.get(product.insurer)?.name ?? ""}`);
      return words.every((word) => haystack.includes(word));
    });
  }, [index, query, family, tag, category]);
  return (
    <ScDialog
      open
      onClose={onClose}
      title={replaced ? interpolate(text.replace, { name: replaced.name }) : text.add}
      className="sc-picker"
    >
      <div className="sc-picker-search">
        <HealthIcon name="search" size={18} />
        <input
          type="search"
          aria-label={text.search}
          placeholder={text.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="sc-picker-themes" role="group" aria-label={text.theme}>
        <button
          type="button"
          aria-pressed={!family}
          onClick={() => {
            setFamily("");
            setTag("");
          }}
        >
          {text.allThemes}
        </button>
        {index.catalog.families
          .filter((item) => index.taxonomyFamilies.has(item.key))
          .map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={family === item.key}
              onClick={() => {
                setFamily(item.key);
                setTag("");
              }}
            >
              {item.label}
            </button>
          ))}
      </div>
      <div className="sc-picker-selects">
        <label className="sc-field">
          <span>{text.tag}</span>
          <select value={tag} onChange={(event) => setTag(event.target.value)}>
            <option value="">{text.allTags}</option>
            {familyTags.map((item) => (
              <option key={item.key} value={item.key}>
                {shortLabel(item.label)}
              </option>
            ))}
          </select>
        </label>
        <label className="sc-field">
          <span>{text.category}</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">{text.allCategories}</option>
            {index.catalog.categories.map((item) => (
              <option key={item.key} value={item.key}>
                {shortLabel(item.label)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="sc-picker-count" id={`${id}-count`} aria-live="polite">
        {plural(text.count, found.length)}
      </p>
      {found.length ? (
        <ul className="sc-picker-list" aria-describedby={`${id}-count`}>
          {found.slice(0, shownMax).map((product) => {
            const already = compared.includes(product.key);
            return (
              <li key={product.key}>
                <button type="button" disabled={already} onClick={() => onPick(product.key)}>
                  <ScInsurerLogo insurer={index.insurers.get(product.insurer)} />
                  <span className="sc-picker-name">
                    <strong>{product.name}</strong>
                    <small>
                      {index.insurers.get(product.insurer)?.name} ·{" "}
                      {categoryLabel(index, product.category)}
                    </small>
                  </span>
                  {already ? (
                    <span className="sc-picker-already">{text.already}</span>
                  ) : (
                    <PriceTag price={prices.get(product.key) ?? { kind: "none" }} compact />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sc-empty-line">{text.none}</p>
      )}
      {replaced && (
        <div className="sc-sheet-footer">
          <button type="button" className="hi-secondary hi-full" onClick={onRemove}>
            {copy.comparisonView.remove}
          </button>
        </div>
      )}
    </ScDialog>
  );
}
