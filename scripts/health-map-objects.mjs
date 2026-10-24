// The low poly view's 3D objects (user requests, 24 October 2026: « des arbres low poly pour
// les zones boisées », then « Ajoute des maisons et immeubles en vrai 3D low poly dans les
// zones rurales et villes. Fait les arbres en vrai 3D aussi low poly »), placed once here
// from OpenStreetMap as the map draws it at Switzerland's scale (OpenFreeMap tiles of zoom 8,
// 12 tiles, cached in the OS temporary directory), inside Switzerland only:
// - firs: one per cell of a 1.5 km grid whose centre lies in the woods;
// - towers in the cities, a spiral around the city's point, more for a bigger city;
// - buildings around the cities' towers and in the towns;
// - houses in the villages and on the same grid in the inhabited areas, away from them.
// Each object carries the coarsest grid level it belongs to (0 from afar, 1 from zoom 8,
// 2 from zoom 9), its size, its orientation and its elevation on the low poly relief
// (public/terrain/lowpoly-v1, zoom 9, raised as the map shows it). Computed once here: read
// in the browser, the woods' outlines took 100 to 200 ms after each move. Data
// © OpenStreetMap contributors (ODbL): the file is a derived database under the same
// licence. Decoders: MapLibre's own @mapbox/vector-tile and pbf, and sharp for the relief.
//   node scripts/health-map-objects.mjs
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// From MapLibre's real folder: pnpm keeps its dependencies beside it.
const maplibre = createRequire(
  realpathSync(join(root, "apps/www/node_modules/maplibre-gl/package.json")),
);
const { VectorTile } = await import(pathToFileURL(maplibre.resolve("@mapbox/vector-tile")).href);
const { PbfReader } = await import(pathToFileURL(maplibre.resolve("pbf")).href);
const sharp = createRequire(join(root, "apps/www/package.json"))("sharp");
const output = join(root, "apps/www/public/map/objects-v1.json");
const relief = join(root, "apps/www/public/terrain/lowpoly-v1");
const cache = join(tmpdir(), "coverview-map-cache");
const agent = { "user-agent": "CoverView map build (+https://coverview.ch)" };
// West, south, east, north: Switzerland and a small margin, as the map's other layers.
const bounds = [5.9, 45.77, 10.55, 47.86];
const zoom = 8;
const spacing = 1.5;
const kmPerDegree = { lat: 111.2, lon: 111.32 * Math.cos((46.8 * Math.PI) / 180) };
const step = { lat: spacing / kmPerDegree.lat, lon: spacing / kmPerDegree.lon };
const switzerland = JSON.parse(
  readFileSync(join(root, "data/health-insurance/2027/regions-geo.json"), "utf8"),
).borders.features.find((feature) => feature.properties.kind === "national").geometry.coordinates;

const tilejson = await (
  await fetch("https://tiles.openfreemap.org/planet", {
    headers: agent,
    signal: AbortSignal.timeout(30_000),
  })
).json();
const template = tilejson.tiles[0];
const column = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const row = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const tiles = [];
for (let x = column(bounds[0], zoom); x <= column(bounds[2], zoom); x++)
  for (let y = row(bounds[3], zoom); y <= row(bounds[1], zoom); y++) tiles.push([x, y]);

