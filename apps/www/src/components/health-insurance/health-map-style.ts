import type { MapOptions } from "maplibre-gl";

// The style of the 3D map (24 October 2026): Switzerland alone keeps its ground and its
// relief, raised on a dark blue cliff; around it, the neighbours are plain shapes on a
// plain background (user request: « enlève les pays autour (pas de reliefs rien juste une
// forme géométrique finalement basique de couleur uniforme légèrement espacé de la
// suisse) »). Two views of the ground, chosen under the zoom buttons: a plan in the manner
// of Google Maps (OpenStreetMap, OpenFreeMap tiles) by default, or the swisstopo
// SWISSIMAGE aerial photographs, both with a matte relief.
type MapStyle = Exclude<MapOptions["style"], string | null | undefined>;
type Layer = MapStyle["layers"][number];
export type MapView = "plan" | "satellite";

const navy = "#354777";
// The background, the fog and the sky, so that the horizon disappears.
const plain = "#f2f4f8";
const neighbour = { rest: "#d6dde8", hover: "#b9c5d9", selected: "#adbbd3" };
const cliff = "#1e3a6e";
// Sky blue (user request, 24 October 2026: « séparations des zones en bleu ciel »).
const zoneBorder = "#3cb4f2";
// West, south, east, north: no ground tile is needed beyond Switzerland.
const swissBounds: [number, number, number, number] = [5.9, 45.77, 10.55, 47.86];
type TextField = NonNullable<
  NonNullable<Extract<Layer, { type: "symbol" }>["layout"]>["text-field"]
>;
const french: TextField = ["coalesce", ["get", "name:fr"], ["get", "name"]];
// A width growing from zoom 6 to zoom 10.
const byZoom = (atSix: number, atTen: number) =>
  ["interpolate", ["linear"], ["zoom"], 6, atSix, 10, atTen] as [
    "interpolate",
    ["linear"],
    ["zoom"],
    number,
    number,
    number,
    number,
  ];
const label = (color: string) => ({
  "text-color": color,
  "text-halo-color": "rgba(255,255,255,0.9)",
  "text-halo-width": 1.4,
  "text-halo-blur": 0.4,
});
const state = (key: "hover" | "selected"): ["boolean", ["feature-state", string], boolean] => [
  "boolean",
  ["feature-state", key],
  false,
];
const landcover = (id: string, classes: string[], color: string): Layer => ({
  id,
  type: "fill",
  source: "ground",
  "source-layer": "landcover",
  filter: ["match", ["get", "class"], classes, true, false],
  paint: { "fill-color": color, "fill-antialias": false },
});
// One road class: its casing, then its fill; widths at zoom 7 and 11.
const road = (
  id: string,
  classes: string[],
  minzoom: number,
  [fill, casing]: [string, string],
  [atSeven, atEleven]: [number, number],
): Layer[] =>
  [casing, fill].map((color, index): Layer => ({
    id: `${id}-${index ? "fill" : "casing"}`,
    type: "line",
    source: "ground",
    "source-layer": "transportation",
    minzoom,
    filter: [
      "all",
      ["match", ["get", "class"], classes, true, false],
      ["!=", ["get", "brunnel"], "tunnel"],
    ],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": color,
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        7,
        index ? atSeven : atSeven + 1,
        11,
        index ? atEleven : atEleven + 1.6,
      ],
    },
  }));
// One rank of the zones' borders.
const border = (kind: string, [atSix, atTen]: [number, number], opacity: number): Layer => ({
  id: `${kind}-border`,
  type: "line",
  source: "borders",
  filter: ["==", ["get", "kind"], kind],
  layout: { "line-join": "round", "line-cap": "round" },
  paint: { "line-color": zoneBorder, "line-opacity": opacity, "line-width": byZoom(atSix, atTen) },
});

// The plan's own layers, in the manner of Google Maps: light land, green vegetation, blue
// water, white roads and yellow motorways.
const planLayers: Layer[] = [
  {
    id: "land",
    type: "fill",
    source: "borders",
    filter: ["==", ["get", "kind"], "national"],
    paint: { "fill-color": "#f1f0ec" },
  },
  landcover("grass", ["grass"], "#e1eed8"),
  landcover("wetland", ["wetland"], "#d8eada"),
  landcover("wood", ["wood"], "#c8e3bc"),
  landcover("rock", ["rock"], "#e8e6e1"),
  landcover("sand", ["sand"], "#f3ead2"),
  landcover("ice", ["ice"], "#ffffff"),
  {
    id: "towns",
    type: "fill",
    source: "ground",
    "source-layer": "landuse",
    minzoom: 8,
    filter: ["match", ["get", "class"], ["residential", "suburb", "neighbourhood"], true, false],
    paint: { "fill-color": "#e8e8eb" },
  },
  {
    id: "water",
    type: "fill",
    source: "ground",
    "source-layer": "water",
    filter: ["!=", ["get", "brunnel"], "tunnel"],
    paint: { "fill-color": "#a6d1f7" },
  },
  {
    id: "rivers",
    type: "line",
    source: "ground",
    "source-layer": "waterway",
    minzoom: 7,
    filter: ["all", ["==", ["get", "class"], "river"], ["!=", ["get", "brunnel"], "tunnel"]],
    layout: { "line-cap": "round" },
    paint: {
      "line-color": "#a6d1f7",
      "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 11, 2],
    },
  },
  ...road("roads", ["trunk", "primary"], 8.5, ["#ffffff", "#d9d6cf"], [0.5, 2.2]),
  ...road("motorways", ["motorway"], 7, ["#fcd581", "#e3b04f"], [0.7, 3]),
];
// Matte relief (user request, 24 October 2026: « sans l'effet plastique qui fait des
// surbrillances trop fortes »): shadows only, no highlight.
const relief: Layer = {
  id: "relief",
  type: "hillshade",
  source: "hillshade",
  paint: {
    "hillshade-method": "igor",
    "hillshade-exaggeration": 0.35,
    "hillshade-shadow-color": "#56606f",
    "hillshade-highlight-color": "rgba(255,255,255,0)",
    "hillshade-accent-color": "#7d8797",
  },
};
const satelliteLayers: Layer[] = [{ id: "satellite", type: "raster", source: "satellite" }];
// The layers each view shows; the toggle switches their visibility.
export const viewLayers: Record<MapView, string[]> = {
  plan: [...planLayers.map((layer) => layer.id), relief.id],
  satellite: satelliteLayers.map((layer) => layer.id),
};
const shown = (view: MapView, layers: Layer[], own: MapView) =>
  layers.map((layer) => ({
    ...layer,
    layout: { ...layer.layout, visibility: view === own ? "visible" : "none" },
  })) as Layer[];

