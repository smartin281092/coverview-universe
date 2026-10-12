import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  HealthComparison,
  HealthOffer,
  HealthPremiumDifference as Difference,
} from "@coverview/api-client/health-insurance";
import { HealthPremiumDifference } from "./HealthPremiumDifference";
import map from "../../../../../data/health-insurance/2027/regions-map.json";
import neighbors from "../../../../../data/health-insurance/2027/neighbors-map.json";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthIcon } from "./HealthIcon";
import { HealthContactTags, HealthInsurerLogo } from "./HealthOfferIdentity";
import { money, regionName } from "./health-format";
const frame = { x: -160, y: -100, width: 1320, height: 850 };
const vaudRegions = map.regions.filter((region) => region.canton === "VD");
const vaud = {
  x:
    vaudRegions.reduce((sum, region) => sum + (region.labelPoint[0] ?? 500), 0) /
    vaudRegions.length,
  y:
    vaudRegions.reduce((sum, region) => sum + (region.labelPoint[1] ?? 325), 0) /
    vaudRegions.length,
};
// A view never pans the map out of its frame.
const bounded = (x: number, y: number, scale: number) => ({
  x: Math.max(
    (frame.x + frame.width) * (1 - scale) - 500 * scale,
    Math.min(frame.x * (1 - scale) + 500 * scale, x),
  ),
  y: Math.max(
    (frame.y + frame.height) * (1 - scale) - 350 * scale,
    Math.min(frame.y * (1 - scale) + 350 * scale, y),
  ),
  scale,
});
// Small screens start much closer (12 October 2026): the whole country is unreadable there.
const startScale = (width: number) => (width < 520 ? 2.5 : width < 900 ? 1.6 : 1);
// The starting view: the chosen locality's region, or Vaud, in the middle of the frame.
const startView = (regionId: string | null, scale: number) => {
  const target = regionId ? map.regions.find((region) => region.id === regionId) : null;
  const point = target ? { x: target.labelPoint[0] ?? 500, y: target.labelPoint[1] ?? 325 } : vaud;
  return bounded(
    frame.x + frame.width / 2 - point.x * scale,
    frame.y + frame.height / 2 - point.y * scale,
    scale,
  );
};
const initialView = startView(null, 1);

