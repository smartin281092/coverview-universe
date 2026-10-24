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
        <span className="hi-contact-tag">
          <HealthIcon name={categoryIcons[offer.category]} size={14} />
          {offer.residenceCountry ? copy.foreignModelType : copy.typeLabels[offer.category]}
        </span>
      )}
    </span>
  );
}
// The model page's first contacts (23 October 2026): each way in the insurer documents, with a
// plain sentence (24 October 2026: « exactement à quoi ça correspond », no pending check
// shown); without a documented list, the model type.
export function HealthFirstContacts({ offer }: { offer: HealthOffer }) {
  const contacts = offer.firstContacts ?? [];
  return (
    <section className="hi-first-contacts" aria-labelledby="hi-first-contacts-title">
      <h4 id="hi-first-contacts-title">{copy.firstContactTitle}</h4>
      {contacts.length > 1 && <p className="hi-first-contacts-choice">{copy.firstContactChoice}</p>}
      {contacts.length ? (
        <ul>
          {contacts.map((contact) => (
            <li key={contact}>
              <span className="hi-first-contact-icon">
                <HealthIcon name={icons[contact]} size={18} />
              </span>
              <span>
                <strong>{copy.contactLabels[contact]}</strong>
                <small>{copy.contactDetails[contact]}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul>
          <li>
            <span className="hi-first-contact-icon">
              <HealthIcon name={categoryIcons[offer.category]} size={18} />
            </span>
            <span>
              <strong>
                {offer.residenceCountry ? copy.foreignModelType : copy.typeLabels[offer.category]}
              </strong>
            </span>
          </li>
        </ul>
      )}
    </section>
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
// The laurel drawn by the user, vectorized from the drawing: a light fill (the same pink at 29%
// opacity, as drawn) under the strokes.
const laurelFill =
  "M51.5 19L50.5 19.6L47.5 20L45.5 21L43.5 22.8L42.5 23L39 27.5L38.6 29.5L37.5 30.9L37 29.5L35.1 27.5L35 26.5L33.5 25L30.5 23L29.5 23L29 23.5L28.9 24.5L28 25.5L27.9 26.5L26 29.5L25.9 30.5L25 31.5L24.8 34.5L24 35.5L25 41.5L25.6 42.5L23.5 42.9L21.5 42.6L20.5 42L19.5 42L19 42.5L19 52.5L19.8 53.5L20 55.5L20.9 56.5L21 57.5L24.9 61.5L24.5 62.6L22.5 63L19.8 64.5L20 66.5L22 69.5L22 70.5L23.5 72.1L27.5 76L31.5 78L33.5 78.2L34.5 79L39.5 79L44.5 77.2L45.5 78L47 79.5L41 82.5L41 83.5L42 84.5L42 85.5L42.5 86L44.5 86L45.5 85.1L46.5 85L47.5 84.1L48.5 84L49.5 83.1L51.5 82.4L70.5 82.4L77.5 86L79.5 86L80 85.5L80 84.5L81 83.5L81 82.5L78.5 81L77.5 80.9L76.5 80L75.5 79.9L74.5 79L73.5 78.9L72.5 78L57.5 77.9L50.5 75.9L44.5 71.9L41.2 68.5L41 67.5L39.1 65.5L39 64.5L38.1 63.5L36.2 57.5L36 50.5L36.2 48.5L37 47.5L37 45.5L38 44.5L38 43.5L39 42.5L39 41.5L41.5 38.2L46.5 38L50.5 36L55 31.5L55 30.5L56 29.5L56.2 27.5L57 26.5L57 19.5L56.5 19ZM65.5 19L65 19.5L65 25.5L65.6 26.5L66 29.5L67 30.5L67 31.5L71.5 36L75.5 38L80.5 38.2L83 41.5L83 42.5L85 45.5L85 47.5L85.8 48.5L85.8 56.5L85 58.5L84.9 60.5L84 61.5L83.9 63.5L79.9 69.5L76.5 72.8L75.5 73L74 74.5L82.5 79L87.5 79L88.5 78.1L90.5 78L94.5 76L96.2 74.5L99 71.5L99.2 70.5L101 68.5L101.1 67.5L102 66.5L102.1 64.5L99.5 63L97.5 62.8L97.2 61.5L101 57.5L101.1 56.5L102 55.5L102.2 53.5L103 52.5L103 42.5L102.5 42L101.5 42.6L98.5 43L97.5 43L97 42.5L97.4 38.5L98 37.5L97 31.5L96.1 30.5L96 29.5L92.5 23L91.5 23L89.5 24.8L88.5 25L85 29.5L84.5 30.9L83.4 29.5L83 27.5L81.2 25.5L81 24.5L76.5 21L74.5 20L71.5 19.6L70.5 19Z";
const laurelStroke =
  "M52.5 19.3L47.5 20.3L42.5 23.3L40.1 26.5L38.6 30.5L37.5 31.6L34.5 26.6L30.5 23.2L29.5 23.6L26.1 29.5L25.1 32.5L24.6 36.5L25.2 41.5L25.8 42.5L25.5 43.1L19.5 42.6L19.1 43.5L19.3 52.5L22.1 58.5L25.6 62.5L20.5 64.2L19.9 65.5L24 72.5L27.5 75.8L29.5 76.9L35.5 78.8L39.5 78.7L44.5 77.1L46.3 78.5L47.2 79.5L46.5 80.1L41.6 82.5L41.6 83.5L42.5 85.4L43.5 86L51.5 82.2L70.5 82.2L78.5 86.1L79.5 85.4L80.4 83.5L80.4 82.5L72.5 78.3L55.5 77.8L52.5 76.9L48.5 74.9L45.5 72.9L42 69.5L38 63.5L36.2 58.5L36 56.5L36 49.5L36.9 45.5L39.4 40.5L41.5 38.1L45.5 37.9L48.5 36.8L52.5 33.9L54.5 31.4L56.5 26.3L56.8 20.5L56.3 19.5ZM66.5 19.3L65.5 19.6L65.2 20.5L65.2 24.5L66.1 28.5L68.2 32.5L70.5 34.9L73.5 36.8L76.5 37.9L80.5 38.1L83.1 41.5L85.1 45.5L85.3 47.5L85.9 48.5L85.9 56.5L84 63.5L83 65.5L79.5 70.1L74.6 74.5L80.5 77.8L82.5 78.4L86.5 78.7L92.5 76.9L96.5 74.1L101.8 66.5L102.1 65.5L101.5 64.2L96.4 62.5L99.9 58.5L101.9 54.5L102.9 50.5L102.9 43.5L102.5 42.6L97.5 43.1L96.5 43.8L96.2 43.5L97.4 37.5L96.9 32.5L94.8 27.5L92.4 23.5L91.5 23.2L88.5 25.6L86 28.5L84.5 31.6L82 26.5L80.5 24.6L76.5 21.2L74.5 20.2L69.5 19.3ZM49.3 24.5L51.5 24.1L52.2 24.5L51.8 27.5L49.7 30.5L46.5 32.8L44.5 33.6L42.5 33.5L42.3 32.5L43.2 30.5L43.2 29.5L45.6 26.5ZM70.1 24.5L72.5 24.4L77.5 27.7L79.6 32.5L79.3 33.5L76.8 33.5L72.5 30.8L71.3 28.5L70.2 27.5ZM30.8 30.5L31.5 29.8L32.7 31.5L34 35.5L33.8 40.5L32.5 43.1L31.5 43.7L30.2 42.5L29.1 38.5L29.2 33.5ZM90.2 30.5L90.5 29.8L91.5 30.8L92.8 34.5L92.8 38.5L92.1 40.5L92.2 41.5L90.5 43.9L88.2 40.5L88 36.5L88.5 33ZM23.4 48.5L23.5 48.2L25.5 48.5L27.2 49.5L29.5 52.1L30.8 54.5L31.4 59.5L29.5 59.6L25.2 55.5L25.2 54.5L24.2 53.5ZM96.5 48.5L98.5 48.1L98.7 49.5L98.1 50.5L97.8 53.5L96.8 54.5L96.8 55.5L92.5 59.6L90.6 59.5L91.5 53.8L93 51.5ZM26.2 67.5L26.5 67L32.5 67.3L35.5 69.5L38.7 73.5L38.5 73.9L35.5 74.2L32.5 73.7L29.2 71.5L27.2 69.5ZM89.4 67.5L93.5 66.8L95.5 67.2L95.8 67.5L95.6 68.5L94.8 69.5L92.5 71.7L89.5 73.6L85.5 74.2L83.5 73.9L83.3 73.5L85.4 70.5Z";
function LaurelIcon() {
  return (
    <svg width="12" height="12" viewBox="17 11.5 88 88" aria-hidden="true">
      <path d={laurelFill} fill="currentColor" fillOpacity="0.29" />
      <path d={laurelStroke} fill="currentColor" fillRule="evenodd" />
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
