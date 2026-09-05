import {
  apiErrorSchema,
  localPersonasSchema,
  readinessSchema,
  identityConfigSchema,
  identityMeSchema,
  identityWorkspaceSchema,
  identityAdminSchema,
  identitySessionsSchema,
  identitySuccessSchema,
  identityLogoutSchema,
  identityLogoutInputSchema,
  identityMfaChallengeSchema,
  identityMfaVerifyInputSchema,
  type ApiErrorCode,
} from "@coverview/contracts";
import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    readonly status: number,
    readonly requestId?: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ApiError";
  }
}

type RequestOptions = { signal?: AbortSignal };
type MutationOptions = RequestOptions & { csrfToken: string; idempotencyKey: string };

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

  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions = {},
    mutation?: { body: unknown; credentials: MutationOptions; timeoutMs?: number },
    authenticated = false,
  ): Promise<T> {
    const timeout = AbortSignal.timeout(mutation?.timeoutMs ?? timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    let response: Response;
    try {
      response = await fetch(new URL(path, base), {
        method: mutation ? "POST" : "GET",
        signal,
        headers: {
          Accept: "application/json",
          "X-Request-Id": crypto.randomUUID(),
          ...(mutation
            ? {
                "Content-Type": "application/json",
                "X-CSRF-Token": mutation.credentials.csrfToken,
                "Idempotency-Key": mutation.credentials.idempotencyKey,
              }
            : {}),
        },
        credentials: authenticated ? "include" : "omit",
        cache: authenticated ? "no-store" : "default",
        ...(mutation ? { body: JSON.stringify(mutation.body) } : {}),
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
    health: (options?: RequestOptions) => request("/health/ready", readinessSchema, options),
    personas: (options?: RequestOptions) =>
      request("/local/personas", localPersonasSchema, options),
    identityConfig: (options?: RequestOptions) =>
      request("/identity/config", identityConfigSchema, options),
    me: (options?: RequestOptions) =>
      request("/identity/me", identityMeSchema, options, undefined, true),
    workspace: (userId: string, options?: RequestOptions) =>
      request(
        `/identity/workspace/${encodeURIComponent(userId)}`,
        identityWorkspaceSchema,
        options,
        undefined,
        true,
      ),
    admin: (options?: RequestOptions) =>
      request("/identity/admin", identityAdminSchema, options, undefined, true),
    sessions: (cursor?: string, options?: RequestOptions) =>
      request(
        `/identity/sessions${cursor ? `?${new URLSearchParams({ cursor })}` : ""}`,
        identitySessionsSchema,
        options,
        undefined,
        true,
      ),
    revokeSession: (sessionId: string, options: MutationOptions) =>
      request(
        `/identity/sessions/${encodeURIComponent(sessionId)}/revoke`,
        identitySuccessSchema,
        options,
        { body: {}, credentials: options, timeoutMs: 15000 },
        true,
      ),
    logout: (scope: z.infer<typeof identityLogoutInputSchema>["scope"], options: MutationOptions) =>
      request(
        "/identity/logout",
        identityLogoutSchema,
        options,
        {
          body: identityLogoutInputSchema.parse({ scope }),
          credentials: options,
          timeoutMs: 15000,
        },
        true,
      ),
    challengeMfa: (options: MutationOptions) =>
      request(
        "/identity/mfa/challenge",
        identityMfaChallengeSchema,
        options,
        { body: {}, credentials: options },
        true,
      ),
    verifyMfa: (input: z.infer<typeof identityMfaVerifyInputSchema>, options: MutationOptions) =>
      request(
        "/identity/mfa/verify",
        identitySuccessSchema,
        options,
        { body: identityMfaVerifyInputSchema.parse(input), credentials: options },
        true,
      ),
    loginUrl: (surface: "wallet" | "admin" | "www") =>
      new URL(`/auth/login?${new URLSearchParams({ surface })}`, base).href,
  };
}

export type IdentityMe = Awaited<ReturnType<ReturnType<typeof createApiClient>["me"]>>;
