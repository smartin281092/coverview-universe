import { useEffect, useRef, useState } from "react";
import { Map as MapLibre, setWorkerUrl, type LngLatLike } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type {
  HealthComparison,
  HealthOffer,
  HealthPremiumDifference as Difference,
} from "@coverview/api-client/health-insurance";
import geo from "../../../../../data/health-insurance/2027/regions-geo.json";
import { healthCopy as copy } from "../../content/fr/health-insurance";
import { HealthRegionPopover } from "./HealthRegionPopover";
import { HealthSelect } from "./HealthSelect";
import { HealthIcon } from "./HealthIcon";
import {
  exaggeration,
  healthMapStyle,
  mapViews,
  objectsLayerId,
  viewLayers,
  viewTerrain,
  type MapView,
} from "./health-map-style";
import { regionName } from "./health-format";

setWorkerUrl(workerUrl);

const anchors = new Map(
  Object.entries(geo.anchors).map(([id, [lng = 0, lat = 0]]) => [
    id,
    [lng, lat] as [number, number],
  ]),
);
const areaIds = geo.areas.features.map((feature) => feature.properties.id);
const vaudPoints = [...anchors].filter(([id]) => id.startsWith("VD-")).map(([, point]) => point);
const vaud: [number, number] = [
  vaudPoints.reduce((sum, point) => sum + point[0], 0) / vaudPoints.length,
  vaudPoints.reduce((sum, point) => sum + point[1], 0) / vaudPoints.length,
];
const swissDegrees = (geo.switzerland[1]?.[0] ?? 10.5) - (geo.switzerland[0]?.[0] ?? 5.96);
// Tilted everywhere (« 3D partout », 24 October 2026).
const pitch = 45;
// Small screens start much closer (12 October 2026): the whole country is unreadable there.
const startScale = (width: number) => (width < 520 ? 2.5 : width < 900 ? 1.6 : 1);
// The SVG map's scale: Switzerland is 952 of its 1320 x 850 frame units, fitted in the stage.
const zoomFor = (width: number, height: number, scale: number) =>
  Math.log2((952 * Math.min(width / 1320, height / 850) * scale * 360) / (swissDegrees * 512));
const camera = (width: number, height: number, regionId: string | null) => ({
  center: ((regionId && anchors.get(regionId)) || vaud) as LngLatLike,
  zoom: zoomFor(width, height, startScale(width)),
  pitch,
  bearing: 0,
});
// Switzerland's outline: only its ground keeps labels.
const national = geo.borders.features.find((feature) => feature.properties.kind === "national");
if (!national) throw new Error("regions-geo.json: Switzerland's outline is missing");
const inside: object = national.geometry;
// The chosen view, kept in this browser only (24 October 2026); low poly until one is chosen
// (user request, same day: « Faire que la carte par défaut est la lowpoly »).
const viewKey = "cv-map-view";
const defaultView: MapView = "lowpoly";
const storedView = (): MapView => {
  try {
    const stored = localStorage.getItem(viewKey);
    return mapViews.find((view) => view === stored) ?? defaultView;
  } catch {
    return defaultView;
  }
};
// Each view as an icon (user request, 24 October 2026: « Remplace les termes Satellite,
// Lowpoly et Plan par des icones »), its name kept for screen readers.
const viewIcons = { plan: "map", satellite: "satellite", lowpoly: "lowpoly" } as const;
// Country names for the neighbours' labels, in French.
const countries = new Intl.DisplayNames(["fr-CH"], { type: "region" });
const labels = {
  ...geo.labels,
  features: geo.labels.features.map((feature) =>
    "country" in feature.properties
      ? {
          ...feature,
          properties: { ...feature.properties, text: countries.of(feature.properties.country) },
        }
      : feature,
  ),
};