export function SwissPremiumMap({
  comparison,
  selected,
  localityId,
  onRegion,
  onOffer,
  onList,
  loading,
  differences,
}: {
  comparison: HealthComparison | null;
  selected: string;
  localityId: string | undefined;
  onRegion: (id: string) => void;
  onOffer: (offer: HealthOffer) => void;
  onList: (id: string) => void;
  loading: boolean;
  differences: Map<string, Difference>;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [entry, setEntry] = useState<{ x: number; y: number } | null>(null);
  const [view, setView] = useState(initialView);
  const svg = useRef<SVGSVGElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const [popoverHeight, setPopoverHeight] = useState(300);
  useEffect(() => {
    const element = popover.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setPopoverHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, [hover]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) setHover(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  // Once the person zooms or pans, a change of width no longer resets their view.
  const touched = useRef(false);
  // Two fingers: distance, midpoint and view when the second finger lands. Each move is
  // computed from this start, so a pan at the minimum scale cannot creep into a zoom.
  const gesture = useRef<{
    distance: number;
    midpoint: { x: number; y: number };
    view: { x: number; y: number; scale: number };
  } | null>(null);
  const restart = () => {
    const [first, second] = [...pointers.current.values()];
    gesture.current =
      pointers.current.size === 2 && first && second
        ? {
            distance: Math.hypot(first.x - second.x, first.y - second.y),
            midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
            view,
          }
        : null;
  };
  const [size, setSize] = useState({ width: 1000, height: 650, left: 0, viewport: 1000 });
  // Measured at once on mount (the starting zoom needs the width before the first resize), then
  // on every resize.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const measure = () => {
      const box = element.getBoundingClientRect();
      setSize({
        width: box.width,
        height: box.height,
        left: box.left,
        viewport: document.documentElement.clientWidth,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = startScale(size.width);
  useEffect(() => {
    setHover((current) => (current === selected ? current : null));
    touched.current = false;
    setView(startView(localityId ? selected : null, scale));
  }, [localityId]);
  useEffect(() => {
    if (!touched.current) setView(startView(localityId ? selected : null, scale));
  }, [scale]);
  const zoom = (factor: number, point = { x: 500, y: 325 }) => {
    touched.current = true;
    setHover(null);
    setView((previous) => {
      const scale = Math.max(1, Math.min(6, previous.scale * factor));
      const ratio = scale / previous.scale;
      return bounded(
        point.x - (point.x - previous.x) * ratio,
        point.y - (point.y - previous.y) * ratio,
        scale,
      );
    });
  };
  // The map point under the fingers' midpoint at the start follows the midpoint, and the
  // distance between the fingers sets the scale: a pinch zooms and pans in the same gesture.
  const pinch = (first: { x: number; y: number }, second: { x: number; y: number }) => {
    const start = gesture.current;
    if (!start) return;
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
    const next = Math.max(
      1,
      Math.min(6, start.view.scale * (start.distance > 0 ? distance / start.distance : 1)),
    );
    touched.current = true;
    const content = {
      x: (start.midpoint.x - start.view.x) / start.view.scale,
      y: (start.midpoint.y - start.view.y) / start.view.scale,
    };
    setHover(null);
    setView(bounded(midpoint.x - content.x * next, midpoint.y - content.y * next, next));
  };
  const point = (clientX: number, clientY: number) => {
    const matrix = svg.current?.getScreenCTM()?.inverse();
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix) : { x: 500, y: 325 };
  };
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(Math.exp(-event.deltaY * 0.002), point(event.clientX, event.clientY));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const active = hover ?? selected;
  const region = [...map.regions, ...neighbors.regions].find((x) => x.id === active);
  const offers = comparison?.regions.find((x) => x.regionId === active)?.offers ?? [];
  const x = region?.labelPoint[0] ?? 500;
  const y = region?.labelPoint[1] ?? 300;
  const enter = (id: string, clientX: number, clientY: number) => {
    if (pointers.current.size) return;
    const cursor = point(clientX, clientY);
    setEntry({ x: (cursor.x - view.x) / view.scale, y: (cursor.y - view.y) / view.scale });
    setHover(id);
  };
  const ratio = Math.min(size.width / frame.width, size.height / frame.height);
  const anchorX =
    (size.width - frame.width * ratio) / 2 +
    ((entry?.x ?? x) * view.scale + view.x - frame.x) * ratio;
  const anchorY =
    (size.height - frame.height * ratio) / 2 +
    ((entry?.y ?? y) * view.scale + view.y - frame.y) * ratio;
  const below = anchorY < popoverHeight + 90 && size.height - anchorY > anchorY - 88;
  const popupTop = below
    ? Math.max(88, Math.min(size.height - popoverHeight - 24, anchorY + 18))
    : Math.min(size.height - 24, Math.max(popoverHeight + 88, anchorY - 18));
  const popupX = Math.max(
    Math.min(166, size.width / 2) - size.left,
    Math.min(size.viewport - Math.min(166, size.width / 2) - size.left, anchorX),
  );
  return (
    <div
      className="hi-map-wrap"
      ref={wrapper}
      onPointerMove={(event) => {
        if (event.pointerType === "touch" || pointers.current.size) return;
        // Hit-test through the floating card so a fast upward move cannot pin it in place.
        const target =
          (event.target as Element).closest<SVGPathElement>("[data-region]") ??
          ((event.target as Element).closest(".hi-region-popover")
            ? document
                .elementsFromPoint(event.clientX, event.clientY)
                .find(
                  (element): element is SVGPathElement =>
                    element instanceof SVGPathElement && !!element.dataset.region,
                )
            : undefined);
        if (target?.dataset.region) enter(target.dataset.region, event.clientX, event.clientY);
        else setHover(null);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") setHover(null);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHover(null);
      }}
    >
      <div ref={stage} className="hi-map-stage">
        <svg
          ref={svg}
          className="hi-map"
          viewBox={`${frame.x} ${frame.y} ${frame.width} ${frame.height}`}
          aria-label={copy.mapLabel}
          role="group"
          onPointerDown={(event) => {
            pointers.current.set(event.pointerId, point(event.clientX, event.clientY));
            moved.current = false;
            restart();
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const previous = pointers.current.get(event.pointerId);
            if (!previous) return;
            const next = point(event.clientX, event.clientY);
            const other = [...pointers.current.entries()].find(
              ([id]) => id !== event.pointerId,
            )?.[1];
            if (Math.hypot(next.x - previous.x, next.y - previous.y) < 3 && !moved.current) return;
            moved.current = true;
            touched.current = true;
            setHover(null);
            if (other) pinch(next, other);
            else
              setView((current) =>
                bounded(
                  current.x + next.x - previous.x,
                  current.y + next.y - previous.y,
                  current.scale,
                ),
              );
            pointers.current.set(event.pointerId, next);
          }}
          onPointerUp={(event) => {
            pointers.current.delete(event.pointerId);
            restart();
            event.currentTarget.releasePointerCapture(event.pointerId);
            if (!moved.current) {
              const target = document
                .elementFromPoint(event.clientX, event.clientY)
                ?.closest<SVGPathElement>("[data-region]");
              const id = target?.dataset.region;
              if (id) {
                onRegion(id);
                onList(id);
                setHover(null);
              }
            }
          }}
          onPointerCancel={(event) => {
            pointers.current.delete(event.pointerId);
            restart();
            moved.current = true;
          }}
        >
          <defs>
            <filter id="hi-map-shadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow
                dx="0"
                dy="12"
                stdDeviation="14"
                floodColor="#333333"
                floodOpacity=".08"
              />
            </filter>
          </defs>
          <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
            <g className="hi-neighbors">
              {neighbors.regions.map((item) => (
                <path
                  key={item.id}
                  d={item.path}
                  fillRule="evenodd"
                  data-region={item.country === "LI" ? undefined : item.id}
                  className={`hi-country ${item.id === active ? "is-active" : ""}`}
                  role={item.country === "LI" ? undefined : "button"}
                  tabIndex={item.country === "LI" ? undefined : 0}
                  aria-label={regionName(item.id)}
                  aria-pressed={item.id === selected}
                  onPointerEnter={(event) => {
                    if (item.country !== "LI" && event.pointerType !== "touch")
                      enter(item.id, event.clientX, event.clientY);
                  }}
                  onFocus={() => {
                    setEntry(null);
                    if (item.country !== "LI") setHover(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (item.country !== "LI" && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault();
                      onRegion(item.id);
                      onList(item.id);
                      setHover(null);
                    }
                    if (event.key === "Escape") setHover(null);
                  }}
                >
                  <title>{regionName(item.id)}</title>
                </path>
              ))}
            </g>
            <g className="hi-country-borders" aria-hidden="true">
              {neighbors.regions.map((item) => (
                <path key={item.id} d={item.borderPath} />
              ))}
            </g>
            <g filter="url(#hi-map-shadow)">
              {map.regions.map((item, index) => (
                <path
                  key={item.id}
                  d={item.path}
                  data-region={item.id}
                  fillRule="evenodd"
                  className={`hi-region hi-region-${index % 4} ${item.id === active ? "is-active" : ""} ${item.id === selected ? "is-selected" : ""}`}
                  tabIndex={0}
                  role="button"
                  aria-label={regionName(item.id)}
                  aria-pressed={item.id === selected}
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "touch") enter(item.id, event.clientX, event.clientY);
                  }}
                  onFocus={() => {
                    setEntry(null);
                    setHover(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onRegion(item.id);
                      onList(item.id);
                      setHover(null);
                    }
                    if (event.key === "Escape") setHover(null);
                  }}
                >
                  <title>{regionName(item.id)}</title>
                </path>
              ))}
            </g>
            <g aria-hidden="true" className="hi-map-labels">
              {neighbors.regions
                .filter((item) => item.country !== "LI")
                .map((item) => (
                  <text
                    className="hi-country-label"
                    key={item.id}
                    x={item.labelPoint[0]}
                    y={item.labelPoint[1]}
                  >
                    {new Intl.DisplayNames(["fr-CH"], { type: "region" }).of(item.country)}
                  </text>
                ))}
              {map.regions
                .filter((item) => item.region === 0 || item.region === 1)
                .map((item) => (
                  <text
                    key={item.id}
                    x={item.labelPoint[0]}
                    y={item.labelPoint[1]}
                    className={item.id === active ? "is-active" : ""}
                  >
                    {item.canton}
                  </text>
                ))}
            </g>
          </g>
        </svg>
        <div className="hi-map-controls" aria-label={copy.mapControls}>
          <button onClick={() => zoom(1.35)} disabled={view.scale >= 6} aria-label={copy.mapZoomIn}>
            +
          </button>
          <button
            onClick={() => zoom(1 / 1.35)}
            disabled={view.scale <= 1}
            aria-label={copy.mapZoomOut}
          >
            −
          </button>
          <button
            onClick={() => {
              touched.current = false;
              setView(startView(null, scale));
              setHover(null);
            }}
            aria-label={copy.mapReset}
          >
            ⌖
          </button>
        </div>
        {hover && region && (
          <div
            className={`hi-region-popover ${below ? "is-below" : ""}`}
            ref={popover}
            style={
              {
                left: `${popupX}px`,
                "--hi-pointer-offset": `${anchorX - popupX}px`,
                top: `${popupTop}px`,
              } as CSSProperties
            }
          >
            <div className="hi-popover-heading">
              <span className="hi-region-dot" />
              <strong>{regionName(active)}</strong>
              <span className="hi-popover-year">2027</span>
            </div>
            <p className="hi-overline">{copy.cheapest}</p>
            {active.startsWith("EU-") && <p className="hi-small">{copy.foreignHint}</p>}
            {loading ? (
              <p className="hi-map-state" role="status">
                {copy.loading}
              </p>
            ) : offers.length ? (
              offers.map((offer) => (
                <button className="hi-map-offer" key={offer.id} onClick={() => onOffer(offer)}>
                  <HealthInsurerLogo offer={offer} labelled />
                  <span className="hi-offer-description">
                    <strong>{offer.name}</strong>
                    <HealthContactTags offer={offer} />
                    {offer.eligibility === "municipality_required" && (
                      <em>{copy.chooseLocality}</em>
                    )}
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
                onRegion(active);
                onList(active);
              }}
            >
              {copy.viewAll}
              <HealthIcon name="arrow" size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="hi-map-caption">
        <span>
          <span className="hi-legend-dot" />
          {copy.mapHint}
        </span>
        <span>© swisstopo · OFSP · EuroGeographics / GISCO</span>
      </div>
    </div>
  );
}
