import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  HealthComparison,
  HealthOffer,
  HealthPremiumDifference as Difference,
} from "@coverview/api-client/health-insurance";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";
import { HealthContactTags, HealthInsurerLogo, HealthRecommendedMark } from "./HealthOfferIdentity";
import { HealthPremiumDifference } from "./HealthPremiumDifference";
import { money, regionName } from "./health-format";

// The card of a hovered or focused map area, shared by the 3D and SVG maps: its three lowest
// premiums, above the point (below it near the top), always inside the page.
export function HealthRegionPopover({
  region,
  anchor,
  stage,
  comparison,
  loading,
  differences,
  onOffer,
  onRegion,
  onList,
}: {
  region: string;
  // The point, in pixels from the map stage's top left corner.
  anchor: { x: number; y: number };
  stage: { width: number; height: number; left: number; viewport: number };
  comparison: HealthComparison | null;
  loading: boolean;
  differences: Map<string, Difference>;
  onOffer: (offer: HealthOffer) => void;
  onRegion: (id: string) => void;
  onList: (id: string) => void;
}) {
  const popover = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(300);
  useEffect(() => {
    const element = popover.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [region]);
  const offers = comparison?.regions.find((x) => x.regionId === region)?.offers ?? [];
  const below = anchor.y < height + 90 && stage.height - anchor.y > anchor.y - 88;
  const top = below
    ? Math.max(88, Math.min(stage.height - height - 24, anchor.y + 18))
    : Math.min(stage.height - 24, Math.max(height + 88, anchor.y - 18));
  const left = Math.max(
    Math.min(166, stage.width / 2) - stage.left,
    Math.min(stage.viewport - Math.min(166, stage.width / 2) - stage.left, anchor.x),
  );
  return (
    <div
      className={`hi-region-popover ${below ? "is-below" : ""}`}
      ref={popover}
      style={
        {
          left: `${left}px`,
          "--hi-pointer-offset": `${anchor.x - left}px`,
          top: `${top}px`,
        } as CSSProperties
      }
    >
      <div className="hi-popover-heading">
        <span className="hi-region-dot" />
        <strong>{regionName(region)}</strong>
        <span className="hi-popover-year">2027</span>
      </div>
      <p className="hi-overline">{copy.cheapest}</p>
      {region.startsWith("EU-") && <p className="hi-small">{copy.foreignHint}</p>}
      {loading ? (
        <p className="hi-map-state" role="status">
          {copy.loading}
        </p>
      ) : offers.length ? (
        offers.map((offer) => (
          <button className="hi-map-offer" key={offer.id} onClick={() => onOffer(offer)}>
            <HealthInsurerLogo offer={offer} labelled />
            <span className="hi-offer-description">
              <span className="hi-result-name">
                <strong>{offer.name}</strong>
                {offer.recommended && <HealthRecommendedMark />}
              </span>
              <HealthContactTags offer={offer} />
              {offer.eligibility === "municipality_required" && <em>{copy.chooseLocality}</em>}
            </span>
            <span className="hi-offer-price">
              <strong>{money(offer.monthlyPremiumMinor)}</strong>
              <small>
                {copy.currency} {copy.perMonth}
              </small>
            </span>
            <HealthIcon name="chevron" size={15} />
            <HealthPremiumDifference value={differences.get(offer.id)} />
          </button>
        ))
      ) : (
        <p className="hi-map-state">{comparison ? copy.empty : copy.unavailable}</p>
      )}
      <button
        className="hi-popover-all"
        onClick={() => {
          onRegion(region);
          onList(region);
        }}
      >
        {copy.viewAll}
        <HealthIcon name="arrow" size={16} />
      </button>
    </div>
  );
}
