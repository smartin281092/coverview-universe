// Copies the comparator's 3D relief once, so visitors never ask a third party for it.
// Mapterhorn Terrarium tiles, zooms 5 (the map's widest view) to 9, over Switzerland and
// enough of its neighbours for tilted views. Each 512 px tile is averaged down to 256 px
// (whole metres, lossless WebP): a quarter of the weight per view, about 210 m per pixel at
// zoom 9.
// Sources and licences: https://mapterhorn.com/attribution (swisstopo swissALTI3D, IGN,
// BEV, German Länder, Italian regions, Copernicus GLO-30).
//   node scripts/health-terrain-tiles.mjs [output directory]
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(join(root, "apps/www/package.json"))("sharp");
const output = resolve(process.argv[2] ?? join(root, "apps/www/public/terrain/v1"));
const source = "https://tiles.mapterhorn.com";
// West, south, east, north.
const bounds = [3.6, 44.6, 13, 49.2];
const minzoom = 5;
const maxzoom = 9;
const size = 256;

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
  try {
    const response = await fetch(`${source}/${z}/${x}/${y}.webp`, {
      headers: { "user-agent": "CoverView terrain copy (+https://coverview.ch)" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${z}/${x}/${y}: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (attempt >= 3) throw error;
    await new Promise((done) => setTimeout(done, 2000 * attempt));
    return fetchTile([z, x, y], attempt + 1);
  }
};

// Terrarium: elevation = R × 256 + G + B / 256 − 32768. Averaged in metres, never per
// colour channel, which would mix the high and low bytes.
const shrink = async (body) => {
  const { data, info } = await sharp(body)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const factor = info.width / size;
  if (info.width !== info.height || !Number.isInteger(factor)) throw new Error("tile size");
  const out = Buffer.alloc(size * size * 3);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++)
        for (let dx = 0; dx < factor; dx++) {
          const i = ((y * factor + dy) * info.width + x * factor + dx) * 3;
          sum += data[i] * 256 + data[i + 1] + data[i + 2] / 256 - 32768;
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

// Two requests at a time.
const bodies = new Array(tiles.length);
let next = 0;
await Promise.all(
  [0, 1].map(async () => {
    while (next < tiles.length) {
      const index = next++;
      bodies[index] = await shrink(await fetchTile(tiles[index]));
    }
  }),
);
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
console.log(JSON.stringify({ output, count: tiles.length, bytes }));
