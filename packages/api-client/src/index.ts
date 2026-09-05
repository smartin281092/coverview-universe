import {
  apiErrorSchema,
  localPersonasSchema,
  readinessSchema,
  type PlatformErrorCode,
} from "@coverview/contracts";
import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    readonly code: PlatformErrorCode,
    readonly status: number,
    readonly requestId?: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ApiError";
  }
}

type RequestOptions = { signal?: AbortSignal };

export function createApiClient({
  baseUrl,
  timeoutMs = 5000,
}: {
  baseUrl: string;
  timeoutMs?: number;
}) {
  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) {
    throw new Error("API base URL must be HTTP(S) without credentials");
  }

  async function get<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await fetch(new URL(path, base), {
        method: "GET",
        signal,
        headers: { Accept: "application/json", "X-Request-Id": crypto.randomUUID() },
        credentials: "omit",
      });
    } catch (cause) {
      throw new ApiError("PLATFORM_REQUEST_FAILED", 0, undefined, { cause });
    }
    const requestId = response.headers.get("x-request-id") ?? undefined;
    let body: unknown;
    try {
      body = await response.json();
    } catch (cause) {
      throw new ApiError("PLATFORM_INVALID_RESPONSE", response.status, requestId, { cause });
    }
    if (!response.ok) {
      const structured = apiErrorSchema.safeParse(body);
      const code = structured.success
        ? structured.data.error.code
        : response.status === 503
          ? "PLATFORM_NOT_READY"
          : "PLATFORM_REQUEST_FAILED";
      throw new ApiError(code, response.status, requestId);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError("PLATFORM_INVALID_RESPONSE", response.status, requestId, {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  return {
    health: (options?: RequestOptions) => get("/health/ready", readinessSchema, options),
    personas: (options?: RequestOptions) => get("/local/personas", localPersonasSchema, options),
  };
}
