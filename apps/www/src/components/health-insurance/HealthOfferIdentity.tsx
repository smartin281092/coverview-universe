import type { HealthOffer } from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";

const assets = import.meta.glob<string>("../../assets/health-insurers/*.{svg,png}", {
  eager: true,
  query: "?url",
  import: "default",
});
const logos = new Map(
  Object.entries(assets).map(([path, url]) => [Number(path.match(/\/(\d+)\./)?.[1]), url]),
);
export function HealthInsurerLogo({
  offer,
  labelled = false,
}: {
  offer: Pick<HealthOffer, "insurerId" | "insurerName" | "insurerBrand">;
  labelled?: boolean;
}) {
  const logo = logos.get(offer.insurerId);
  return (
    <span
      className={`hi-insurer-logo${offer.insurerId === 1386 ? " is-reversed" : ""}`}
      aria-hidden={!labelled}
      role={labelled ? "img" : undefined}
      aria-label={labelled ? (offer.insurerBrand ?? offer.insurerName) : undefined}
    >
      {logo ? (
        <img src={logo} alt="" width="84" height="40" />
      ) : (
        <span>{(offer.insurerBrand ?? offer.insurerName).slice(0, 2)}</span>
      )}
    </span>
  );
}
const icons = {
  free: "shield",
  gp: "doctor",
  network: "network",
  phone: "phone",
  video: "video",
  pharmacy: "pharmacy",
} as const;
const categoryIcons = {
  BASE: "shield",
  PRAXIS: "doctor",
  TEL_DIG: "phone",
  FLEX: "network",
  PHARM: "pharmacy",
} as const;
export function HealthContactTags({ offer }: { offer: HealthOffer }) {
  return (
    <span className="hi-contact-tags">
      {offer.firstContacts?.length ? (
        offer.firstContacts.map((contact) => (
          <span className="hi-contact-tag" key={contact}>
            <HealthIcon name={icons[contact]} size={14} />
            {copy.contactLabels[contact]}
          </span>
        ))
      ) : (
        <span
          className="hi-contact-tag"
          title={offer.category === "BASE" ? undefined : copy.contactVerification}
        >
          <HealthIcon name={categoryIcons[offer.category]} size={14} />
          {offer.residenceCountry ? copy.foreignModelType : copy.typeLabels[offer.category]}
        </span>
      )}
    </span>
  );
}
export function HealthOfferBadges({
  cheapest = false,
  preferred = false,
  provisional = false,
}: {
  cheapest?: boolean;
  preferred?: boolean;
  provisional?: boolean;
}) {
  if (!cheapest && !preferred) return null;
  return (
    <span className="hi-offer-badges">
      {cheapest && (
        <span className="hi-offer-badge is-cheapest" title={copy.lowestPriceHint}>
          <HealthIcon name="discount" size={14} />
          {copy.lowestPrice}
        </span>
      )}
      {preferred && (
        <span
          className="hi-offer-badge is-preferred"
          title={provisional ? copy.provisionalBadge : undefined}
        >
          <HealthIcon name="verified" size={14} />
          {copy.mostSuitable}
          {provisional && <span aria-label={copy.provisionalBadge}>*</span>}
        </span>
      )}
    </span>
  );
}
// The first model of a partner insurer in its list (23 October 2026): pink tag with a laurel wreath.
const laurelLeaves = [
  [4.9, 7.3, -8],
  [3, 11.2, -46],
  [3.6, 15.3, -76],
  [6, 18.7, -108],
] as const;
export function HealthRecommendedTag() {
  return (
    <span className="hi-recommended-tag" title={copy.recommendedHint}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M11.2 21.4C6.9 20.5 4.1 16.6 4.5 10.2M12.8 21.4c4.3-.9 7.1-4.8 6.7-11.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {laurelLeaves.flatMap(([x, y, angle]) => [
          <ellipse
            key={`l${x}`}
            cx={x}
            cy={y}
            rx="1.25"
            ry="2.5"
            transform={`rotate(${angle} ${x} ${y})`}
            fill="currentColor"
          />,
          <ellipse
            key={`r${x}`}
            cx={24 - x}
            cy={y}
            rx="1.25"
            ry="2.5"
            transform={`rotate(${-angle} ${24 - x} ${y})`}
            fill="currentColor"
          />,
        ])}
      </svg>
      {copy.recommended}
    </span>
  );
}
