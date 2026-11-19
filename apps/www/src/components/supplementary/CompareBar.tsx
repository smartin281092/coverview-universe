import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthIcon } from "../health-insurance/HealthIcon";
import { ScInsurerLogo } from "./ScIdentity";
import { comparisonHref, interpolate, maxCompared, type CatalogIndex } from "./supplementary-model";

const text = copy.compare;

// The products set aside for the comparison, kept at the bottom of the screen (4 at most).
export function CompareBar({
  index,
  keys,
  onRemove,
  onClear,
  notice,
}: {
  index: CatalogIndex;
  keys: string[];
  onRemove: (key: string) => void;
  onClear: () => void;
  notice: boolean;
}) {
  const products = keys.flatMap((key) => index.products.get(key) ?? []);
  if (!products.length) return null;
  return (
    <aside className="sc-compare-bar" aria-label={text.bar}>
      <div className="sc-compare-inner">
        <ul>
          {products.map((product) => (
            <li key={product.key}>
              <ScInsurerLogo insurer={index.insurers.get(product.insurer)} />
              <span className="sc-compare-name">{product.name}</span>
              <button
                type="button"
                className="hi-icon-button"
                aria-label={interpolate(text.remove, { name: product.name })}
                onClick={() => onRemove(product.key)}
              >
                <HealthIcon name="close" size={14} />
              </button>
            </li>
          ))}
          {Array.from({ length: maxCompared - products.length }, (_, position) => (
            <li key={`empty-${position}`} className="is-empty" aria-hidden="true" />
          ))}
        </ul>
        <div className="sc-compare-actions">
          <button type="button" className="sc-link-button" onClick={onClear}>
            {text.clear}
          </button>
          <a
            className="hi-primary sc-compare-go"
            href={comparisonHref(products.map((product) => product.key))}
          >
            {interpolate(text.go, { count: products.length })}
            <HealthIcon name="arrow" size={16} />
          </a>
        </div>
      </div>
      <p className="sc-compare-notice" role="status">
        {notice ? text.full : ""}
      </p>
    </aside>
  );
}
