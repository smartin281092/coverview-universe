import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { environmentSchema, parseEnvironment } from "./config.js";

const example = parseEnv(
  await readFile(new URL("../../../../.env.example", import.meta.url), "utf8"),
);
const missing = Object.keys(environmentSchema.shape).filter((key) => !(key in example));
if (missing.length)
  throw new Error(`Environment example is missing API keys: ${missing.join(", ")}`);
parseEnvironment(example);
process.stdout.write("Environment example contains every API schema key and passes validation\n");
