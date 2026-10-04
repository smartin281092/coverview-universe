import {
  apiErrorSchema,
  authorizationNoticeSchema,
  authorizationNoticeOpenedInputSchema,
  lsa45NoticeVersion,
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
  documentFieldReviewInputSchema,
  documentReviewResultSchema,
  documentCategoryInputSchema,
  documentAssignProfileInputSchema,
  documentRetryInputSchema,
  documentChangeRequestsSchema,
  documentChangeRequestSchema,
  documentProfileDifferencesSchema,
  documentCompaniesSchema,
  insuranceCompanyDetailsSchema,
  insuranceCompanyIdSchema,
  managedProfilesSchema,
  managedProfileSchema,
  managedProfileCreateInputSchema,
  profileSectionSchema,
  profileSectionSaveInputSchema,
  managedProfileIdSchema,
  profileSectionNameSchema,
  documentIdentityAttachmentSchema,
  documentIdentityAttachmentInputSchema,
  documentIdentityAttachmentQuerySchema,
  adminUserIdSchema,
  adminUserSchema,
  adminUsersSchema,
  adminUsersQuerySchema,
  adminProfileContractsSchema,
  profileScopeQuerySchema,
  type ApiErrorCode,
} from "@coverview/contracts";
import type { z } from "zod";
import type { ActionStreamOptions } from "./action-stream.js";
export type { ActionStreamOptions } from "./action-stream.js";
import { clientActivityMethods } from "./client-activities.js";
import { createAdminProfileTransferClient } from "./admin-profile-transfer.js";
import {
  authorizationDocumentSchema,
  authorizationReceiptSchema,
  adminNotificationsSchema,
  adminNotificationsQuerySchema,
  authorizationSignInputSchema,
  authorizationStatusSchema,
  authorizationKindSchema,
} from "@coverview/contracts";
import {
  actionCenterIdSchema,
  actionCenterQuerySchema,
  actionCenterListSchema,
  actionCenterSummarySchema,
  actionCenterHistorySchema,
  actionCenterDetailsSchema,
  actionCenterResolveInputSchema,
  actionCenterResolveResultSchema,
  actionCenterManualReviewsSchema,
  actionCenterManualTransitionInputSchema,
  actionCenterManualReviewSchema,
} from "@coverview/contracts";
import {
  companyActionsQuerySchema,
  companyActionsSchema,
  companyActionRequestInputSchema,
  serviceRequestSchema,
  serviceRequestsQuerySchema,
  serviceRequestsSchema,
  serviceRequestTransitionInputSchema,
} from "@coverview/contracts";

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
type ProfileScope = z.infer<typeof profileScopeQuerySchema>;
const scopeParams = (scope: ProfileScope = {}) =>
  new URLSearchParams(
    Object.entries(profileScopeQuerySchema.parse(scope)).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
const adminProfilePath = (userId: string, profileId: string) =>
  `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}`;

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
    async openActionStream(options: ActionStreamOptions) {
      const { createActionStream } = await import("./action-stream.js");
      return createActionStream(base.origin, options, (code, status) => new ApiError(code, status));
    },
    ...clientActivityMethods(request),
    ...createAdminProfileTransferClient(request),
    authorizationNotice: (options?: RequestOptions) =>
      request("/identity/notices/lsa45", authorizationNoticeSchema, options, undefined, true),
    openAuthorizationNotice: (options: MutationOptions) =>
      request(
        "/identity/notices/lsa45/opened",
        authorizationNoticeSchema,
        options,
        {
          body: authorizationNoticeOpenedInputSchema.parse({ version: lsa45NoticeVersion }),
          credentials: options,
        },
        true,
      ),
    adminUsers: (query: z.input<typeof adminUsersQuerySchema> = {}, options?: RequestOptions) =>
      request(
        `/admin/users?${new URLSearchParams(
          Object.entries(adminUsersQuerySchema.parse(query))
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        )}`,
        adminUsersSchema,
        options,
        undefined,
        true,
      ),
    adminUser: (userId: string, options?: RequestOptions) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}`,
        adminUserSchema,
        options,
        undefined,
        true,
      ),
    adminProfile: (userId: string, options?: RequestOptions) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profile`,
        profileSchema,
        options,
        undefined,
        true,
      ),
    saveAdminProfile: (
      userId: string,
      input: z.infer<typeof profileSaveInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profile`,
        profileSchema,
        options,
        { body: profileSaveInputSchema.parse(input), credentials: options },
        true,
      ),
    adminProfiles: (userId: string, options?: RequestOptions) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles`,
        managedProfilesSchema,
        options,
        undefined,
        true,
      ),
    createAdminProfile: (
      userId: string,
      input: z.infer<typeof managedProfileCreateInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles`,
        managedProfileSchema,
        options,
        { body: managedProfileCreateInputSchema.parse(input), credentials: options },
        true,
      ),
    adminManagedProfile: (userId: string, profileId: string, options?: RequestOptions) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}`,
        managedProfileSchema,
        options,
        undefined,
        true,
      ),
    adminProfileSection: (
      userId: string,
      profileId: string,
      section: z.infer<typeof profileSectionNameSchema>,
      options?: RequestOptions,
    ) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/sections/${profileSectionNameSchema.parse(section)}`,
        profileSectionSchema,
        options,
        undefined,
        true,
      ),
    saveAdminProfileSection: (
      userId: string,
      profileId: string,
      section: z.infer<typeof profileSectionNameSchema>,
      input: z.infer<typeof profileSectionSaveInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/sections/${profileSectionNameSchema.parse(section)}`,
        profileSectionSchema,
        options,
        { body: profileSectionSaveInputSchema.parse(input), credentials: options },
        true,
      ),
    adminDocuments: (
      userId: string,
      profileId: string,
      query: z.infer<typeof documentListQuerySchema> = {},
      options?: RequestOptions,
    ) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/documents?${new URLSearchParams(Object.entries(documentListQuerySchema.parse(query)).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}`,
        documentListSchema,
        options,
        undefined,
        true,
      ),
    adminDocument: (userId: string, profileId: string, id: string, options?: RequestOptions) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/documents/${encodeURIComponent(id)}`,
        documentSchema,
        options,
        undefined,
        true,
      ),
    createAdminDocument: (
      userId: string,
      profileId: string,
      input: z.infer<typeof documentCreateInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/documents`,
        documentSchema,
        options,
        { body: documentCreateInputSchema.parse(input), credentials: options },
        true,
      ),
    uploadAdminDocument: (
      userId: string,
      profileId: string,
      id: string,
      file: File,
      options: MutationOptions,
    ) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/documents/${encodeURIComponent(id)}/content`,
        documentSchema,
        options,
        { body: file, credentials: options, binary: true, timeoutMs: 60000 },
        true,
      ),
    retryAdminDocument: (
      userId: string,
      profileId: string,
      id: string,
      input: z.infer<typeof documentRetryInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/documents/${encodeURIComponent(id)}/retry`,
        documentSchema,
        options,
        { body: documentRetryInputSchema.parse(input), credentials: options },
        true,
      ),
    async downloadAdminDocument(
      userId: string,
      profileId: string,
      id: string,
      options: RequestOptions = {},
    ) {
      const timeout = AbortSignal.timeout(60000);
      let response: Response;
      try {
        response = await fetch(
          new URL(
            `/admin/users/${encodeURIComponent(adminUserIdSchema.parse(userId))}/profiles/${encodeURIComponent(managedProfileIdSchema.parse(profileId))}/documents/${encodeURIComponent(id)}/download`,
            base,
          ),
          {
            credentials: "include",
            cache: "no-store",
            signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
            headers: { "X-Request-Id": crypto.randomUUID() },
          },
        );
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
    documentChangeRequests: (cursor?: string, options?: RequestOptions, scope: ProfileScope = {}) =>
      request(
        `/document-change-requests?${scopeParams(scope)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
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
    document: (id: string, options?: RequestOptions, scope: ProfileScope = {}) =>
      request(
        `/documents/${encodeURIComponent(id)}?${scopeParams(scope)}`,
        documentSchema,
        options,
        undefined,
        true,
      ),
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
    assignDocumentProfile: (
      id: string,
      input: z.infer<typeof documentAssignProfileInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/documents/${encodeURIComponent(id)}/profile`,
        documentSchema,
        options,
        { body: documentAssignProfileInputSchema.parse(input), credentials: options },
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
    updateDocumentFields: (
      id: string,
      input: z.infer<typeof documentFieldReviewInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/documents/${encodeURIComponent(id)}/fields`,
        documentSchema,
        options,
        { body: documentFieldReviewInputSchema.parse(input), credentials: options },
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
    authorization: (
      kind: "procuration" | "mandate",
      profileId = "self",
      options?: RequestOptions,
    ) =>
      request(
        `/authorizations/${authorizationKindSchema.parse(kind)}?${new URLSearchParams({ profileId: managedProfileIdSchema.parse(profileId) })}`,
        authorizationDocumentSchema,
        options,
        undefined,
        true,
      ),
    authorizationStatus: (profileId = "self", options?: RequestOptions) =>
      request(
        `/authorizations/status?${new URLSearchParams({ profileId: managedProfileIdSchema.parse(profileId) })}`,
        authorizationStatusSchema,
        options,
        undefined,
        true,
      ),
    signedAuthorization: (id: string, options?: RequestOptions) =>
      request(
        `/authorizations/receipts/${encodeURIComponent(id)}`,
        authorizationReceiptSchema,
        options,
        undefined,
        true,
      ),
    adminNotifications: (cursor?: string, options?: RequestOptions) => {
      const query = adminNotificationsQuerySchema.parse({ cursor });
      return request(
        `/admin/notifications${query.cursor ? `?${new URLSearchParams({ cursor: query.cursor })}` : ""}`,
        adminNotificationsSchema,
        options,
        undefined,
        true,
      );
    },
    signAuthorization: (
      kind: "procuration" | "mandate",
      input: z.infer<typeof authorizationSignInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/authorizations/${authorizationKindSchema.parse(kind)}/sign`,
        authorizationReceiptSchema,
        options,
        { body: authorizationSignInputSchema.parse(input), credentials: options },
        true,
      ),
    profile: (options?: RequestOptions) =>
      request("/identity/profile", profileSchema, options, undefined, true),
    identityAttachment: (
      options?: RequestOptions,
      query: z.infer<typeof documentIdentityAttachmentQuerySchema> = {},
    ) =>
      request(
        `/documents/identity-attachment${query.profileId ? `?profileId=${encodeURIComponent(documentIdentityAttachmentQuerySchema.parse(query).profileId!)}` : ""}`,
        documentIdentityAttachmentSchema,
        options,
        undefined,
        true,
      ),
    saveIdentityAttachment: (
      input: z.infer<typeof documentIdentityAttachmentInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        "/documents/identity-attachment",
        documentIdentityAttachmentSchema,
        options,
        { body: documentIdentityAttachmentInputSchema.parse(input), credentials: options },
        true,
      ),
    profiles: (options?: RequestOptions) =>
      request("/profiles", managedProfilesSchema, options, undefined, true),
    managedProfile: (id: z.infer<typeof managedProfileIdSchema>, options?: RequestOptions) =>
      request(
        `/profiles/${encodeURIComponent(managedProfileIdSchema.parse(id))}`,
        managedProfileSchema,
        options,
        undefined,
        true,
      ),
    createManagedProfile: (
      input: z.infer<typeof managedProfileCreateInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        "/profiles",
        managedProfileSchema,
        options,
        { body: managedProfileCreateInputSchema.parse(input), credentials: options },
        true,
      ),
    profileSection: (
      id: z.infer<typeof managedProfileIdSchema>,
      section: z.infer<typeof profileSectionNameSchema>,
      options?: RequestOptions,
    ) =>
      request(
        `/profiles/${encodeURIComponent(managedProfileIdSchema.parse(id))}/sections/${profileSectionNameSchema.parse(section)}`,
        profileSectionSchema,
        options,
        undefined,
        true,
      ),
    saveProfileSection: (
      id: z.infer<typeof managedProfileIdSchema>,
      section: z.infer<typeof profileSectionNameSchema>,
      input: z.infer<typeof profileSectionSaveInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/profiles/${encodeURIComponent(managedProfileIdSchema.parse(id))}/sections/${profileSectionNameSchema.parse(section)}`,
        profileSectionSchema,
        options,
        { body: profileSectionSaveInputSchema.parse(input), credentials: options },
        true,
      ),
    insuranceCompany: (
      id: z.infer<typeof insuranceCompanyIdSchema>,
      options?: RequestOptions,
      scope: ProfileScope = {},
    ) =>
      request(
        `/documents/companies/${encodeURIComponent(insuranceCompanyIdSchema.parse(id))}?${scopeParams(scope)}`,
        insuranceCompanyDetailsSchema,
        options,
        undefined,
        true,
      ),
    companyActions: (
      query: z.infer<typeof companyActionsQuerySchema> = {},
      options?: RequestOptions,
    ) => {
      const params = new URLSearchParams(
        Object.entries(companyActionsQuerySchema.parse(query)).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
      return request(`/actions?${params}`, companyActionsSchema, options, undefined, true);
    },
    actionCenter: (
      query: z.infer<typeof actionCenterQuerySchema> = {},
      options?: RequestOptions,
    ) => {
      const params = new URLSearchParams(
        Object.entries(actionCenterQuerySchema.parse(query)).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
      return request(`/action-center?${params}`, actionCenterListSchema, options, undefined, true);
    },
    actionCenterSummary: (options?: RequestOptions, scope: ProfileScope = {}) =>
      request(
        `/action-center/summary?${scopeParams(scope)}`,
        actionCenterSummarySchema,
        options,
        undefined,
        true,
      ),
    actionCenterHistory: (
      query: z.infer<typeof actionCenterQuerySchema> = {},
      options?: RequestOptions,
    ) => {
      const params = new URLSearchParams(
        Object.entries(actionCenterQuerySchema.parse(query)).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
      return request(
        `/action-center/history?${params}`,
        actionCenterHistorySchema,
        options,
        undefined,
        true,
      );
    },
    actionCenterAction: (id: string, options?: RequestOptions, scope: ProfileScope = {}) =>
      request(
        `/action-center/${encodeURIComponent(actionCenterIdSchema.parse(id))}?${scopeParams(scope)}`,
        actionCenterDetailsSchema,
        options,
        undefined,
        true,
      ),
    adminProfileContracts: (userId: string, profileId: string, options?: RequestOptions) =>
      request(
        `${adminProfilePath(userId, profileId)}/contracts`,
        adminProfileContractsSchema,
        options,
        undefined,
        true,
      ),
    adminClientActions: (
      userId: string,
      profileId: string,
      query: Omit<z.infer<typeof actionCenterQuerySchema>, "profileId"> = {},
      options?: RequestOptions,
    ) =>
      request(
        `${adminProfilePath(userId, profileId)}/action-center?${new URLSearchParams(Object.entries(actionCenterQuerySchema.omit({ profileId: true }).parse(query)).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}`,
        actionCenterListSchema,
        options,
        undefined,
        true,
      ),
    adminClientAction: (userId: string, profileId: string, id: string, options?: RequestOptions) =>
      request(
        `${adminProfilePath(userId, profileId)}/action-center/${encodeURIComponent(actionCenterIdSchema.parse(id))}`,
        actionCenterDetailsSchema,
        options,
        undefined,
        true,
      ),
    adminClientActionHistory: (
      userId: string,
      profileId: string,
      query: Omit<z.infer<typeof actionCenterQuerySchema>, "profileId"> = {},
      options?: RequestOptions,
    ) =>
      request(
        `${adminProfilePath(userId, profileId)}/action-center/history?${new URLSearchParams(Object.entries(actionCenterQuerySchema.omit({ profileId: true }).parse(query)).filter((entry): entry is [string, string] => typeof entry[1] === "string"))}`,
        actionCenterHistorySchema,
        options,
        undefined,
        true,
      ),
    resolveActionCenter: (
      id: string,
      input: z.infer<typeof actionCenterResolveInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        `/action-center/${encodeURIComponent(actionCenterIdSchema.parse(id))}/resolve`,
        actionCenterResolveResultSchema,
        options,
        { body: actionCenterResolveInputSchema.parse(input), credentials: options },
        true,
      ),
    actionManualReviews: (
      query: Pick<z.infer<typeof actionCenterQuerySchema>, "cursor"> = {},
      options?: RequestOptions,
    ) => {
      const params = new URLSearchParams(
        Object.entries(actionCenterQuerySchema.pick({ cursor: true }).parse(query)).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
      return request(
        `/admin/action-reviews?${params}`,
        actionCenterManualReviewsSchema,
        options,
        undefined,
        true,
      );
    },
    transitionActionManualReview: (
      input: z.infer<typeof actionCenterManualTransitionInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        "/admin/action-reviews/transition",
        actionCenterManualReviewSchema,
        options,
        { body: actionCenterManualTransitionInputSchema.parse(input), credentials: options },
        true,
      ),
    requestCompanyAction: (
      input: z.infer<typeof companyActionRequestInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        "/actions/request",
        serviceRequestSchema,
        options,
        { body: companyActionRequestInputSchema.parse(input), credentials: options },
        true,
      ),
    serviceRequests: (
      query: z.infer<typeof serviceRequestsQuerySchema> = {},
      options?: RequestOptions,
    ) => {
      const params = new URLSearchParams(
        Object.entries(serviceRequestsQuerySchema.parse(query)).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
      return request(
        `/admin/service-requests?${params}`,
        serviceRequestsSchema,
        options,
        undefined,
        true,
      );
    },
    transitionServiceRequest: (
      input: z.infer<typeof serviceRequestTransitionInputSchema>,
      options: MutationOptions,
    ) =>
      request(
        "/admin/service-requests/transition",
        serviceRequestSchema,
        options,
        { body: serviceRequestTransitionInputSchema.parse(input), credentials: options },
        true,
      ),
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
      surface: "wallet" | "admin" | "www" | "partners",
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
