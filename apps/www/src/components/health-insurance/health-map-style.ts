import type { MapOptions } from "maplibre-gl";

// The style of the 3D map (24 October 2026): Switzerland alone keeps its ground and its
// relief, raised above a plain background where the neighbours are plain shapes (user
// request: « enlève les pays autour (pas de reliefs rien juste une forme géométrique
// finalement basique de couleur uniforme légèrement espacé de la suisse) »). Three views of
// the ground, chosen under the zoom buttons: a plan in the manner of Google Maps
// (OpenStreetMap, OpenFreeMap tiles) by default, the swisstopo SWISSIMAGE aerial
// photographs, and low poly with its 3D firs, houses, buildings and towers (pixel art,
// added the same day, removed at the user's request).
type MapStyle = Exclude<MapOptions["style"], string | null | undefined>;
type Layer = MapStyle["layers"][number];
export type MapView = "plan" | "satellite" | "lowpoly";
export const mapViews: MapView[] = ["plan", "satellite", "lowpoly"];

const navy = "#354777";
// The background, the fog and the sky, so that the horizon disappears.
const plain = "#f2f4f8";
const neighbour = { rest: "#d6dde8", hover: "#b9c5d9", selected: "#adbbd3" };
// The raised Switzerland's wall, light and plain (« enlève ce contour bleu foncé au tour de
// la suisse »): without a colour, the map stretched over it shows streaks.
const wall = "#c9d2de";
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

