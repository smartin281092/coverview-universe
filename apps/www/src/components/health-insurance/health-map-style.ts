import type { MapOptions } from "maplibre-gl";

// The style of the 3D map (24 October 2026): OpenStreetMap ground (OpenFreeMap tiles) in
// light natural colours, the relief copied on the site, and the premium regions on top.
type MapStyle = Exclude<MapOptions["style"], string | null | undefined>;
type Layer = MapStyle["layers"][number];

const navy = "#354777";
type TextField = NonNullable<
  NonNullable<Extract<Layer, { type: "symbol" }>["layout"]>["text-field"]
>;
const french: TextField = ["coalesce", ["get", "name:fr"], ["get", "name"]];
const landcover = (id: string, classes: string[], color: string): Layer => ({
  id,
  type: "fill",
  source: "ground",
  "source-layer": "landcover",
  filter: ["match", ["get", "class"], classes, true, false],
  paint: { "fill-color": color, "fill-antialias": false },
});
// A width or offset growing from zoom 6 to zoom 10.
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
// One border rank: its shadow, then its white line; widths at zoom 6 and 10.
const border = (
  kind: string,
  shadow: number,
  [narrow, wide]: [number, number],
  [shadowNarrow, shadowWide]: [number, number],
): Layer[] => [
  {
    id: `${kind}-border-shadow`,
    type: "line",
    source: "borders",
    filter: ["==", ["get", "kind"], kind],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": navy,
      "line-opacity": shadow,
      "line-width": ["interpolate", ["linear"], ["zoom"], 6, shadowNarrow, 10, shadowWide],
    },
  },
  {
    id: `${kind}-border`,
    type: "line",
    source: "borders",
    filter: ["==", ["get", "kind"], kind],
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "#ffffff",
      "line-width": ["interpolate", ["linear"], ["zoom"], 6, narrow, 10, wide],
    },
  },
];
const label = (color: string) => ({
  "text-color": color,
  "text-halo-color": "rgba(255,255,255,0.9)",
  "text-halo-width": 1.4,
  "text-halo-blur": 0.4,
});

