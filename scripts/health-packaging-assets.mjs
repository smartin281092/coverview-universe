import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const require = createRequire(path.resolve("apps/www/package.json"));
const sharp = require("sharp");
const [id, source] = process.argv.slice(2);
if (!/^(hm_[a-f0-9]+|hfm_2027_\d+)$/.test(id ?? "") || !source)
  throw new Error("Expected known model id and image path");
const destination = path.resolve("packages/ui/src/health-products");
await mkdir(destination, { recursive: true });
const bytes = await readFile(source);
const info = await sharp(bytes).metadata();
if (!info.width || !info.height) throw new Error("Invalid image");
await sharp(bytes)
  .resize(768, 768, { fit: "inside", withoutEnlargement: true })
  .webp({ quality: 86 })
  .toFile(path.join(destination, `${id}.webp`));
await mkdir(path.resolve(".preview/health-packaging-records"), { recursive: true });
await writeFile(
  path.resolve(".preview/health-packaging-records", `${id}.json`),
  JSON.stringify(
    { id, source, file: `${id}.webp`, width: info.width, height: info.height },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ id, file: `${id}.webp` }));
