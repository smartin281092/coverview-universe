import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { z } from "zod";

export function isLoopback(host: string): boolean {
  return ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host.toLowerCase());
}

const serviceUrl = (protocols: string[]) =>
  z
    .url()
    .refine(
      (value) => URL.canParse(value) && protocols.includes(new URL(value).protocol),
      "Unsupported service protocol",
    );
const httpUrl = serviceUrl(["http:", "https:"]).refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return !url.username && !url.password && !url.search && !url.hash;
}, "HTTP service URLs cannot contain credentials, query strings or fragments");

export const environmentSchema = z
  .object({
    APP_ENV: z.enum(["local", "development", "test", "staging", "production"]),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_HOST: z.string().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    FIXTURE_MODE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    EXTERNAL_ADAPTER_MODE: z.enum(["local", "disabled"]).default("disabled"),
    DATABASE_URL: serviceUrl(["postgres:", "postgresql:"]),
    REDIS_URL: serviceUrl(["redis:", "rediss:"]),
    MINIO_ENDPOINT: httpUrl,
    MAILPIT_URL: httpUrl,
    CORS_ORIGINS: z
      .string()
      .min(1)
      .transform((value) => value.split(",").map((origin) => origin.trim()))
      .pipe(
        z
          .array(
            httpUrl.refine(
              (value) => URL.canParse(value) && new URL(value).origin === value,
              "An exact origin is required",
            ),
          )
          .min(1)
          .max(10),
      ),
    DEPENDENCY_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(2000),
  })
  .superRefine((config, context) => {
    const isLocal =
      ["local", "development"].includes(config.APP_ENV) && config.NODE_ENV !== "production";
    const usesLocalFeatures = config.FIXTURE_MODE || config.EXTERNAL_ADAPTER_MODE === "local";
    if (usesLocalFeatures && !isLocal) {
      context.addIssue({
        code: "custom",
        path: ["FIXTURE_MODE"],
        message:
          "Local fixtures and adapters require local/development and a non-production runtime",
      });
    }
    if (usesLocalFeatures) {
      if (!isLoopback(config.API_HOST)) {
        context.addIssue({
          code: "custom",
          path: ["API_HOST"],
          message: "Local fixtures require a loopback listener",
        });
      }
      for (const key of ["DATABASE_URL", "REDIS_URL", "MINIO_ENDPOINT", "MAILPIT_URL"] as const) {
        if (!URL.canParse(config[key])) continue;
        const url = new URL(config[key]);
        if (!isLoopback(url.hostname) || url.search || url.hash) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "Local fixtures require loopback services without query overrides",
          });
        }
      }
      if (
        config.CORS_ORIGINS.some(
          (origin) => URL.canParse(origin) && !isLoopback(new URL(origin).hostname),
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["CORS_ORIGINS"],
          message: "Local fixtures require loopback browser origins",
        });
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(input: Record<string, string | undefined>): Environment {
  const result = environmentSchema.safeParse(input);
  if (!result.success) {
    // Do not serialize Zod input or values: service URLs may contain credentials.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join(".")))];
    throw new Error(`Invalid environment configuration: ${fields.join(", ")}`);
  }
  return result.data;
}

export function loadEnvironment(): Environment {
  let directory = resolve(process.cwd());
  while (!existsSync(join(directory, "pnpm-workspace.yaml"))) {
    const parent = dirname(directory);
    if (parent === directory) throw new Error("Run the API from the CoverView workspace");
    directory = parent;
  }
  const envPath = join(directory, ".env");
  if (existsSync(envPath)) loadEnvFile(envPath);
  return parseEnvironment(process.env);
}

export function assertLocalDatabase(config: Environment): void {
  const url = new URL(config.DATABASE_URL);
  if (
    !["local", "development"].includes(config.APP_ENV) ||
    config.NODE_ENV === "production" ||
    !isLoopback(url.hostname) ||
    url.search ||
    url.hash ||
    !/^\/coverview_(local|test)$/.test(url.pathname)
  ) {
    throw new Error(
      "Database maintenance requires a loopback CoverView local/test database in local/development",
    );
  }
}
