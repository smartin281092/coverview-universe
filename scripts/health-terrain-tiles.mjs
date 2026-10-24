// Copies the comparator's 3D relief once, so visitors never ask a third party for it.
// Mapterhorn Terrarium tiles, zooms 5 (the map's widest view) to 9, over Switzerland only
// (user requests, 24 October 2026: « découpe la suisse pour la surélever », then « enlève
// les pays autour (pas de reliefs rien) »): Switzerland, lakes included, keeps its relief
// raised by a constant height; around it the ground is flat at 0 m, as MapLibre assumes
// beyond these tiles. Each 512 px tile is then averaged down to 256 px (whole metres,
// lossless WebP), about 210 m per pixel at zoom 9.
// Source inside Switzerland: swissALTI3D (swisstopo), through Mapterhorn
// (https://mapterhorn.com/attribution). Downloads are cached in the OS temporary
// directory, so a new height or outline needs no new download.
//   node scripts/health-terrain-tiles.mjs [output directory]
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(join(root, "apps/www/package.json"))("sharp");
const output = resolve(process.argv[2] ?? join(root, "apps/www/public/terrain/v1"));
const cache = join(tmpdir(), "coverview-terrain-cache");
const source = "https://tiles.mapterhorn.com";
// West, south, east, north: Switzerland and a small margin.
const bounds = [5.9, 45.77, 10.55, 47.86];
const minzoom = 5;
const maxzoom = 9;
const size = 256;
// Metres added inside Switzerland, before the map's own exaggeration.
const raise = 2500;
const geoFile = join(root, "data/health-insurance/2027/regions-geo.json");
const geoBytes = readFileSync(geoFile);
// Switzerland's outline, its lakes included, foreign enclaves excluded.
const switzerland = JSON.parse(geoBytes.toString("utf8")).borders.features.find(
  (feature) => feature.properties.kind === "national",
).geometry.coordinates;

const column = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const row = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};
const tiles = [];
for (let z = minzoom; z <= maxzoom; z++)
  for (let x = column(bounds[0], z); x <= column(bounds[2], z); x++)
    for (let y = row(bounds[3], z); y <= row(bounds[1], z); y++) tiles.push([z, x, y]);

const fetchTile = async ([z, x, y], attempt = 1) => {
  const file = join(cache, String(z), String(x), `${y}.webp`);
  if (existsSync(file)) return readFileSync(file);
  try {
    const response = await fetch(`${source}/${z}/${x}/${y}.webp`, {
      headers: { "user-agent": "CoverView terrain copy (+https://coverview.ch)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${z}/${x}/${y}: HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
    return body;
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((done) => setTimeout(done, 2000 * attempt));
    return fetchTile([z, x, y], attempt + 1);
  }
};

// Share of each pixel inside Switzerland (0 to 255, anti-aliased), drawn by librsvg.
const swissShare = async ([z, x, y], width) => {
  const scale = 2 ** z;
  const px = (lon) => (((lon + 180) / 360) * scale - x) * width;
  const py = (lat) => {
    const r = (lat * Math.PI) / 180;
    return (((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * scale - y) * width;
  };
  const paths = [];
  for (const polygon of switzerland) {
    const points = polygon.map((ring) => ring.map(([lon, lat]) => [px(lon), py(lat)]));
    const xs = points[0].map((point) => point[0]);
    const ys = points[0].map((point) => point[1]);
    if (Math.max(...xs) < 0 || Math.min(...xs) > width) continue;
    if (Math.max(...ys) < 0 || Math.min(...ys) > width) continue;
    const d = points
      .map((ring) => `M${ring.map(([a, b]) => `${a.toFixed(2)} ${b.toFixed(2)}`).join("L")}Z`)
      .join("");
    paths.push(`<path d="${d}" fill="#fff" fill-rule="evenodd"/>`);
  }
  if (!paths.length) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}">${paths.join("")}</svg>`;
  const { data } = await sharp(Buffer.from(svg), { density: 72 })
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
};

// Terrarium: elevation = R × 256 + G + B / 256 − 32768. Raised, cut and averaged in metres,
// never per colour channel, which would mix the high and low bytes.
const prepare = async (tile, body) => {
  const { data, info } = await sharp(body)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const factor = info.width / size;
  if (info.width !== info.height || !Number.isInteger(factor)) throw new Error("tile size");
  const share = await swissShare(tile, info.width);
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++)
        for (let dx = 0; dx < factor; dx++) {
          const p = (y * factor + dy) * info.width + x * factor + dx;
          const i = p * 3;
          const elevation = data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
          if (share) sum += ((elevation + raise) * share[p]) / 255;
        }
      const value = Math.round(sum / factor ** 2) + 32768;
      const o = (y * size + x) * 3;
      out[o] = value >> 8;
      out[o + 1] = value & 255;
      out[o + 2] = 0;
    }
  return sharp(out, { raw: { width: size, height: size, channels: 3 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
};

// Two tiles at a time.
const bodies = new Array(tiles.length);
let next = 0;
await Promise.all(
  [0, 1].map(async () => {
    while (next < tiles.length) {
      const index = next++;
      bodies[index] = await prepare(tiles[index], await fetchTile(tiles[index]));
    }
  }),
);
// Only this copy's own zoom folders are replaced.
for (let z = minzoom; z <= maxzoom; z++)
  rmSync(join(output, String(z)), { recursive: true, force: true });
const digest = createHash("sha256");
let bytes = 0;
for (const [index, [z, x, y]] of tiles.entries()) {
  const file = join(output, String(z), String(x), `${y}.webp`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, bodies[index]);
  digest.update(`${z}/${x}/${y}:`).update(bodies[index]);
  bytes += bodies[index].length;
}
writeFileSync(
  join(output, "tiles.json"),
  JSON.stringify(
    {
      tilejson: "3.0.0",
      tiles: ["/terrain/v1/{z}/{x}/{y}.webp"],
      encoding: "terrarium",
      // Displayed as 512 px tiles: each image has half the resolution of the source tile.
      tileSize: 512,
      pixels: size,
      minzoom,
      maxzoom,
      bounds,
      raise: {
        metres: raise,
        inside: "regions-geo.json",
        sha256: createHash("sha256").update(geoBytes).digest("hex"),
      },
      attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
      source: `${source}/{z}/{x}/{y}.webp`,
      copied: new Date().toISOString().slice(0, 10),
      count: tiles.length,
      bytes,
      sha256: digest.digest("hex"),
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ output, count: tiles.length, bytes, raise }));
