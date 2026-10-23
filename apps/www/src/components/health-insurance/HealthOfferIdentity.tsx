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
// The first model of a partner insurer in its list (23 October 2026): a pink laurel wreath, as a tag
// in the list and as a mark in the map's region card.
// Left branch leaves along its stem, outer and inner, as [cx, cy, rx, ry, angle]; mirrored on the right.
const laurelLeaves = [
  [7.84, 18.92, 0.95, 1.9, -33],
  [5.26, 19.47, 1.15, 2.3, -86],
  [5.89, 15.77, 0.95, 1.9, -2],
  [3.26, 14.68, 1.15, 2.3, -56],
  [5.25, 10.99, 0.95, 1.9, 23],
  [3.05, 8.71, 1.15, 2.3, -36],
  [4.86, 5.31, 1.1, 2.3, 6],
] as const;
function LaurelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M11.2 21.3C6.6 20.4 3.6 16.4 4.6 7.6M12.8 21.3c4.6-.9 7.6-4.9 6.6-13.7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {laurelLeaves.flatMap(([x, y, rx, ry, angle]) => [
        <ellipse
          key={`l${x}`}
          cx={x}
          cy={y}
          rx={rx}
          ry={ry}
          transform={`rotate(${angle} ${x} ${y})`}
          fill="currentColor"
        />,
        <ellipse
          key={`r${x}`}
          cx={24 - x}
          cy={y}
          rx={rx}
          ry={ry}
          transform={`rotate(${-angle} ${24 - x} ${y})`}
          fill="currentColor"
        />,
      ])}
    </svg>
  );
}
export function HealthRecommendedTag() {
  return (
    <span className="hi-recommended-tag" title={copy.recommendedHint}>
      <LaurelIcon />
      {copy.recommended}
    </span>
  );
}
export function HealthRecommendedMark() {
  return (
    <span
      className="hi-recommended-mark"
      role="img"
      aria-label={copy.recommended}
      title={copy.recommendedHint}
    >
      <LaurelIcon />
    </span>
  );
}