const fetchTile = async ([x, y]) => {
  const file = join(cache, template.split("/").at(-4), String(zoom), String(x), `${y}.pbf`);
  if (!existsSync(file)) {
    const url = template.replace("{z}", zoom).replace("{x}", x).replace("{y}", y);
    const response = await fetch(url, { headers: agent, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  const body = readFileSync(file);
  return body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body;
};

// Woods, inhabited areas and water as polygons in degrees; places as points.
const woods = [];
const inhabited = [];
const water = [];
const places = [];
const polygonsOf = (geometry) =>
  geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
for (const [x, y] of tiles) {
  const { layers } = new VectorTile(new PbfReader(await fetchTile([x, y])));
  const each = (layer, visit) => {
    for (let index = 0; index < (layer?.length ?? 0); index++) {
      const feature = layer.feature(index);
      visit(feature.properties, feature.toGeoJSON(x, y, zoom).geometry);
    }
  };
  each(layers.landcover, (properties, geometry) => {
    if (properties.class === "wood") woods.push(...polygonsOf(geometry));
  });
  each(layers.landuse, (properties, geometry) => {
    if (["residential", "suburb", "quarter", "neighbourhood"].includes(properties.class))
      inhabited.push(...polygonsOf(geometry));
  });
  each(layers.water, (properties, geometry) => {
    if (properties.brunnel !== "tunnel") water.push(...polygonsOf(geometry));
  });
  each(layers.place, (properties, geometry) => {
    if (["city", "town", "village"].includes(properties.class) && geometry.type === "Point")
      places.push({ kind: properties.class, rank: properties.rank, at: geometry.coordinates });
  });
}

// Longitudes where each grid row (cell centres) crosses the polygons' edges, by row index:
// inside between pairs of sorted crossings.
const crossings = (polygons) => {
  const rows = new Map();
  for (const polygon of polygons)
    for (const ring of polygon)
      for (let k = 0; k + 1 < ring.length; k++) {
        const [[ax, ay], [bx, by]] = [ring[k], ring[k + 1]];
        const first = Math.ceil((Math.min(ay, by) - bounds[1]) / step.lat - 0.5);
        const last = Math.floor((Math.max(ay, by) - bounds[1]) / step.lat - 0.5);
        for (let j = first; j <= last; j++) {
          const lat = bounds[1] + (j + 0.5) * step.lat;
          if (ay > lat === by > lat) continue;
          const xs = rows.get(j) ?? [];
          xs.push(ax + ((lat - ay) / (by - ay)) * (bx - ax));
          rows.set(j, xs);
        }
      }
  for (const xs of rows.values()) xs.sort((p, q) => p - q);
  return rows;
};
// The grid cells inside the polygons, each polygon on its own, so that areas cut at tile
// edges never cancel each other out.
const cellsIn = (polygons) => {
  const cells = new Set();
  for (const polygon of polygons)
    for (const [j, xs] of crossings([polygon]))
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.ceil((xs[k] - bounds[0]) / step.lon - 0.5);
        const to = Math.floor((xs[k + 1] - bounds[0]) / step.lon - 0.5);
        for (let i = from; i <= to; i++) cells.add(`${i},${j}`);
      }
  return [...cells].sort().map((key) => key.split(",").map(Number));
};
// Even-odd test of one point against polygons.
const within = (polygons, [lon, lat]) => {
  let inside = false;
  for (const polygon of polygons)
    for (const ring of polygon)
      for (let k = 0, l = ring.length - 1; k < ring.length; l = k++) {
        const [[ax, ay], [bx, by]] = [ring[k], ring[l]];
        if (ay > lat !== by > lat && lon < ax + ((lat - ay) / (by - ay)) * (bx - ax))
          inside = !inside;
      }
  return inside;
};
// A stable pseudo-random number in [0, 1).
const noise = (i, j, salt) => {
  const value = Math.sin(i * 127.1 + j * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
};
const distanceKm = ([alon, alat], [blon, blat]) =>
  Math.hypot((alon - blon) * kmPerDegree.lon, (alat - blat) * kmPerDegree.lat);
const shifted = ([lon, lat], km, degrees) => [
  lon + (km * Math.cos((degrees * Math.PI) / 180)) / kmPerDegree.lon,
  lat + (km * Math.sin((degrees * Math.PI) / 180)) / kmPerDegree.lat,
];

// The low poly relief at zoom 9, as the map draws it: Terrarium, raised inside Switzerland.
const finest = new Map();
for (let x = column(bounds[0], 9); x <= column(bounds[2], 9); x++)
  for (let y = row(bounds[3], 9); y <= row(bounds[1], 9); y++) {
    const file = join(relief, "9", String(x), `${y}.webp`);
    if (!existsSync(file)) continue;
    const { data, info } = await sharp(readFileSync(file))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const elevations = new Float32Array(info.width * info.width);
    for (let p = 0; p < elevations.length; p++)
      elevations[p] = data[p * 3] * 256 + data[p * 3 + 1] + data[p * 3 + 2] / 256 - 32768;
    finest.set(`${x}/${y}`, { elevations, width: info.width });
  }
const elevationAt = ([lon, lat]) => {
  const r = (lat * Math.PI) / 180;
  const [wx, wy] = [
    ((lon + 180) / 360) * 512,
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 512,
  ];
  const tile = finest.get(`${Math.floor(wx)}/${Math.floor(wy)}`);
  if (!tile) return 0;
  const clamp = (value) => Math.max(0, Math.min(tile.width - 1, value));
  const fx = clamp((wx - Math.floor(wx)) * tile.width - 0.5);
  const fy = clamp((wy - Math.floor(wy)) * tile.width - 0.5);
  const [x0, y0] = [Math.floor(fx), Math.floor(fy)];
  const [x1, y1] = [clamp(x0 + 1), clamp(y0 + 1)];
  const at = (x, y) => tile.elevations[y * tile.width + x];
  const [dx, dy] = [fx - x0, fy - y0];
  return (
    (at(x0, y0) * (1 - dx) + at(x1, y0) * dx) * (1 - dy) +
    (at(x0, y1) * (1 - dx) + at(x1, y1) * dx) * dy
  );
};

const objects = { trees: [], houses: [], buildings: [], towers: [] };
const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
const add = (kind, at, level, size, angle) => {
  if (!within(switzerland, at) || within(water, at)) return;
  objects[kind].push([
    round(at[0], 4),
    round(at[1], 4),
    Math.round(elevationAt(at)),
    level,
    round(size, 2),
    Math.round(angle) % 360,
  ]);
};
const gridLevel = (i, j) => (i % 4 === 0 && j % 4 === 0 ? 0 : i % 2 === 0 && j % 2 === 0 ? 1 : 2);
const cellPoint = (i, j) => [
  bounds[0] + (i + 0.5 + (noise(i, j, 1) - 0.5) * 0.7) * step.lon,
  bounds[1] + (j + 0.5 + (noise(i, j, 2) - 0.5) * 0.7) * step.lat,
];

for (const [i, j] of cellsIn(woods))
  add("trees", cellPoint(i, j), gridLevel(i, j), 0.8 + 0.4 * noise(i, j, 3), 360 * noise(i, j, 4));

const swissPlaces = places.filter((place) => within(switzerland, place.at));
const seen = new Set();
const unique = swissPlaces.filter((place) => {
  const key = place.at.map((value) => value.toFixed(3)).join();
  return !seen.has(key) && seen.add(key);
});
// A golden-angle spiral around a place: as many spots as asked, ever farther.
const spiral = (place, count, firstKm, stepKm, salt) =>
  Array.from({ length: count }, (_, k) =>
    shifted(place.at, firstKm + stepKm * Math.sqrt(k), k * 137.5 + 360 * noise(k, salt, 5)),
  );
unique.forEach((place, index) => {
  const salt = index + 1;
  if (place.kind === "city") {
    const towers = Math.max(3, Math.min(9, 12 - place.rank));
    spiral(place, towers, 0.3, 0.75, salt).forEach((at, k) =>
      add("towers", at, 0, 0.75 + 0.6 * noise(k, salt, 6), 360 * noise(k, salt, 7)),
    );
    spiral(place, towers * 2, 2.6, 0.55, salt + 500).forEach((at, k) =>
      add("buildings", at, 1, 0.8 + 0.4 * noise(k, salt, 8), 360 * noise(k, salt, 9)),
    );
  }
  if (place.kind === "town")
    spiral(place, 3, 0.2, 0.7, salt).forEach((at, k) =>
      add("buildings", at, 1, 0.8 + 0.4 * noise(k, salt, 8), 360 * noise(k, salt, 9)),
    );
  if (place.kind === "village")
    spiral(place, 2, 0.2, 0.5, salt).forEach((at, k) =>
      add("houses", at, 1, 0.8 + 0.4 * noise(k, salt, 10), 360 * noise(k, salt, 11)),
    );
});
// Houses in the inhabited areas, away from the cities' towers and the towns' buildings.
const keepAway = unique.filter((place) => place.kind !== "village");
for (const [i, j] of cellsIn(inhabited)) {
  const at = cellPoint(i, j);
  const near = keepAway.some(
    (place) => distanceKm(place.at, at) < (place.kind === "city" ? 4 : 1.4),
  );
  if (near) continue;
  add(
    "houses",
    at,
    Math.max(1, gridLevel(i, j)),
    0.8 + 0.4 * noise(i, j, 12),
    360 * noise(i, j, 13),
  );
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify({
    license: "ODbL 1.0, © OpenStreetMap contributors",
    source: `OpenFreeMap ${template.split("/").at(-4)}, zoom ${zoom}`,
    relief: "terrain/lowpoly-v1, zoom 9, metres above sea level, raised inside Switzerland",
    fields: ["longitude", "latitude", "elevation", "level", "size", "angle"],
    ...objects,
  }) + "\n",
);
const counts = Object.fromEntries(
  Object.entries(objects).map(([kind, list]) => [
    kind,
    [0, 1, 2].map((level) => list.filter((item) => item[3] === level).length),
  ]),
);
console.log(JSON.stringify({ output, tiles: tiles.length, places: unique.length, counts }));