// The plan's ground.
type Palette = {
  land: string;
  grass: string;
  wetland: string;
  wood: string;
  rock: string;
  sand: string;
  ice: string;
  towns: string;
  water: string;
  roads: [string, string];
  motorways: [string, string];
};
// In the manner of Google Maps: light land, green vegetation, blue water, white roads and
// yellow motorways.
const planPalette: Palette = {
  land: "#f1f0ec",
  grass: "#e1eed8",
  wetland: "#d8eada",
  wood: "#c8e3bc",
  rock: "#e8e6e1",
  sand: "#f3ead2",
  ice: "#ffffff",
  towns: "#e8e8eb",
  water: "#a6d1f7",
  roads: ["#ffffff", "#d9d6cf"],
  motorways: ["#fcd581", "#e3b04f"],
};
const ground = (palette: Palette): Layer[] => {
  const landcover = (name: string, classes: string[], color: string): Layer => ({
    id: `plan-${name}`,
    type: "fill",
    source: "ground",
    "source-layer": "landcover",
    filter: ["match", ["get", "class"], classes, true, false],
    paint: { "fill-color": color, "fill-antialias": false },
  });
  // One road class: its casing, then its fill; widths at zoom 7 and 11.
  const road = (
    name: string,
    classes: string[],
    minzoom: number,
    [fill, casing]: [string, string],
    [atSeven, atEleven]: [number, number],
  ): Layer[] =>
    [casing, fill].map((color, index): Layer => ({
      id: `plan-${name}-${index ? "fill" : "casing"}`,
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
  return [
    {
      id: "plan-land",
      type: "fill",
      source: "borders",
      filter: ["==", ["get", "kind"], "national"],
      paint: { "fill-color": palette.land },
    },
    landcover("grass", ["grass"], palette.grass),
    landcover("wetland", ["wetland"], palette.wetland),
    landcover("wood", ["wood"], palette.wood),
    landcover("rock", ["rock"], palette.rock),
    landcover("sand", ["sand"], palette.sand),
    landcover("ice", ["ice"], palette.ice),
    {
      id: "plan-towns",
      type: "fill",
      source: "ground",
      "source-layer": "landuse",
      minzoom: 8,
      filter: ["match", ["get", "class"], ["residential", "suburb", "neighbourhood"], true, false],
      paint: { "fill-color": palette.towns },
    },
    {
      id: "plan-water",
      type: "fill",
      source: "ground",
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": palette.water },
    },
    {
      id: "plan-rivers",
      type: "line",
      source: "ground",
      "source-layer": "waterway",
      minzoom: 7,
      filter: ["all", ["==", ["get", "class"], "river"], ["!=", ["get", "brunnel"], "tunnel"]],
      layout: { "line-cap": "round" },
      paint: {
        "line-color": palette.water,
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 11, 2],
      },
    },
    ...road("roads", ["trunk", "primary"], 8.5, palette.roads, [0.5, 2.2]),
    ...road("motorways", ["motorway"], 7, palette.motorways, [0.7, 3]),
  ];
};

// The layers of each view; the others are hidden, and MapLibre asks for no tile of a hidden
// layer (the aerial photographs load once chosen).
const views: Record<MapView, Layer[]> = {
  plan: [
    ...ground(planPalette),
    // Matte relief (« sans l'effet plastique qui fait des surbrillances trop fortes »):
    // shadows only, no highlight.
    {
      id: "plan-relief",
      type: "hillshade",
      source: "hillshade",
      paint: {
        "hillshade-method": "igor",
        "hillshade-exaggeration": 0.35,
        "hillshade-shadow-color": "#56606f",
        "hillshade-highlight-color": "rgba(255,255,255,0)",
        "hillshade-accent-color": "#7d8797",
      },
    },
  ],
  satellite: [{ id: "satellite", type: "raster", source: "satellite" }],
  lowpoly: [
    // Colours by height, in steps (each stop doubled 1 m apart): lowlands, hills, alpine
    // pastures, rock, snow. The relief is raised by 2500 m inside Switzerland.
    {
      id: "lowpoly-colors",
      type: "color-relief",
      source: "lowpoly",
      paint: {
        "color-relief-color": [
          "interpolate",
          ["linear"],
          ["elevation"],
          3099,
          "#8fc86c",
          3100,
          "#a9cf6f",
          3599,
          "#a9cf6f",
          3600,
          "#c6c97c",
          4099,
          "#c6c97c",
          4100,
          "#bfae8f",
          4699,
          "#bfae8f",
          4700,
          "#d6d0c8",
          5399,
          "#d6d0c8",
          5400,
          "#f7f9fc",
        ],
      },
    },
    {
      id: "lowpoly-wood",
      type: "fill",
      source: "ground",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": "#5c9e49", "fill-opacity": 0.35 },
    },
    {
      id: "lowpoly-water",
      type: "fill",
      source: "ground",
      "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": "#6fb3ea" },
    },
    // The facets of the low poly relief, each in one tone.
    {
      id: "lowpoly-relief",
      type: "hillshade",
      source: "lowpoly",
      paint: {
        "hillshade-method": "standard",
        "hillshade-exaggeration": 0.7,
        "hillshade-shadow-color": "#2b3542",
        "hillshade-highlight-color": "rgba(255,255,255,0.45)",
        "hillshade-accent-color": "#566170",
      },
    },
  ],
};
export const viewLayers: Record<MapView, string[]> = {
  plan: views.plan.map((layer) => layer.id),
  satellite: views.satellite.map((layer) => layer.id),
  lowpoly: views.lowpoly.map((layer) => layer.id),
};
// The relief's height, as drawn: the low poly objects stand on it.
export const exaggeration = 1.5;
// The low poly view's 3D objects, drawn by three.js (health-map-objects.ts), loaded with it.
export const objectsLayerId = "lowpoly-objects";
// The relief the 3D surface follows in each view.
export const viewTerrain = (view: MapView) => (view === "lowpoly" ? "terrain-lowpoly" : "terrain");
// The lines' widths, from zoom 6 to zoom 10.
const lines = {
  region: byZoom(0.9, 1.8),
  canton: byZoom(1.4, 2.6),
  wall: byZoom(3, 5),
  outline: byZoom(1.2, 2.6),
};
const shown = (view: MapView, own: MapView, layers: Layer[]) =>
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
  const dem = (path: string) => ({
    type: "raster-dem" as const,
    url: `${origin}/terrain/${path}/tiles.json`,
    encoding: "terrarium" as const,
    tileSize: 512,
  });
  const swiss: ["within", object] = ["within", data.inside];
  const border = (kind: "region" | "canton", width: ReturnType<typeof byZoom>): Layer => ({
    id: `${kind}-border`,
    type: "line",
    source: "borders",
    filter: ["==", ["get", "kind"], kind],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": zoneBorder,
      "line-opacity": kind === "region" ? 0.85 : 1,
      "line-width": width,
    },
  });
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      ground: {
        type: "vector",
        url: "https://tiles.openfreemap.org/planet",
        bounds: swissBounds,
      },
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
      terrain: dem("v1"),
      hillshade: dem("v1"),
      "terrain-lowpoly": dem("lowpoly-v1"),
      lowpoly: dem("lowpoly-v1"),
      areas: { type: "geojson", data: data.areas, promoteId: "id" },
      labels: { type: "geojson", data: data.labels },
      borders: { type: "geojson", data: data.borders },
      outside: { type: "geojson", data: data.outside },
    },
    terrain: { source: viewTerrain(view), exaggeration },
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
      ...mapViews.flatMap((own) => shown(view, own, views[own])),
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
      border("region", lines.region),
      border("canton", lines.canton),
      // The band covers the raised Switzerland's wall, where the map would otherwise be
      // stretched into streaks.
      {
        id: "national-wall",
        type: "line",
        source: "borders",
        filter: ["==", ["get", "kind"], "national"],
        layout: { "line-join": "round" },
        paint: { "line-color": wall, "line-width": lines.wall },
      },
      {
        id: "areas-outline",
        type: "line",
        source: "areas",
        layout: { "line-join": "round" },
        paint: {
          "line-color": navy,
          "line-opacity": ["case", state("selected"), 0.9, state("hover"), 0.6, 0],
          "line-width": lines.outline,
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