// The GeoJSON types MapLibre names are out of reach here (a global of @types/geojson that
// modules cannot see): the collections and the outline are passed as plain objects.
export function healthMapStyle(
  origin: string,
  view: MapView,
  data: { areas: object; labels: object; borders: object; outside: object; inside: object },
): MapStyle {
  const dem = {
    type: "raster-dem" as const,
    url: `${origin}/terrain/v1/tiles.json`,
    encoding: "terrarium" as const,
    tileSize: 512,
  };
  const swiss: ["within", object] = ["within", data.inside];
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      ground: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        bounds: swissBounds,
      },
      // Loaded only in the satellite view: MapLibre asks for no tile of a hidden layer.
      satellite: {
        type: "raster",
        tiles: [
          "https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg",
        ],
        tileSize: 256,
        maxzoom: 20,
        bounds: swissBounds,
      },
      // Terrain and hillshade read the same tiles through two sources, as MapLibre advises.
      terrain: dem,
      hillshade: dem,
      areas: { type: "geojson", data: data.areas, promoteId: "id" },
      labels: { type: "geojson", data: data.labels },
      borders: { type: "geojson", data: data.borders },
      outside: { type: "geojson", data: data.outside },
    },
    terrain: { source: "terrain", exaggeration: 1.5 },
    sky: {
      "sky-color": plain,
      "horizon-color": plain,
      "fog-color": plain,
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.6,
      "atmosphere-blend": 0,
    },
    layers: [
      { id: "plain", type: "background", paint: { "background-color": plain } },
      ...shown(view, planLayers, "plan"),
      ...shown(view, satelliteLayers, "satellite"),
      ...shown(view, [relief], "plan"),
      // Around Switzerland, the ground disappears under the plain background.
      { id: "outside", type: "fill", source: "outside", paint: { "fill-color": plain } },
      // Regions under a very light veil, clearly stronger on hover (user requests, 23 and
      // 24 October 2026); the neighbours in one plain colour, darker on hover and once chosen.
      {
        id: "areas-fill",
        type: "fill",
        source: "areas",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "kind"], "country"],
            [
              "case",
              state("selected"),
              neighbour.selected,
              state("hover"),
              neighbour.hover,
              neighbour.rest,
            ],
            navy,
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "kind"], "country"],
            1,
            state("selected"),
            0.4,
            state("hover"),
            0.32,
            0.05,
          ],
        },
      },
      border("region", [0.9, 1.8], 0.85),
      border("canton", [1.4, 2.6], 1),
      // The raised Switzerland's cliff, one dark blue (user request, 24 October 2026): the
      // band covers the wall, where the map would otherwise be stretched into streaks.
      {
        id: "national-cliff",
        type: "line",
        source: "borders",
        filter: ["==", ["get", "kind"], "national"],
        layout: { "line-join": "round" },
        paint: { "line-color": cliff, "line-width": byZoom(6, 11) },
      },
      {
        id: "areas-outline",
        type: "line",
        source: "areas",
        layout: { "line-join": "round" },
        paint: {
          "line-color": navy,
          "line-opacity": ["case", state("selected"), 0.9, state("hover"), 0.6, 0],
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.2, 10, 2.6],
        },
      },
      {
        id: "lakes",
        type: "symbol",
        source: "ground",
        "source-layer": "water_name",
        minzoom: 8,
        filter: ["all", ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false], swiss],
        layout: {
          "text-field": french,
          "text-font": ["Noto Sans Italic"],
          "text-size": 11,
          "text-max-width": 6,
        },
        paint: label("#3f6aa4"),
      },
      {
        id: "towns-label",
        type: "symbol",
        source: "ground",
        "source-layer": "place",
        minzoom: 8.2,
        filter: [
          "all",
          swiss,
          [
            "any",
            ["==", ["get", "class"], "city"],
            ["all", ["==", ["get", "class"], "town"], [">=", ["zoom"], 9.3]],
          ],
        ],
        layout: {
          "text-field": french,
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 11, 13],
          "text-max-width": 8,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: label("#3c4043"),
      },
      {
        id: "areas-label",
        type: "symbol",
        source: "labels",
        maxzoom: 8.4,
        filter: ["==", ["get", "kind"], "region"],
        layout: {
          "text-field": ["get", "text"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 10,
          "text-letter-spacing": 0.08,
          "text-allow-overlap": true,
        },
        paint: label("#4f5666"),
      },
      {
        id: "countries-label",
        type: "symbol",
        source: "labels",
        filter: ["==", ["get", "kind"], "country"],
        layout: {
          "text-field": ["get", "text"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 15,
          "text-letter-spacing": 0.14,
        },
        paint: label("#7d879b"),
      },
    ],
  };
}
