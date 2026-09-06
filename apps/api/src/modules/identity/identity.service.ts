import type { Environment } from "../../platform/config.js";
import type { createIdentityRepository, IdentitySession } from "./identity.repository.js";
import {
  csrfToken,
  decryptVerifier,
  encryptVerifier,
  IdentityError,
  identityFailureDiagnostic,
  randomSecret,
  secretHash,
  type IdentityDiagnostic,
} from "./identity.security.js";
import type { IdentityProvider, RemoteIdentity } from "./identity.workos.js";

type Repository = ReturnType<typeof createIdentityRepository>;
type Surface = "wallet" | "admin" | "www";
export type IdentityService = ReturnType<typeof createIdentityService>;

export function requireAdministration(session: IdentitySession, requireMfa = true) {
  if (!session.hasAdminPermission) throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
  if (
    requireMfa &&
    (!session.mfaVerifiedAt || Date.now() - session.mfaVerifiedAt.getTime() >= 15 * 60_000)
  ) {
    throw new IdentityError("IDENTITY_MFA_REQUIRED", 403);
  }
}

export function createIdentityService(
  config: Environment,
  repository: Repository,
  provider: IdentityProvider,
  report: (code: string) => void,
) {
  const secret = config.AUTH_SESSION_SECRET;
  if (!secret) throw new Error("Authentication server key is required");
  const destinations = {
    wallet: config.AUTH_WALLET_ORIGIN,
    admin: config.AUTH_ADMIN_ORIGIN,
    www: config.AUTH_WWW_ORIGIN,
  };

  async function localSession(token: string | undefined, includeRevoked = false) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
    const session = await repository.getSession(secretHash(token), new Date(), { includeRevoked });
    if (!session || (!includeRevoked && session.globalRevocationPending))
      throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
    return session;
  }
  async function authenticate(token: string | undefined) {
    const session = await localSession(token);
    const active = await provider.sessions(session.workosUserId);
    if (!active.some((remote) => remote.id === session.workosSessionId)) {
      await repository.revokeSession(session.userId, session.id, "provider_revocation");
      await repository.markRemoteRevoked(session.workosSessionId, session.userId);
      throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
    }
    // A logout/permission change while the network request was in flight must win.
    return localSession(token);
  }
  async function revokeRemote(
    userId: string,
    workosUserId: string,
    sessionIds?: string[],
    cutoff?: Date,
    excludedSessionId?: string,
  ) {
    const deadline = AbortSignal.timeout(8000);
    const active = await provider.sessions(workosUserId, deadline);
    const pending = await repository.listPendingRevocations(userId, 100);
    // Filter by the bounded remote set, so older inactive rows cannot hide a still-active target.
    const activePending = await repository.listPendingRevocations(
      userId,
      100,
      active.map((item) => item.id),
    );
    const selected = active.filter(
      (item) =>
        item.id !== excludedSessionId &&
        (!sessionIds || sessionIds.includes(item.id)) &&
        (!cutoff ||
          Date.parse(item.createdAt) <= cutoff.getTime() ||
          activePending.some((local) => local.workosSessionId === item.id)),
    );
    // Bounded provider list; batches prevent a revocation operation from creating unbounded concurrency.
    for (let offset = 0; offset < selected.length; offset += 10) {
      deadline.throwIfAborted();
      const batch = selected.slice(offset, offset + 10);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          await provider.revoke(item.id, deadline);
          await repository.markRemoteRevoked(item.id, userId);
        }),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") throw failure.reason;
    }
    for (const item of pending) {
      if (!active.some((remote) => remote.id === item.workosSessionId))
        await repository.markRemoteRevoked(item.workosSessionId, userId);
    }
  }
  async function reconcilePending(identity: RemoteIdentity) {
    const user = await repository.getUserByWorkosId(identity.workosUserId);
    if (!user) return;
    if (user.globalRevocationPending && user.globalRevocationId) {
      // Exclude the newly authenticated session: the old local sessions are already revoked.
      if (!user.lastGlobalLogoutAt) throw new IdentityError("IDENTITY_UNAVAILABLE", 503);
      await revokeRemote(
        user.id,
        identity.workosUserId,
        undefined,
        user.lastGlobalLogoutAt,
        identity.workosSessionId,
      );
      await repository.completeGlobalRevocation(user.id, user.globalRevocationId);
    }
    const pending = await repository.listPendingRevocations(user.id, 100);
    if (pending.length)
      await revokeRemote(
        user.id,
        identity.workosUserId,
        pending.map((item) => item.workosSessionId),
      );
  }

  return {
    authenticate,
    logoutSession: (token: string | undefined) => localSession(token, true),
    csrf: (token: string) => csrfToken(secret, token),
    async login(surface: Surface) {
      const authorization = await provider.authorization();
      const browserNonce = randomSecret();
      const now = new Date();
      await repository.createLogin({
        stateHash: secretHash(authorization.state),
        browserHash: secretHash(browserNonce),
        encryptedVerifier: encryptVerifier(authorization.codeVerifier, secret),
        surface: surface === "wallet" ? "client" : surface,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 10 * 60_000),
      });
      return { url: authorization.url, browserNonce };
    },
    async callback(
      code: string | undefined,
      state: string,
      browserNonce: string | undefined,
      device: string,
      requestId: string,
    ) {
      if (!browserNonce || !/^[A-Za-z0-9_-]{43}$/.test(browserNonce))
        throw new IdentityError("IDENTITY_INVALID_CALLBACK", 400);
      const transaction = await repository.consumeLogin(
        secretHash(state),
        secretHash(browserNonce),
        new Date(),
      );
      if (!transaction) throw new IdentityError("IDENTITY_INVALID_CALLBACK", 400);
      const surface = transaction.surface === "client" ? "wallet" : transaction.surface;
      const destination = `${destinations[surface]}/account`;
      let stage: IdentityDiagnostic["stage"] = "callback_code";
      try {
        if (!code)
          throw new IdentityError("IDENTITY_INVALID_CALLBACK", 400, {
            diagnostic: { stage, reason: "code_missing" },
          });
        stage = "verifier_decryption";
        const verifier = decryptVerifier(transaction.encryptedVerifier, secret);
        stage = "code_exchange";
        const identity = await provider.exchange(code, verifier);
        stage = "reconciliation";
        await reconcilePending(identity);
        stage = "remote_sessions";
        const remote = (await provider.sessions(identity.workosUserId)).find(
          (item) => item.id === identity.workosSessionId,
        );
        if (!remote)
          throw new IdentityError("IDENTITY_INVALID_CALLBACK", 400, {
            diagnostic: { stage, reason: "session_not_active" },
          });
        const token = randomSecret();
        stage = "persistence";
        const session = await repository.createSession({
          ...identity,
          tokenHash: secretHash(token),
          device: device.slice(0, 256) || "Browser",
          loginStartedAt: transaction.createdAt,
          requestId,
          expiresAt: new Date(
            Math.min(
              Date.now() + config.AUTH_SESSION_TTL_SECONDS * 1000,
              Date.parse(remote.expiresAt),
            ),
          ),
        });
        if (!session) {
          await provider.revoke(identity.workosSessionId);
          throw new IdentityError("IDENTITY_INVALID_CALLBACK", 400, {
            diagnostic: { stage, reason: "session_creation_refused" },
          });
        }
        return { success: true as const, token, session, destination };
      } catch (cause) {
        // Only a consumed, browser-bound transaction may select a fixed recovery surface.
        return {
          success: false as const,
          destination: `${destination}?authError=callback`,
          code: cause instanceof IdentityError ? cause.code : "IDENTITY_UNAVAILABLE",
          diagnostic: identityFailureDiagnostic(cause, stage),
        };
      }
    },
    async listSessions(session: IdentitySession, cursor?: string) {
      const result = await repository.listSessions(session.userId, session.id, cursor);
      return {
        sessions: result.sessions.map((item) => ({
          id: item.id,
          device: item.device,
          createdAt: item.createdAt.toISOString(),
          lastSeenAt: item.lastSeenAt.toISOString(),
          expiresAt: item.expiresAt.toISOString(),
          isCurrent: item.current,
        })),
        nextCursor: result.nextCursor,
      };
    },
    async revoke(session: IdentitySession, sessionId: string, requestId: string) {
      const target = await repository.revokeSession(session.userId, sessionId, requestId);
      if (!target) throw new IdentityError("IDENTITY_NOT_FOUND", 404);
      await revokeRemote(session.userId, session.workosUserId, [target.workosSessionId]);
    },
    async logout(session: IdentitySession, scope: "current" | "all", requestId: string) {
      const global =
        scope === "all"
          ? await repository.revokeAll(session.userId, requestId, session.id)
          : undefined;
      if (scope === "all" && !global) throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
      if (
        session.revokedAt &&
        ((scope === "all" && !session.globalRevocationPending) ||
          (scope === "current" && !session.remoteRevocationPending))
      )
        return "complete" as const;
      if (scope === "current")
        await repository.revokeSession(session.userId, session.id, requestId);
      try {
        await revokeRemote(
          session.userId,
          session.workosUserId,
          scope === "current" ? [session.workosSessionId] : undefined,
          global?.cutoff,
        );
        if (global) await repository.completeGlobalRevocation(session.userId, global.revocationId);
        return "complete" as const;
      } catch (cause) {
        // Local denial is already durable. The retained cookie authorizes only this logout retry.
        report(cause instanceof IdentityError ? cause.code : "IDENTITY_UNAVAILABLE");
        return "pending" as const;
      }
    },
    async challenge(session: IdentitySession) {
      requireAdministration(session, false);
      const challenge = await provider.challenge(session.workosUserId);
      const saved = await repository.saveChallenge(
        session.id,
        challenge.challengeId,
        challenge.factorId,
        challenge.expiresAt,
      );
      if (!saved) throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
      return { expiresAt: challenge.expiresAt.toISOString() };
    },
    async verify(token: string, session: IdentitySession, code: string, requestId: string) {
      requireAdministration(session, false);
      const challenge = await repository.consumeChallenge(session.id);
      if (!challenge || challenge.expiresAt.getTime() <= Date.now())
        throw new IdentityError("IDENTITY_MFA_INVALID", 400);
      const valid = await provider.verify(challenge.challengeId, challenge.factorId, code);
      if (!valid) throw new IdentityError("IDENTITY_MFA_INVALID", 400);
      const fresh = await authenticate(token);
      if (challenge.expiresAt.getTime() <= Date.now())
        throw new IdentityError("IDENTITY_MFA_INVALID", 400);
      requireAdministration(fresh, false);
      const newToken = randomSecret();
      const elevated = await repository.markMfaVerified(
        session.id,
        new Date(),
        secretHash(newToken),
        requestId,
      );
      if (!elevated) throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
      return { token: newToken, session: elevated };
    },
  };
}
