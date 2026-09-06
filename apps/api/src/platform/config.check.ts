import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { environmentSchema, parseEnvironment } from "./config.js";

const source = await readFile(new URL("../../../../.env.example", import.meta.url), "utf8");
const example = parseEnv(source);
// Process-only optional credentials are documented as comments, never seeded into the local env.
const documented = new Set([
  ...Object.keys(example),
  ...Array.from(source.matchAll(/^# ([A-Z][A-Z0-9_]*)=/gm), (match) => match[1]),
]);
const missing = Object.keys(environmentSchema.shape).filter((key) => !documented.has(key));
if (missing.length)
  throw new Error(`Environment example is missing API keys: ${missing.join(", ")}`);
parseEnvironment(example);
if (process.argv.includes("--runtime")) parseEnvironment(process.env);
process.stdout.write(
  "Environment example documents every API schema key; active defaults pass validation\n",
);