// The GeoJSON types MapLibre names are out of reach here (a global of @types/geojson that
// modules cannot see): the collections are passed as plain objects.
export function healthMapStyle(
  origin: string,
  areas: object,
  labels: object,
  borders: object,
): MapStyle {
  const relief = {
    type: "raster-dem" as const,
    url: `${origin}/terrain/v1/tiles.json`,
    encoding: "terrarium" as const,
    tileSize: 512,
  };
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      ground: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
      // Terrain and hillshade read the same tiles through two sources, as MapLibre advises.
      terrain: relief,
      hillshade: relief,
      areas: { type: "geojson", data: areas, promoteId: "id" },
      labels: { type: "geojson", data: labels },
      borders: { type: "geojson", data: borders },
    },
    terrain: { source: "terrain", exaggeration: 1.5 },
    sky: {
      "sky-color": "#dbe6f2",
      "horizon-color": "#eef2f6",
      "fog-color": "#f1f3f5",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.6,
      "atmosphere-blend": 0,
    },
    layers: [
      { id: "land", type: "background", paint: { "background-color": "#f2f1ea" } },
      landcover("farmland", ["farmland"], "#efede0"),
      landcover("grass", ["grass"], "#e1ead2"),
      landcover("wetland", ["wetland"], "#dce8da"),
      landcover("wood", ["wood"], "#c5dbae"),
      landcover("rock", ["rock"], "#e5e1d9"),
      landcover("sand", ["sand"], "#eee6cd"),
      landcover("ice", ["ice"], "#f9fbfd"),
      {
        id: "towns",
        type: "fill",
        source: "ground",
        "source-layer": "landuse",
        minzoom: 8,
        filter: [
          "match",
          ["get", "class"],
          ["residential", "suburb", "neighbourhood"],
          true,
          false,
        ],
        paint: { "fill-color": "#e7e1da", "fill-opacity": 0.7 },
      },
      {
        id: "water",
        type: "fill",
        source: "ground",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-color": "#a8cae8" },
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
          "line-color": "#a8cae8",
          "line-width": ["interpolate", ["linear"], ["zoom"], 7, 0.6, 11, 2],
        },
      },
      {
        id: "relief",
        type: "hillshade",
        source: "hillshade",
        paint: {
          "hillshade-method": "igor",
          "hillshade-exaggeration": 0.5,
          "hillshade-shadow-color": "#4b5566",
          "hillshade-highlight-color": "#ffffff",
          "hillshade-accent-color": "#7d8797",
        },
      },
      {
        id: "motorways",
        type: "line",
        source: "ground",
        "source-layer": "transportation",
        minzoom: 8,
        filter: ["all", ["==", ["get", "class"], "motorway"], ["!=", ["get", "brunnel"], "tunnel"]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#fbfaf7",
          "line-opacity": 0.85,
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.8, 11, 2.4],
        },
      },
      // Borders between the neighbours; Switzerland's own outline comes from the regions.
      {
        id: "borders",
        type: "line",
        source: "ground",
        "source-layer": "boundary",
        filter: [
          "all",
          ["==", ["get", "admin_level"], 2],
          ["!=", ["get", "maritime"], 1],
          ["!=", ["get", "adm0_l"], "CHE"],
          ["!=", ["get", "adm0_r"], "CHE"],
        ],
        layout: { "line-join": "round" },
        paint: { "line-color": "#a4abb8", "line-width": 1 },
      },
      // Regions under a very light veil, a little stronger on hover (user request, 23 October
      // 2026); the neighbours under a white veil, so that Switzerland stands out.
      {
        id: "areas-fill",
        type: "fill",
        source: "areas",
        paint: {
          "fill-color": ["case", ["==", ["get", "kind"], "country"], "#ffffff", navy],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.26,
            ["boolean", ["feature-state", "hover"], false],
            0.13,
            ["==", ["get", "kind"], "region"],
            0.05,
            0.18,
          ],
        },
      },
      {
        id: "areas-hover",
        type: "fill",
        source: "areas",
        filter: ["==", ["get", "kind"], "country"],
        paint: {
          "fill-color": navy,
          "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.1, 0],
        },
      },
      // Borders more visible (user request, 24 October 2026), each drawn once, by rank:
      // white over a navy shadow, from the regions of one canton to the national border.
      ...border("region", 0.12, [1, 2.2], [2.2, 4]),
      ...border("canton", 0.28, [1.6, 3], [3.4, 6]),
      // Switzerland raised above its neighbours (user request, 24 October 2026): a soft shadow
      // around a rounded outline, its cliff in one colour (the map stretched over it would
      // show streaks), and a white rim along its top edge. Offsets on a polygon: positive
      // inward.
      {
        id: "national-shadow",
        type: "line",
        source: "borders",
        filter: ["==", ["get", "kind"], "shadow"],
        layout: { "line-join": "round" },
        paint: {
          "line-color": navy,
          "line-opacity": 0.34,
          "line-width": byZoom(14, 26),
          "line-blur": byZoom(10, 18),
          "line-offset": byZoom(-7, -12),
        },
      },
      {
        id: "national-cliff",
        type: "line",
        source: "borders",
        filter: ["==", ["get", "kind"], "national"],
        layout: { "line-join": "round" },
        paint: { "line-color": "#66728d", "line-width": byZoom(6, 11) },
      },
      {
        id: "national-border",
        type: "line",
        source: "borders",
        filter: ["==", ["get", "kind"], "national"],
        layout: { "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": byZoom(2, 3.5),
          "line-offset": byZoom(3, 5.5),
        },
      },
      {
        id: "areas-outline",
        type: "line",
        source: "areas",
        layout: { "line-join": "round" },
        paint: {
          "line-color": navy,
          "line-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.9,
            ["boolean", ["feature-state", "hover"], false],
            0.45,
            0,
          ],
          "line-width": ["interpolate", ["linear"], ["zoom"], 6, 1.2, 10, 2.6],
        },
      },
      {
        id: "lakes",
        type: "symbol",
        source: "ground",
        "source-layer": "water_name",
        minzoom: 8,
        filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
        layout: {
          "text-field": french,
          "text-font": ["Noto Sans Italic"],
          "text-size": 11,
          "text-max-width": 6,
        },
        paint: label("#47699a"),
      },
      {
        id: "towns-label",
        type: "symbol",
        source: "ground",
        "source-layer": "place",
        minzoom: 8.2,
        filter: [
          "any",
          ["==", ["get", "class"], "city"],
          ["all", ["==", ["get", "class"], "town"], [">=", ["zoom"], 9.3]],
        ],
        layout: {
          "text-field": french,
          "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 11, 11, 13],
          "text-max-width": 8,
          "symbol-sort-key": ["get", "rank"],
        },
        paint: label("#3e4552"),
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
        paint: label("#5a6170"),
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
        paint: label("#8b919c"),
      },
    ],
  };
}
