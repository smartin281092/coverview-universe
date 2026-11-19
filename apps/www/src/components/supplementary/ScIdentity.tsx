import type { CSSProperties } from "react";
import type { SupplementaryInsurer } from "@coverview/api-client/supplementary-insurance";
import { supplementaryCopy as copy } from "../../content/fr/supplementary";
import { HealthIcon } from "../health-insurance/HealthIcon";

// The base comparator's insurer logos, found by the insurer's basic-insurance (BAG) number. An
// insurer without a logo there (AXA) gets a plain monogram: no logo is drawn or invented.
const assets = import.meta.glob<string>("../../assets/health-insurers/*.{svg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
const logos = new Map(
  Object.entries(assets).map(([path, url]) => [Number(path.match(/\/(\d+)\./)?.[1]), url]),
);
// Width / height of each logo used here, read from its file (SVG viewBox or PNG pixels). Logos are
// drawn at the same visual area, not the same height: a long wordmark (Groupe Mutuel, 6.5:1) would
// otherwise look tiny next to a compact one (KPT, 2.3:1).
const ratios = new Map([
  [8, 2.34],
  [290, 4.23],
  [312, 2.8],
  [343, 6.49],
  [376, 2.25],
  [509, 2.94],
  [1384, 4.59],
  [1509, 4.12],
  [1542, 6.44],
  [1555, 3.4],
  [1562, 5.29],
]);
// Optical correction of light or condensed wordmarks, which look smaller at the same area.
const weights = new Map([
  [290, 1.15],
  [343, 1.15],
]);
export function ScInsurerLogo({
  insurer,
  labelled = false,
  size = "small",
}: {
  insurer: Pick<SupplementaryInsurer, "name" | "bagInsurerId"> | undefined;
  labelled?: boolean;
  size?: "small" | "large" | "tile";
}) {
  const name = insurer?.name ?? "";
  const logo = insurer?.bagInsurerId ? logos.get(insurer.bagInsurerId) : undefined;
  const ratio = insurer?.bagInsurerId ? ratios.get(insurer.bagInsurerId) : undefined;
  return (
    <span
      className={`hi-insurer-logo sc-logo is-${size}${insurer?.bagInsurerId === 1386 ? " is-reversed" : ""}`}
      style={
        ratio
          ? ({
              "--sc-ar": ratio,
              "--sc-logo-k": weights.get(insurer?.bagInsurerId ?? 0) ?? 1,
            } as CSSProperties)
          : undefined
      }
      aria-hidden={!labelled}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? name : undefined}
    >
      {logo ? (
        <img src={logo} alt="" width="84" height="40" loading="lazy" decoding="async" />
      ) : (
        <span className="sc-monogram">{name.slice(0, 3).toUpperCase()}</span>
      )}
    </span>
  );
}

// The panel's partner card, as on the base comparator's model panel (24 October 2026).
export function ScPartnerBadge({ id }: { id: string }) {
  return (
    <section className="hi-partner-badge" aria-labelledby={`${id}-title`}>
      <h4 id={`${id}-title`}>{copy.partnerBadge.title}</h4>
      <div className="hi-partner-badge-level">
        <span className="hi-partner-badge-gold">{copy.partnerBadge.level}</span>
        <div className="hi-info-tooltip hi-partner-badge-info">
          <button
            type="button"
            aria-label={copy.partnerBadge.details}
            aria-describedby={`${id}-why`}
          >
            <HealthIcon name="info-i" size={18} />
          </button>
          <span role="tooltip" id={`${id}-why`}>
            {copy.partnerBadge.disclosure}
          </span>
        </div>
      </div>
    </section>
  );
}

// In lists, a flat mark beside the insurer's name: no card inside the card.
export function ScPartnerTag() {
  return (
    <span className="sc-partner-tag" title={copy.partnerBadge.disclosure}>
      {copy.card.partner}
    </span>
  );
}
