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
  return (
    <span
      className={`hi-insurer-logo sc-logo is-${size}${insurer?.bagInsurerId === 1386 ? " is-reversed" : ""}`}
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
