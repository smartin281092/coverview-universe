import { z } from "zod";
import { documentErrorCodes } from "./documents.js";
export * from "./profile.js";
export * from "./companies.js";
export * from "./documents.js";

export const livenessSchema = z.object({ status: z.literal("alive") });
export const readinessSchema = z.object({ status: z.enum(["ready", "not_ready"]) });
export const platformErrorCodeSchema = z.enum([
  "PLATFORM_INVALID_REQUEST",
  "PLATFORM_NOT_FOUND",
  "PLATFORM_NOT_READY",
  "PLATFORM_INTERNAL_ERROR",
  "PLATFORM_REQUEST_FAILED",
  "PLATFORM_INVALID_RESPONSE",
]);
export const identityErrorCodeSchema = z.enum([
  "IDENTITY_INVALID_CALLBACK",
  "IDENTITY_UNAUTHENTICATED",
  "IDENTITY_ACCESS_DENIED",
  "IDENTITY_MFA_REQUIRED",
  "IDENTITY_UNAVAILABLE",
  "IDENTITY_CSRF_INVALID",
  "IDENTITY_NOT_FOUND",
  "IDENTITY_RATE_LIMITED",
  "IDENTITY_MFA_NOT_ENROLLED",
  "IDENTITY_MFA_INVALID",
  "IDENTITY_MFA_ENROLLMENT_CONFLICT",
  "IDENTITY_REAUTHENTICATION_REQUIRED",
  "PROFILE_CONFLICT",
  "PROFILE_DRAFT_EXPIRED",
  "PROFILE_DRAFT_ATTACHED",
  "PROFILE_IDEMPOTENCY_REUSED",
  "PROFILE_CONFIRMATION_REQUIRED",
  "PROFILE_INVALID_BIRTH_DATE",
]);
export const apiErrorCodeSchema = z.union([
  platformErrorCodeSchema,
  identityErrorCodeSchema,
  z.enum(documentErrorCodes),
]);
export const apiErrorSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    requestId: z.string(),
  }),
});

const identityIdSchema = z.string().min(1).max(200);
export const identityConfigSchema = z.object({ enabled: z.boolean() });
export const identityMeSchema = z.object({
  user: z.object({ id: identityIdSchema, email: z.email() }),
  session: z.object({ id: identityIdSchema, expiresAt: z.iso.datetime() }),
  csrfToken: z.string().min(1).max(512),
  permissions: z.array(z.string().min(1).max(200)).max(100),
});
export const identityWorkspaceSchema = z.object({ ownerId: identityIdSchema, email: z.email() });
export const identityAdminSchema = z.object({ userId: identityIdSchema });
export const identitySessionsSchema = z.object({
  sessions: z
    .array(
      z.object({
        id: identityIdSchema,
        device: z.string().min(1).max(500),
        createdAt: z.iso.datetime(),
        lastSeenAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
        isCurrent: z.boolean(),
      }),
    )
    .max(20),
  nextCursor: z.string().min(1).max(500).nullable(),
});
export const identityLogoutInputSchema = z.object({ scope: z.enum(["current", "all"]) }).strict();
export const identityRevokeInputSchema = z.object({}).strict();
export const identitySuccessSchema = z.object({ success: z.literal(true) });
export const identityLogoutSchema = identitySuccessSchema.extend({
  remoteRevocation: z.enum(["complete", "pending"]),
});
export const identityMfaChallengeSchema = z.object({ expiresAt: z.iso.datetime() });
// The QR is delivered once to the enrolling user; it must never enter persistent application state.
export const identityMfaEnrollmentStartSchema = identityMfaChallengeSchema.extend({
  qrCode: z
    .string()
    .max(262144)
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/),
});
export const identityMfaEnrollmentSchema = z.object({
  state: z.enum(["available", "pending", "confirmed", "recovery"]),
  expiresAt: z.iso.datetime().nullable(),
  canConfirm: z.boolean(),
  canRestart: z.boolean(),
  canCancel: z.boolean(),
  reason: z.enum(["operation_pending", "operation_uncertain", "existing_factor"]).nullable(),
});
export const identityMfaVerifyInputSchema = z
  .object({ code: z.string().regex(/^\d{6}$/) })
  .strict();

export type IdentityMe = z.infer<typeof identityMeSchema>;
export type IdentityMfaEnrollment = z.infer<typeof identityMfaEnrollmentSchema>;
export type IdentityErrorCode = z.infer<typeof identityErrorCodeSchema>;
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

export const localPersonaSchema = z.object({
  id: z.string().startsWith("fixture_"),
  email: z.email().endsWith(".test"),
  org: z.string().min(1),
  role: z.literal("preview"),
  state: z.literal("fixture"),
  tests: z.array(z.string()).min(1).max(10),
  access: z.literal("local-selector"),
});
export const localPersonasSchema = z.object({
  mode: z.literal("local-fixture"),
  personas: z.array(localPersonaSchema).max(10),
});

export type Readiness = z.infer<typeof readinessSchema>;
export type LocalPersona = z.infer<typeof localPersonaSchema>;
export type PlatformErrorCode = z.infer<typeof platformErrorCodeSchema>;
