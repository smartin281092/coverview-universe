// Le processus parent (Turborepo/preview) possède le cycle de vie.
// Astro utilise aussi ce marqueur pour son propre enfant supervisé : il évite
// une seconde daemonisation automatique quand un agent est détecté.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const manifestPath = require.resolve("astro/package.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const cli = resolve(dirname(manifestPath), manifest.bin.astro);
process.env.ASTRO_DEV_BACKGROUND = "1";
process.argv = [process.execPath, cli, "dev", ...process.argv.slice(2)];
await import(pathToFileURL(cli).href);
