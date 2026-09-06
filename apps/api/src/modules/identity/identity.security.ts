import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type { IdentityErrorCode } from "@coverview/contracts";
import { z } from "zod";

const identityDiagnosticSchema = z.object({
  stage: z.enum([
    "authorization",
    "callback_code",
    "verifier_decryption",
    "code_exchange",
    "sealed_session",
    "session_authentication",
    "token_claims",
    "remote_sessions",
    "reconciliation",
    "persistence",
    "remote_revocation",
    "mfa_challenge",
    "mfa_verification",
    "mfa_enrollment",
  ]),
  reason: z.enum([
    "operation_failed",
    "code_missing",
    "session_missing",
    "invalid_jwt",
    "invalid_session",
    "impersonation",
    "email_unverified",
    "claims_invalid",
    "subject_mismatch",
    "session_mismatch",
    "issuer_mismatch",
    "token_expired",
    "token_future",
    "audience_mismatch",
    "identity_invalid",
    "sessions_truncated",
    "sessions_invalid",
    "session_owner_mismatch",
    "session_not_active",
    "session_creation_refused",
  ]),
  providerStatus: z.number().int().min(100).max(599).optional(),
  configuredIssuer: z.enum(["generic", "app", "custom", "other"]).optional(),
  tokenIssuer: z.enum(["generic", "app", "custom", "other"]).optional(),
  issuerMatches: z.boolean().optional(),
});
export type IdentityDiagnostic = z.infer<typeof identityDiagnosticSchema>;

// Rebuild from a closed schema at the logging boundary: no error messages, claims or arbitrary keys.
export function identityFailureDiagnostic(
  cause: unknown,
  stage: IdentityDiagnostic["stage"],
  reason: IdentityDiagnostic["reason"] = "operation_failed",
): IdentityDiagnostic {
  const supplied =
    cause instanceof IdentityError
      ? identityDiagnosticSchema.safeParse(cause.diagnostic)
      : undefined;
  if (supplied?.success) return supplied.data;
  const status =
    typeof cause === "object" && cause !== null && "status" in cause ? cause.status : undefined;
  return {
    stage,
    reason,
    ...(typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
      ? { providerStatus: status }
      : {}),
  };
}

export class IdentityError extends Error {
  readonly diagnostic: IdentityDiagnostic | undefined;
  constructor(
    readonly code: IdentityErrorCode,
    readonly statusCode: number,
    options?: ErrorOptions & { diagnostic?: IdentityDiagnostic },
  ) {
    super(code, options);
    this.name = "IdentityError";
    this.diagnostic = options?.diagnostic;
  }
}

export function randomSecret() {
  return randomBytes(32).toString("base64url");
}
export function secretHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function csrfToken(secret: string, sessionToken: string) {
  return createHmac("sha256", Buffer.from(secret, "base64"))
    .update(`csrf:${sessionToken}`)
    .digest("base64url");
}
export function matchesSecret(value: string, expected: string) {
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function encryptVerifier(value: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(secret, "base64"), iv);
  cipher.setAAD(Buffer.from("coverview:pkce:v1"));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function decryptVerifier(value: string, secret: string) {
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(secret, "base64"),
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from("coverview:pkce:v1"));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString("utf8");
}