export function SwissPremiumMap3D({
  comparison,
  selected,
  localityId,
  onRegion,
  onOffer,
  onList,
  loading,
  differences,
  onUnavailable,
}: {
  comparison: HealthComparison | null;
  selected: string;
  localityId: string | undefined;
  onRegion: (id: string) => void;
  onOffer: (offer: HealthOffer) => void;
  onList: (id: string) => void;
  loading: boolean;
  differences: Map<string, Difference>;
  onUnavailable: () => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [entry, setEntry] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [limits, setLimits] = useState({ min: false, max: false });
  const [view, setView] = useState<MapView>(storedView);
  const [size, setSize] = useState({ width: 1000, height: 650, left: 0, viewport: 1000 });
  const stage = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibre | null>(null);
  const loaded = useRef(false);
  // The low poly view's 3D objects: three.js and their file load once that view is shown,
  // and leave the map with it.
  const shownView = useRef(view);
  const showObjects = async (instance: MapLibre, next: MapView) => {
    if (next !== "lowpoly") {
      if (instance.getLayer(objectsLayerId)) instance.removeLayer(objectsLayerId);
      return;
    }
    const objects = await import("./health-map-objects").catch(() => null);
    // Without three.js, the low poly view stays usable, without objects; the view may also
    // have changed, or the map left the page, while it loaded.
    if (
      !objects ||
      shownView.current !== "lowpoly" ||
      map.current !== instance ||
      instance.getLayer(objectsLayerId)
    )
      return;
    instance.addLayer(
      objects.objectsLayer(instance, `${window.location.origin}/map/objects-v1.json`, exaggeration),
      "lakes",
    );
  };
  // Once the person zooms or pans, a change of width no longer resets their view.
  const touched = useRef(false);
  // The latest props for the map's own event handlers, registered once.
  const latest = useRef({ selected, localityId, onRegion, onList });
  latest.current = { selected, localityId, onRegion, onList };
  // The area under a point of the stage, once the regions are on the map.
  const hit = (x: number, y: number) => {
    if (!loaded.current) return null;
    const features = map.current?.queryRenderedFeatures([x, y], { layers: ["areas-fill"] });
    const id: unknown = features?.[0]?.properties?.id;
    return typeof id === "string" ? id : null;
  };
  const choose = (id: string) => {
    latest.current.onRegion(id);
    latest.current.onList(id);
    setHover(null);
  };

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const current = latest.current;
    let instance: MapLibre;
    try {
      instance = new MapLibre({
        container: element,
        style: healthMapStyle(window.location.origin, view, {
          areas: geo.areas,
          labels,
          borders: geo.borders,
          outside: geo.outside,
          inside,
        }),
        ...camera(box.width, box.height, current.localityId ? current.selected : null),
        minZoom: zoomFor(box.width, box.height, 1) - 0.3,
        maxZoom: 10,
        maxPitch: 60,
        maxBounds: [
          [3.9, 44.8],
          [12.7, 49],
        ],
        attributionControl: false,
        // A click chooses a region; a double click would also zoom behind the opened list.
        doubleClickZoom: false,
        trackResize: false,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
        locale: { "Map.Title": copy.mapCanvas },
      });
    } catch {
      // MapLibre needs WebGL2: the SVG map takes over.
      onUnavailable();
      return;
    }
    // Rotation stays on the mouse (right button); two fingers zoom and tilt without turning.
    instance.touchZoomRotate.disableRotation();
    map.current = instance;
    const limit = () =>
      setLimits({
        min: instance.getZoom() <= instance.getMinZoom() + 0.01,
        max: instance.getZoom() >= instance.getMaxZoom() - 0.01,
      });
    instance.on("load", () => {
      loaded.current = true;
      setReady(true);
      limit();
      void showObjects(instance, shownView.current);
    });
    instance.on("zoomend", limit);
    instance.on("movestart", (event) => {
      if (!event.originalEvent) return;
      touched.current = true;
      setHover(null);
    });
    instance.on("click", (event) => {
      const id = hit(event.point.x, event.point.y);
      if (id) choose(id);
    });
    return () => {
      map.current = null;
      loaded.current = false;
      instance.remove();
    };
  }, []);

  // The stage's size, for the floating card and the map; the starting view follows a change
  // of screen class until the person moves the map.
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    let scale = 0;
    const measure = () => {
      const box = element.getBoundingClientRect();
      setSize({
        width: box.width,
        height: box.height,
        left: box.left,
        viewport: document.documentElement.clientWidth,
      });
      const instance = map.current;
      if (!instance) return;
      instance.resize();
      instance.setMinZoom(zoomFor(box.width, box.height, 1) - 0.3);
      const next = startScale(box.width);
      if (scale && next !== scale && !touched.current) {
        const { selected, localityId } = latest.current;
        instance.jumpTo(camera(box.width, box.height, localityId ? selected : null));
      }
      scale = next;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A new locality: its region, centred.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const instance = map.current;
    setHover(null);
    touched.current = false;
    if (instance) instance.flyTo(camera(size.width, size.height, localityId ? selected : null));
  }, [localityId]);

  // Hover and selection as feature states, which the style turns into opacity.
  const states = useRef<{ hover: string | null; selected: string | null }>({
    hover: null,
    selected: null,
  });
  const mark = (key: "hover" | "selected", id: string | null) => {
    const instance = map.current;
    const previous = states.current[key];
    if (!instance || !ready || previous === id) return;
    if (previous && areaIds.includes(previous))
      instance.setFeatureState({ source: "areas", id: previous }, { [key]: false });
    if (id && areaIds.includes(id))
      instance.setFeatureState({ source: "areas", id }, { [key]: true });
    states.current[key] = id;
  };
  useEffect(() => mark("hover", hover), [hover, ready]);
  useEffect(() => mark("selected", selected), [selected, ready]);
  useEffect(() => {
    const canvas = map.current?.getCanvas();
    if (canvas) canvas.style.cursor = hover ? "pointer" : "";
  }, [hover]);

  // Plan, aerial photographs or low poly (user requests, 24 October 2026), the relief kept:
  // the ground's layers change through their visibility, the low poly view follows its own
  // faceted relief.
  const switchView = (value: string) => {
    const next = mapViews.find((own) => own === value);
    if (!next || next === view) return;
    setView(next);
    shownView.current = next;
    try {
      localStorage.setItem(viewKey, next);
    } catch {
      // Kept for this visit only.
    }
    const instance = map.current;
    if (!instance) return;
    for (const [own, ids] of Object.entries(viewLayers))
      for (const id of ids)
        instance.setLayoutProperty(id, "visibility", own === next ? "visible" : "none");
    instance.setTerrain({ source: viewTerrain(next), exaggeration });
    void showObjects(instance, next);
  };

  // Keyboard focus: the area's label point, brought into view first if needed.
  const focus = (id: string) => {
    const instance = map.current;
    const point = anchors.get(id);
    if (!instance || !point) return;
    let projected = instance.project(point);
    if (
      projected.x < 0 ||
      projected.y < 0 ||
      projected.x > size.width ||
      projected.y > size.height
    ) {
      instance.jumpTo({ center: point });
      projected = instance.project(point);
    }
    setEntry({ x: projected.x, y: projected.y });
    setHover(id);
  };

  return (
    <div
      className="hi-map-wrap"
      onPointerMove={(event) => {
        if (event.pointerType === "touch" || event.buttons || !ready) return;
        // Over the floating card too: what counts is the map under the pointer.
        const target = event.target as Element;
        const box = stage.current?.getBoundingClientRect();
        if (!box || !target.closest(".maplibregl-canvas-container, .hi-region-popover")) {
          setHover(null);
          return;
        }
        const x = event.clientX - box.left;
        const y = event.clientY - box.top;
        const id = hit(x, y);
        if (id) setEntry({ x, y });
        setHover(id);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") setHover(null);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHover(null);
      }}
    >
      <div ref={stage} className="hi-map-stage">
        <div ref={container} className="hi-map hi-map-3d" />
        <div className="hi-map-keys" role="group" aria-label={copy.mapLabel}>
          {areaIds.map((id) => (
            <button
              key={id}
              type="button"
              className="hi-sr-only"
              aria-pressed={id === selected}
              onFocus={() => focus(id)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setHover(null);
              }}
              onClick={() => choose(id)}
            >
              {regionName(id)}
            </button>
          ))}
        </div>
        <div className="hi-map-controls" aria-label={copy.mapControls}>
          <button
            onClick={() => map.current?.zoomIn()}
            disabled={limits.max}
            aria-label={copy.mapZoomIn}
          >
            +
          </button>
          <button
            onClick={() => map.current?.zoomOut()}
            disabled={limits.min}
            aria-label={copy.mapZoomOut}
          >
            −
          </button>
          <button
            onClick={() => {
              touched.current = false;
              setHover(null);
              map.current?.flyTo(camera(size.width, size.height, null));
            }}
            aria-label={copy.mapReset}
          >
            ⌖
          </button>
        </div>
        <div className="hi-map-view">
          <HealthSelect
            label={copy.mapView}
            value={view}
            onChange={switchView}
            disabled={!ready}
            options={mapViews.map((value) => ({
              value,
              label: copy.mapViews[value],
              icon: <HealthIcon name={viewIcons[value]} size={20} />,
            }))}
          />
        </div>
        {hover && (
          <HealthRegionPopover
            region={hover}
            anchor={entry}
            stage={size}
            comparison={comparison}
            loading={loading}
            differences={differences}
            onOffer={onOffer}
            onRegion={onRegion}
            onList={onList}
          />
        )}
      </div>
      <div className="hi-map-caption">
        <span>
          <span className="hi-legend-dot" />
          {copy.mapHint}
        </span>
        <span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
            © OpenStreetMap
          </a>{" "}
          ·{" "}
          <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">
            © OpenMapTiles
          </a>{" "}
          ·{" "}
          <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">
            OpenFreeMap
          </a>{" "}
          ·{" "}
          <a href="https://mapterhorn.com/attribution" target="_blank" rel="noreferrer">
            {copy.mapRelief} © Mapterhorn
          </a>{" "}
          · © swisstopo · OFSP · EuroGeographics / GISCO
        </span>
      </div>
    </div>
  );
}
