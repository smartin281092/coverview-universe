import { AuthenticateWithSessionCookieFailureReason, WorkOS } from "@workos-inc/node";
import { z } from "zod";
import type { Environment } from "../../platform/config.js";
import {
  IdentityError,
  identityFailureDiagnostic,
  type IdentityDiagnostic,
} from "./identity.security.js";

const remoteSessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  status: z.enum(["active", "expired", "revoked"]),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  authMethod: z.string(),
});
export type RemoteSession = z.infer<typeof remoteSessionSchema>;
export type RemoteIdentity = { workosUserId: string; email: string; workosSessionId: string };

// This adapter is the only external identity boundary. Test doubles never enter runtime config.
export interface IdentityProvider {
  authorization(): Promise<{ url: string; state: string; codeVerifier: string }>;
  exchange(code: string, verifier: string): Promise<RemoteIdentity>;
  sessions(userId: string, signal?: AbortSignal): Promise<RemoteSession[]>;
  revoke(sessionId: string, signal?: AbortSignal): Promise<void>;
  challenge(userId: string): Promise<{ challengeId: string; factorId: string; expiresAt: Date }>;
  verify(challengeId: string, factorId: string, code: string): Promise<boolean>;
}

export function createWorkosProvider(config: Environment): IdentityProvider {
  if (!config.WORKOS_API_KEY || !config.WORKOS_CLIENT_ID)
    throw new Error("Missing WorkOS server configuration");
  const clientId = config.WORKOS_CLIENT_ID;
  const options = {
    apiKey: config.WORKOS_API_KEY,
    clientId: config.WORKOS_CLIENT_ID,
    timeout: config.WORKOS_TIMEOUT_MS,
    maxRetries: 0,
  };
  const workos = new WorkOS(options);
  function withSignal(signal?: AbortSignal) {
    if (!signal) return workos;
    return new WorkOS({
      ...options,
      fetchFn: (url, init) =>
        fetch(url, {
          ...init,
          signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal,
        }),
    });
  }
  const cookiePassword = config.AUTH_SESSION_SECRET;
  if (!cookiePassword) throw new Error("Missing authentication server key");

  async function external<T>(
    operation: () => Promise<T> | T,
    stage: IdentityDiagnostic["stage"],
  ): Promise<T> {
    try {
      return await operation();
    } catch (cause) {
      if (cause instanceof IdentityError && cause.diagnostic) throw cause;
      throw new IdentityError(
        cause instanceof IdentityError ? cause.code : "IDENTITY_UNAVAILABLE",
        cause instanceof IdentityError ? cause.statusCode : 503,
        { cause, diagnostic: identityFailureDiagnostic(cause, stage) },
      );
    }
  }
  function invalid(
    stage: IdentityDiagnostic["stage"],
    reason: IdentityDiagnostic["reason"],
    details: Partial<
      Pick<IdentityDiagnostic, "configuredIssuer" | "tokenIssuer" | "issuerMatches">
    > = {},
  ) {
    return new IdentityError("IDENTITY_INVALID_CALLBACK", 400, {
      diagnostic: { stage, reason, ...details },
    });
  }
  function issuerKind(value: string): NonNullable<IdentityDiagnostic["configuredIssuer"]> {
    if (!URL.canParse(value)) return "other";
    const url = new URL(value);
    if (url.href === "https://api.workos.com/") return "generic";
    if (url.href === `https://api.workos.com/user_management/${clientId}`) return "app";
    return url.protocol === "https:" &&
      url.hostname !== "api.workos.com" &&
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? "custom"
      : "other";
  }
  return {
    authorization: () =>
      external(
        () =>
          workos.userManagement.getAuthorizationUrlWithPKCE({
            provider: "authkit",
            redirectUri: `${config.AUTH_API_ORIGIN}/auth/callback`,
            screenHint: "sign-in",
          }),
        "authorization",
      ),
    exchange: (code, codeVerifier) =>
      external(async () => {
        let result;
        try {
          result = await workos.userManagement.authenticateWithCode({
            code,
            codeVerifier,
            session: { sealSession: true, cookiePassword },
          });
        } catch (cause) {
          if (
            typeof cause === "object" &&
            cause !== null &&
            "status" in cause &&
            cause.status === 400
          ) {
            throw new IdentityError("IDENTITY_INVALID_CALLBACK", 400, {
              cause,
              diagnostic: identityFailureDiagnostic(cause, "code_exchange"),
            });
          }
          throw cause;
        }
        const sealedSession = result.sealedSession;
        if (!sealedSession) throw invalid("sealed_session", "session_missing");
        // Verify the provider JWT using its official helper; keep all returned tokens in memory only.
        const verified = await external(
          () =>
            workos.userManagement
              .loadSealedSession({
                sessionData: sealedSession,
                cookiePassword,
              })
              .authenticate(),
          "session_authentication",
        );
        if (!verified.authenticated)
          throw invalid(
            "session_authentication",
            verified.reason === AuthenticateWithSessionCookieFailureReason.INVALID_JWT
              ? "invalid_jwt"
              : "invalid_session",
          );
        if (verified.impersonator) throw invalid("session_authentication", "impersonation");
        if (!verified.user.emailVerified)
          throw invalid("session_authentication", "email_unverified");
        // The SDK checks signature/time; also bind the verified JWT claims to this issuer and identity.
        const claims = await external(
          () =>
            z
              .object({
                sub: z.string(),
                sid: z.string(),
                iss: z.url(),
                exp: z.number(),
                iat: z.number(),
                aud: z.union([z.string(), z.array(z.string())]).optional(),
              })
              .safeParse(
                JSON.parse(
                  Buffer.from(result.accessToken.split(".")[1] ?? "", "base64url").toString("utf8"),
                ),
              ),
          "token_claims",
        );
        if (!claims.success) throw invalid("token_claims", "claims_invalid");
        if (claims.data.sub !== verified.user.id) throw invalid("token_claims", "subject_mismatch");
        if (claims.data.sid !== verified.sessionId)
          throw invalid("token_claims", "session_mismatch");
        if (new URL(claims.data.iss).href !== new URL(config.WORKOS_ISSUER).href)
          throw invalid("token_claims", "issuer_mismatch", {
            configuredIssuer: issuerKind(config.WORKOS_ISSUER),
            tokenIssuer: issuerKind(claims.data.iss),
            issuerMatches: false,
          });
        if (claims.data.exp <= Date.now() / 1000) throw invalid("token_claims", "token_expired");
        if (claims.data.iat > Date.now() / 1000 + 30) throw invalid("token_claims", "token_future");
        if (claims.data.aud && ![claims.data.aud].flat().includes(clientId))
          throw invalid("token_claims", "audience_mismatch");
        const identity = z
          .object({
            workosUserId: z.string().min(1),
            email: z.email(),
            workosSessionId: z.string().min(1),
          })
          .safeParse({
            workosUserId: verified.user.id,
            email: verified.user.email,
            workosSessionId: verified.sessionId,
          });
        if (!identity.success) throw invalid("token_claims", "identity_invalid");
        return identity.data;
      }, "code_exchange"),
    sessions: (userId, signal) =>
      external(async () => {
        const page = await withSignal(signal).userManagement.listSessions(userId, { limit: 100 });
        // A truncated list cannot establish global revocation or reliably validate the current session.
        if (page.listMetadata.after)
          throw new IdentityError("IDENTITY_UNAVAILABLE", 503, {
            diagnostic: { stage: "remote_sessions", reason: "sessions_truncated" },
          });
        const parsed = z.array(remoteSessionSchema).max(100).safeParse(page.data);
        if (!parsed.success)
          throw new IdentityError("IDENTITY_UNAVAILABLE", 503, {
            cause: parsed.error,
            diagnostic: { stage: "remote_sessions", reason: "sessions_invalid" },
          });
        const sessions = parsed.data;
        if (sessions.some((session) => session.userId !== userId))
          throw new IdentityError("IDENTITY_UNAVAILABLE", 503, {
            diagnostic: { stage: "remote_sessions", reason: "session_owner_mismatch" },
          });
        return sessions.filter(
          (session) => session.status === "active" && Date.parse(session.expiresAt) > Date.now(),
        );
      }, "remote_sessions"),
    revoke: (sessionId, signal) =>
      external(async () => {
        try {
          await withSignal(signal).userManagement.revokeSession({ sessionId });
        } catch (cause) {
          // An already-removed session has reached the intended state. All other errors remain visible.
          if (
            typeof cause === "object" &&
            cause !== null &&
            "status" in cause &&
            cause.status === 404
          )
            return;
          throw cause;
        }
      }, "remote_revocation"),
    challenge: (userId) =>
      external(async () => {
        const page = await workos.multiFactorAuth.listUserAuthFactors({ userId, limit: 10 });
        if (page.listMetadata.after) throw new IdentityError("IDENTITY_UNAVAILABLE", 503);
        const factors = z
          .array(z.object({ id: z.string().min(1), userId: z.string(), type: z.string() }))
          .max(10)
          .parse(page.data);
        if (factors.some((factor) => factor.userId !== userId))
          throw new IdentityError("IDENTITY_UNAVAILABLE", 503);
        const factor = factors.find((item) => item.type === "totp");
        if (!factor) throw new IdentityError("IDENTITY_MFA_NOT_ENROLLED", 403);
        const result = await workos.multiFactorAuth.challengeFactor({
          authenticationFactorId: factor.id,
        });
        const challenge = z
          .object({
            id: z.string().min(1),
            authenticationFactorId: z.string(),
            expiresAt: z.iso.datetime().optional(),
          })
          .parse(result);
        if (challenge.authenticationFactorId !== factor.id)
          throw new IdentityError("IDENTITY_UNAVAILABLE", 503);
        return {
          challengeId: challenge.id,
          factorId: factor.id,
          expiresAt: new Date(
            Math.min(
              Date.now() + 5 * 60_000,
              challenge.expiresAt ? Date.parse(challenge.expiresAt) : Number.POSITIVE_INFINITY,
            ),
          ),
        };
      }, "mfa_challenge"),
    verify: (challengeId, factorId, code) =>
      external(async () => {
        let raw;
        try {
          raw = await workos.multiFactorAuth.verifyChallenge({
            authenticationChallengeId: challengeId,
            code,
          });
        } catch (cause) {
          if (
            typeof cause === "object" &&
            cause !== null &&
            "status" in cause &&
            [400, 422].includes(Number(cause.status))
          )
            return false;
          throw cause;
        }
        const result = z
          .object({
            valid: z.boolean(),
            challenge: z.object({ id: z.string(), authenticationFactorId: z.string() }),
          })
          .parse(raw);
        return (
          result.valid &&
          result.challenge.id === challengeId &&
          result.challenge.authenticationFactorId === factorId
        );
      }, "mfa_verification"),
  };
}
