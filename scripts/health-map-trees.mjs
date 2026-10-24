// Low poly trees for the comparator's 3D map (user request, 24 October 2026: « une version
// disponible en mode low poly avec des arbres low poly pour les zones boisées »): one tree
// per cell of a 1.5 km grid whose centre lies in the woods of OpenStreetMap and inside
// Switzerland, a little shifted so that forests do not look planted in rows. Each tree
// carries the coarsest grid it also belongs to (6, 3 or 1.5 km), so that the map shows
// fewer of them from afar. The woods are those the map draws at Switzerland's scale:
// OpenFreeMap tiles of zoom 8 (12 tiles, cached in the OS temporary directory). Computed
// once here rather than in the browser, where reading the woods' outlines took 100 to
// 200 ms after each move. Data © OpenStreetMap contributors (ODbL): the file is a derived
// database under the same licence. Decoders: MapLibre's own @mapbox/vector-tile and pbf.
//   node scripts/health-map-trees.mjs
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
const output = join(root, "apps/www/public/map/trees-v1.json");
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
const column = (lon) => Math.floor(((lon + 180) / 360) * 2 ** zoom);
const row = (lat) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** zoom);
};
const tiles = [];
for (let x = column(bounds[0]); x <= column(bounds[2]); x++)
  for (let y = row(bounds[3]); y <= row(bounds[1]); y++) tiles.push([x, y]);

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

// The woods' polygons, in degrees.
const woods = [];
for (const [x, y] of tiles) {
  const layer = new VectorTile(new PbfReader(await fetchTile([x, y]))).layers.landcover;
  for (let index = 0; index < (layer?.length ?? 0); index++) {
    const feature = layer.feature(index);
    if (feature.properties.class !== "wood") continue;
    const { geometry } = feature.toGeoJSON(x, y, zoom);
    if (geometry.type === "Polygon") woods.push(geometry.coordinates);
    if (geometry.type === "MultiPolygon") woods.push(...geometry.coordinates);
  }
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
const insideAt = (rows, j, lon) => {
  let count = 0;
  for (const x of rows.get(j) ?? []) if (x < lon) count++;
  return count % 2 === 1;
};
// A stable pseudo-random number in [0, 1) for a cell.
const noise = (i, j, salt) => {
  const value = Math.sin(i * 127.1 + j * 311.7 + salt * 74.7) * 43758.5453;
  return value - Math.floor(value);
};

const swiss = crossings(switzerland);
const cells = new Set();
// Each polygon on its own, so that woods cut at tile edges never cancel each other out.
for (const polygon of woods)
  for (const [j, xs] of crossings([polygon]))
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const from = Math.ceil((xs[k] - bounds[0]) / step.lon - 0.5);
      const to = Math.floor((xs[k + 1] - bounds[0]) / step.lon - 0.5);
      for (let i = from; i <= to; i++) cells.add(`${i},${j}`);
    }
const features = [];
for (const key of [...cells].sort()) {
  const [i, j] = key.split(",").map(Number);
  const lon = bounds[0] + (i + 0.5) * step.lon;
  if (!insideAt(swiss, j, lon)) continue;
  const level = i % 4 === 0 && j % 4 === 0 ? 0 : i % 2 === 0 && j % 2 === 0 ? 1 : 2;
  features.push({
    type: "Feature",
    properties: { level, size: Math.round((0.8 + 0.4 * noise(i, j, 3)) * 100) / 100 },
    geometry: {
      type: "Point",
      coordinates: [
        Math.round((lon + (noise(i, j, 1) - 0.5) * 0.7 * step.lon) * 1e4) / 1e4,
        Math.round((bounds[1] + (j + 0.5 + (noise(i, j, 2) - 0.5) * 0.7) * step.lat) * 1e4) / 1e4,
      ],
    },
  });
}
mkdirSync(dirname(output), { recursive: true });
writeFileSync(
  output,
  JSON.stringify({
    type: "FeatureCollection",
    license: "ODbL 1.0, © OpenStreetMap contributors",
    source: `OpenFreeMap ${template.split("/").at(-4)}, zoom ${zoom}, landcover wood`,
    spacing: `${spacing} km`,
    features,
  }) + "\n",
);
const counts = [0, 1, 2].map(
  (level) => features.filter((f) => f.properties.level === level).length,
);
console.log(
  JSON.stringify({
    output,
    tiles: tiles.length,
    woods: woods.length,
    trees: features.length,
    counts,
  }),
);
