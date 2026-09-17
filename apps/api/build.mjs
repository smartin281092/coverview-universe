import { build } from "esbuild";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
await build({
  entryPoints: {
    main: "src/main.ts",
    "document.pdf-annotations-worker":
      "src/modules/document-intelligence/document.pdf-annotations-worker.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
  external: Object.keys(manifest.dependencies).filter((name) => !name.startsWith("@coverview/")),
});
