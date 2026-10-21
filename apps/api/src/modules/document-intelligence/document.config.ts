import { localDocumentSecret } from "../../platform/local-document-secrets.js";
import { z } from "zod";
import type { Environment } from "../../platform/config.js";

const schema = z.object({
  DOCUMENT_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{2,62}$/)
    .default("coverview-documents"),
  DOCUMENT_S3_ACCESS_KEY: z.string().optional(),
  DOCUMENT_S3_SECRET_KEY: z.string().optional(),
  DOCUMENT_STORAGE_KEY: z
    .string()
    .regex(/^[A-Za-z0-9+/]{43}=$/)
    .optional(),
  // MinIO on the production stack's private network (21 October 2026): see ownerOnlyAcl.
  DOCUMENT_S3_MINIO: z.enum(["true", "false"]).default("false"),
  CLAMAV_HOST: z.string().min(1).default("127.0.0.1"),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(53310),
  OPENAI_API_KEY: z.string().min(20).optional(),
  OPENAI_DOCUMENT_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9.-]{1,100}$/)
    .default("gpt-5.4-mini"),
  OPENAI_DOCUMENT_DAILY_CALLS: z.coerce.number().int().min(1).max(20).optional(),
  OPENAI_DOCUMENT_INPUT_USD_PER_MILLION: z.coerce.number().min(0).max(1000).default(0.75),
  OPENAI_DOCUMENT_OUTPUT_USD_PER_MILLION: z.coerce.number().min(0).max(1000).default(4.5),
  // A multi-page contract transcribed page by page, reasoning included, exceeds 6000 tokens.
  OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1000).max(32000).default(16000),
});
export async function documentConfig(config: Environment) {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      `Invalid document configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(",")}`,
    );
  const values = parsed.data;
  const local =
    (config.APP_ENV === "local" || config.APP_ENV === "development") &&
    config.NODE_ENV !== "production";
  const enabled = config.DOCUMENTS_ENABLED && config.AUTH_ENABLED;
  if (
    enabled &&
    !local &&
    (!values.DOCUMENT_S3_ACCESS_KEY ||
      !values.DOCUMENT_S3_SECRET_KEY ||
      !values.DOCUMENT_STORAGE_KEY)
  )
    throw new Error(
      "Documents require dedicated storage credentials and encryption key outside local development",
    );
  const key =
    values.DOCUMENT_STORAGE_KEY ??
    (enabled && local ? await localDocumentSecret("ensure-storage") : undefined);
  if (enabled && !key)
    throw new Error(
      "Documents require a durable DOCUMENT_STORAGE_KEY or the Windows local secret store",
    );
  const encryptionKey = key ? Buffer.from(key, "base64") : Buffer.alloc(32);
  return {
    ...values,
    OPENAI_DOCUMENT_DAILY_CALLS: values.OPENAI_DOCUMENT_DAILY_CALLS ?? (local ? 20 : 3),
    enabled,
    local,
    minio: values.DOCUMENT_S3_MINIO === "true",
    encryptionKey,
    endpoint: config.MINIO_ENDPOINT,
    redisUrl: config.REDIS_URL,
    accessKey: values.DOCUMENT_S3_ACCESS_KEY ?? (local ? "coverview-local" : ""),
    secretKey: values.DOCUMENT_S3_SECRET_KEY ?? (local ? "coverview-local-storage" : ""),
  };
}
export type DocumentConfig = Awaited<ReturnType<typeof documentConfig>>;
