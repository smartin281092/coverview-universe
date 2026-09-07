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
    AUTH_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    DOCUMENTS_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    WORKOS_API_KEY: z.string().min(1).optional(),
    WORKOS_CLIENT_ID: z.string().startsWith("client_").optional(),
    WORKOS_ISSUER: httpUrl.default("https://api.workos.com/"),
    AUTH_SESSION_SECRET: z.string().optional(),
    AUTH_API_ORIGIN: httpUrl.default("http://127.0.0.1:4100"),
    AUTH_WALLET_ORIGIN: httpUrl.default("http://127.0.0.1:4101"),
    AUTH_ADMIN_ORIGIN: httpUrl.default("http://127.0.0.1:4102"),
    AUTH_WWW_ORIGIN: httpUrl.default("http://127.0.0.1:4103"),
    AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(86400).default(28800),
    WORKOS_TIMEOUT_MS: z.coerce.number().int().min(100).max(5000).default(3000),
  })
  .superRefine((config, context) => {
    const isLocal =
      ["local", "development"].includes(config.APP_ENV) && config.NODE_ENV !== "production";
    const usesLocalFeatures = config.FIXTURE_MODE || config.EXTERNAL_ADAPTER_MODE === "local";
    if (config.AUTH_ENABLED) {
      if (URL.canParse(config.WORKOS_ISSUER) && new URL(config.WORKOS_ISSUER).protocol !== "https:")
        context.addIssue({
          code: "custom",
          path: ["WORKOS_ISSUER"],
          message: "WorkOS issuer must use HTTPS",
        });
      for (const key of ["WORKOS_API_KEY", "WORKOS_CLIENT_ID", "AUTH_SESSION_SECRET"] as const) {
        if (
          !config[key] ||
          (key === "AUTH_SESSION_SECRET" && !/^[A-Za-z0-9+/]{43}=$/.test(config[key]))
        ) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "Authentication requires server credentials and a base64 32-byte key",
          });
        }
      }
      for (const key of [
        "AUTH_API_ORIGIN",
        "AUTH_WALLET_ORIGIN",
        "AUTH_ADMIN_ORIGIN",
        "AUTH_WWW_ORIGIN",
      ] as const) {
        if (!URL.canParse(config[key])) continue;
        const url = new URL(config[key]);
        if (
          url.origin !== config[key] ||
          (url.protocol !== "https:" && !(isLocal && isLoopback(url.hostname)))
        ) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "An exact HTTPS origin is required outside local loopback",
          });
        }
        if (key !== "AUTH_API_ORIGIN" && !config.CORS_ORIGINS.includes(config[key])) {
          context.addIssue({
            code: "custom",
            path: [key],
            message: "The surface must be present in the exact CORS allowlist",
          });
        }
      }
      // Local cookies are host-only: mixing localhost and 127.0.0.1 loses the shared session.
      if (
        isLocal &&
        [config.AUTH_WALLET_ORIGIN, config.AUTH_ADMIN_ORIGIN, config.AUTH_WWW_ORIGIN].some(
          (origin) =>
            URL.canParse(origin) &&
            URL.canParse(config.AUTH_API_ORIGIN) &&
            new URL(origin).hostname !== new URL(config.AUTH_API_ORIGIN).hostname,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["AUTH_API_ORIGIN"],
          message: "Local surfaces must use the same host",
        });
    }
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
  const config = result.data;
  // Repair the earlier local runbook's OIDC discovery/session-token issuer mix-up.
  // This known alias is configuration-only; never infer an accepted issuer from a token.
  if (
    ["local", "development"].includes(config.APP_ENV) &&
    config.NODE_ENV !== "production" &&
    config.WORKOS_CLIENT_ID &&
    config.WORKOS_ISSUER === `https://api.workos.com/user_management/${config.WORKOS_CLIENT_ID}`
  ) {
    return { ...config, WORKOS_ISSUER: "https://api.workos.com/" };
  }
  return config;
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
