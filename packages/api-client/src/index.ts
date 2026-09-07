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
  identityMfaEnrollmentSchema,
  identityMfaEnrollmentStartSchema,
  profileSchema,
  profileSaveInputSchema,
  profileConfirmInputSchema,
  profileDraftEntrySchema,
  profileAttachInputSchema,
  profileAttachSchema,
  profileChoicesSchema,
  documentSchema,
  documentListSchema,
  documentListQuerySchema,
  documentCreateInputSchema,
  documentReviewInputSchema,
  documentReviewResultSchema,
  documentCategoryInputSchema,
  documentRetryInputSchema,
  documentChangeRequestsSchema,
  documentChangeRequestSchema,
  documentProfileDifferencesSchema,
  documentCompaniesSchema,
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
    mutation?: {
      body: unknown;
      credentials: MutationOptions;
      timeoutMs?: number;
      binary?: boolean;
    },
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
                "Content-Type": mutation.binary ? "application/octet-stream" : "application/json",
                "X-CSRF-Token": mutation.credentials.csrfToken,
                "Idempotency-Key": mutation.credentials.idempotencyKey,
              }
            : {}),
        },
        credentials: authenticated ? "include" : "omit",
        cache: authenticated ? "no-store" : "default",
        ...(mutation
          ? { body: mutation.binary ? (mutation.body as Blob) : JSON.stringify(mutation.body) }
          : {}),
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
    documentCompanies: (options?: RequestOptions) =>
      request("/documents/companies", documentCompaniesSchema, options, undefined, true),
    documentProfileDifferences: (options?: RequestOptions) =>
      request(
        "/documents/profile-differences",
        documentProfileDifferencesSchema,
        options,
        undefined,
        true,
      ),
    documentChangeRequests: (cursor?: string, options?: RequestOptions) =>
      request(
        `/document-change-requests${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        documentChangeRequestsSchema,
        options,
        undefined,
        true,
      ),
    cancelDocumentChangeRequest: (
      documentId: string,
      requestId: string,
      options: MutationOptions,
    ) =>
      request(
        `/documents/${encodeURIComponent(documentId)}/change-requests/${encodeURIComponent(requestId)}/cancel`,
        documentChangeRequestSchema,
        options,
        { body: {}, credentials: options },
        true,
      ),
    documents: (
      cursor?: string,
      options?: RequestOptions,
      filters?: Omit<z.infer<typeof documentListQuerySchema>, "cursor">,
    ) =>
      request(
        `/documents?${new URLSearchParams(Object.entries(documentListQuerySchema.parse({ ...filters, cursor })).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}`,
        documentListSchema,
        options,
        undefined,
        true,
      ),
    document: (id: string, options?: RequestOptions) =>
      request(`/documents/${encodeURIComponent(id)}`, documentSchema, options, undefined, true),
    createDocument: (input: z.infer<typeof documentCreateInputSchema>, options: MutationOptions) =>
      request(
        "/documents",
        documentSchema,
        options,
        { body: documentCreateInputSchema.parse(input), credentials: options },
        true,
      ),
    uploadDocument: (id: string, file: File, options: MutationOptions) =>
      request(
        `/documents/${encodeURIComponent(id)}/content`,
        documentSchema,
        options,
        { body: file, credentials: options, binary: true, timeoutMs: 60000 },
        true,
      ),
    retryDocument: (
      id: string,
      input: z.infer<typeof documentRetryInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/documents/${encodeURIComponent(id)}/retry`,
        documentSchema,
        options,
        { body: documentRetryInputSchema.parse(input), credentials: options },
        true,
      ),
    categorizeDocument: (
      id: string,
      input: z.infer<typeof documentCategoryInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/documents/${encodeURIComponent(id)}/category`,
        documentSchema,
        options,
        { body: documentCategoryInputSchema.parse(input), credentials: options },
        true,
      ),
    reviewDocument: (
      id: string,
      input: z.infer<typeof documentReviewInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/documents/${encodeURIComponent(id)}/review`,
        documentReviewResultSchema,
        options,
        { body: documentReviewInputSchema.parse(input), credentials: options },
        true,
      ),
    deleteDocument: (id: string, options: MutationOptions) =>
      request(
        `/documents/${encodeURIComponent(id)}/delete`,
        identitySuccessSchema,
        options,
        { body: {}, credentials: options },
        true,
      ),
    async downloadDocument(id: string, options: RequestOptions = {}) {
      const signal = AbortSignal.any([
        AbortSignal.timeout(30000),
        ...(options.signal ? [options.signal] : []),
      ]);
      let response: Response;
      try {
        response = await fetch(new URL(`/documents/${encodeURIComponent(id)}/download`, base), {
          credentials: "include",
          cache: "no-store",
          signal,
          headers: { "X-Request-Id": crypto.randomUUID() },
        });
      } catch (cause) {
        throw new ApiError("PLATFORM_REQUEST_FAILED", 0, undefined, { cause });
      }
      if (!response.ok) {
        const parsed = apiErrorSchema.safeParse(await response.json());
        throw new ApiError(
          parsed.success ? parsed.data.error.code : "PLATFORM_REQUEST_FAILED",
          response.status,
        );
      }
      return response.blob();
    },
    profile: (options?: RequestOptions) =>
      request("/identity/profile", profileSchema, options, undefined, true),
    saveProfile: (input: z.infer<typeof profileSaveInputSchema>, options: MutationOptions) =>
      request(
        "/identity/profile",
        profileSchema,
        options,
        { body: profileSaveInputSchema.parse(input), credentials: options },
        true,
      ),
    confirmProfile: (input: z.infer<typeof profileConfirmInputSchema>, options: MutationOptions) =>
      request(
        "/identity/profile/confirm",
        profileSchema,
        options,
        { body: profileConfirmInputSchema.parse(input), credentials: options },
        true,
      ),
    profileDraft: (options?: RequestOptions) =>
      request("/identity/profile/draft", profileDraftEntrySchema, options, undefined, true),
    newProfileDraft: (options: MutationOptions) =>
      request(
        "/identity/profile/draft/new",
        profileDraftEntrySchema,
        options,
        { body: {}, credentials: options },
        true,
      ),
    saveProfileDraft: (input: z.infer<typeof profileSaveInputSchema>, options: MutationOptions) =>
      request(
        "/identity/profile/draft",
        profileDraftEntrySchema,
        options,
        { body: profileSaveInputSchema.parse(input), credentials: options },
        true,
      ),
    attachProfileDraft: (
      input: z.infer<typeof profileAttachInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        "/identity/profile/attach",
        profileAttachSchema,
        options,
        { body: profileAttachInputSchema.parse(input), credentials: options },
        true,
      ),
    profileChoices: (cursor?: string, options?: RequestOptions) =>
      request(
        `/identity/profile/choices${cursor ? `?${new URLSearchParams({ cursor })}` : ""}`,
        profileChoicesSchema,
        options,
        undefined,
        true,
      ),
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
    mfaEnrollment: (options?: RequestOptions) =>
      request("/identity/mfa/enrollment", identityMfaEnrollmentSchema, options, undefined, true),
    startMfaEnrollment: (options: MutationOptions) =>
      request(
        "/identity/mfa/enrollment/start",
        identityMfaEnrollmentStartSchema,
        options,
        { body: {}, credentials: options, timeoutMs: 20000 },
        true,
      ),
    challengeMfaEnrollment: (options: MutationOptions) =>
      request(
        "/identity/mfa/enrollment/challenge",
        identityMfaChallengeSchema,
        options,
        { body: {}, credentials: options, timeoutMs: 20000 },
        true,
      ),
    confirmMfaEnrollment: (
      input: z.infer<typeof identityMfaVerifyInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        "/identity/mfa/enrollment/confirm",
        identitySuccessSchema,
        options,
        { body: identityMfaVerifyInputSchema.parse(input), credentials: options, timeoutMs: 20000 },
        true,
      ),
    cancelMfaEnrollment: (options: MutationOptions) =>
      request(
        "/identity/mfa/enrollment/cancel",
        identitySuccessSchema,
        options,
        { body: {}, credentials: options, timeoutMs: 20000 },
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
    loginUrl: (
      surface: "wallet" | "admin" | "www",
      options: { reauthenticate?: boolean; continuation?: "profile" } = {},
    ) =>
      new URL(
        `/auth/login?${new URLSearchParams({ surface, ...(options.reauthenticate ? { reauthenticate: "true" } : {}), ...(options.continuation ? { continuation: options.continuation } : {}) })}`,
        base,
      ).href,
  };
}

export type IdentityMe = Awaited<ReturnType<ReturnType<typeof createApiClient>["me"]>>;
export type IdentityMfaEnrollment = Awaited<
  ReturnType<ReturnType<typeof createApiClient>["mfaEnrollment"]>
>;
