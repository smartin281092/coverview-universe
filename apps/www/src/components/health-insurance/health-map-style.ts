import type { MapOptions } from "maplibre-gl";

// The style of the 3D map (24 October 2026): Switzerland alone keeps the OpenStreetMap
// ground (OpenFreeMap tiles) in light natural colours and its relief, raised on a dark blue
// cliff; around it, the neighbours are plain shapes on a plain background (user request:
// « enlève les pays autour (pas de reliefs rien juste une forme géométrique finalement
// basique de couleur uniforme légèrement espacé de la suisse) »).
type MapStyle = Exclude<MapOptions["style"], string | null | undefined>;
type Layer = MapStyle["layers"][number];

const navy = "#354777";
// The background, the fog and the sky, so that the horizon disappears.
const plain = "#f2f4f8";
const neighbour = { rest: "#d6dde8", hover: "#c2cddf", selected: "#adbbd3" };
const cliff = "#1e3a6e";
const zoneBorder = "#2f5bd3";
// West, south, east, north: no ground tile is needed beyond Switzerland.
const swissBounds: [number, number, number, number] = [5.9, 45.77, 10.55, 47.86];
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
// One rank of the zones' borders, in blue (user request, 24 October 2026).
const border = (kind: string, [atSix, atTen]: [number, number], opacity: number): Layer => ({
  id: `${kind}-border`,
  type: "line",
  source: "borders",
  filter: ["==", ["get", "kind"], kind],
  layout: { "line-join": "round", "line-cap": "round" },
  paint: { "line-color": zoneBorder, "line-opacity": opacity, "line-width": byZoom(atSix, atTen) },
});
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

// The GeoJSON types MapLibre names are out of reach here (a global of @types/geojson that
// modules cannot see): the collections and the outline are passed as plain objects.
export function healthMapStyle(
  origin: string,
  data: { areas: object; labels: object; borders: object; outside: object; inside: object },
): MapStyle {
  const relief = {
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
      // Terrain and hillshade read the same tiles through two sources, as MapLibre advises.
      terrain: relief,
      hillshade: relief,
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
      {
        id: "land",
        type: "fill",
        source: "borders",
        filter: ["==", ["get", "kind"], "national"],
        paint: { "fill-color": "#f2f1ea" },
      },
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
      // Around Switzerland, the ground tiles disappear under the plain background.
      { id: "outside", type: "fill", source: "outside", paint: { "fill-color": plain } },
      // Regions under a very light veil, a little stronger on hover (user request, 23 October
      // 2026); the neighbours in one plain colour, darker on hover and once chosen.
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
            0.26,
            state("hover"),
            0.13,
            0.05,
          ],
        },
      },
      border("region", [0.9, 1.8], 0.75),
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
          "line-opacity": ["case", state("selected"), 0.9, state("hover"), 0.45, 0],
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
        paint: label("#47699a"),
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
        paint: label("#7d879b"),
      },
    ],
  };
}
