import type { IdentityMfaEnrollment } from "@coverview/contracts";
import type { IdentityRepository, IdentitySession } from "./identity.repository.js";
import { enrollmentOperationTimeoutMs } from "./identity.enrollment.repository.js";
import { IdentityError, randomSecret, secretHash } from "./identity.security.js";
import type { IdentityProvider } from "./identity.workos.js";

function conflict(): never {
  throw new IdentityError("IDENTITY_MFA_ENROLLMENT_CONFLICT", 409);
}
function requireRecentAuthentication(session: IdentitySession) {
  if (!session.authenticatedAt || Date.now() - session.authenticatedAt.getTime() >= 10 * 60_000)
    throw new IdentityError("IDENTITY_REAUTHENTICATION_REQUIRED", 403);
}

export function createEnrollmentService(
  repository: IdentityRepository,
  provider: IdentityProvider,
  authenticate: (token: string | undefined) => Promise<IdentitySession>,
) {
  return {
    async enrollment(token: string, session: IdentitySession): Promise<IdentityMfaEnrollment> {
      const factors = await provider.factors(session.workosUserId);
      await authenticate(token);
      const row = await repository.getEnrollment(session.userId);
      const state: IdentityMfaEnrollment = {
        state: "recovery",
        expiresAt: null,
        canConfirm: false,
        canRestart: false,
        canCancel: false,
        reason: "operation_uncertain",
      };
      if (!row || row.status === "cancelled") {
        return factors.length
          ? { ...state, reason: "existing_factor" }
          : { ...state, state: "available", reason: null };
      }
      if (row.status === "confirmed") {
        return factors.some((factor) => factor.id === row.factorId && factor.type === "totp")
          ? { ...state, state: "confirmed", reason: null }
          : state;
      }
      const busy = ["creating", "challenging", "verifying", "cancelling"].includes(row.status);
      if (busy && row.updatedAt.getTime() + enrollmentOperationTimeoutMs > Date.now())
        return { ...state, reason: "operation_pending" };
      if (!row.factorId) return state;
      if (row.status === "pending") {
        const expiresAt = row.challengeExpiresAt;
        return {
          ...state,
          state: "pending",
          reason: null,
          expiresAt: expiresAt?.toISOString() ?? null,
          canConfirm: Boolean(
            row.sessionId === session.id &&
            row.challengeId &&
            expiresAt &&
            expiresAt.getTime() > Date.now(),
          ),
          canRestart: true,
          canCancel: !row.verificationUncertain,
        };
      }
      if (row.status === "challenging" || row.status === "verifying" || row.verificationUncertain)
        return { ...state, canRestart: true };
      return { ...state, canCancel: row.status === "cancelling" || row.status === "recovery" };
    },
    async startEnrollment(token: string, session: IdentitySession, requestId: string) {
      requireRecentAuthentication(session);
      if ((await provider.factors(session.workosUserId)).length) conflict();
      const fresh = await authenticate(token);
      requireRecentAuthentication(fresh);
      const reservation = await repository.reserveEnrollment(fresh, requestId);
      if (!reservation) conflict();
      let created;
      try {
        created = await provider.enroll(fresh.workosUserId, fresh.email);
        const expiresAt = new Date(
          Math.min(created.expiresAt.getTime(), fresh.expiresAt.getTime()),
        );
        if (
          !(await repository.saveEnrollmentCreated(
            reservation,
            created.factorId,
            created.challengeId,
            expiresAt,
          ))
        )
          conflict();
        created.expiresAt = expiresAt;
      } catch (cause) {
        // A lost provider response may have created a credential. Never automatically create another one.
        await repository.failEnrollmentCreation(reservation);
        throw cause;
      }
      await authenticate(token);
      if (created.expiresAt.getTime() <= Date.now())
        throw new IdentityError("IDENTITY_MFA_INVALID", 400);
      return { qrCode: created.qrCode, expiresAt: created.expiresAt.toISOString() };
    },
    async challengeEnrollment(token: string, session: IdentitySession, requestId: string) {
      const claimed = await repository.claimEnrollment(session, "challenging", requestId);
      if (!claimed?.factorId) conflict();
      try {
        const challenge = await provider.challengeEnrollment(
          session.workosUserId,
          claimed.factorId,
        );
        const fresh = await authenticate(token);
        const expiresAt = new Date(
          Math.min(challenge.expiresAt.getTime(), fresh.expiresAt.getTime()),
        );
        if (!(await repository.saveEnrollmentChallenge(claimed, challenge.challengeId, expiresAt)))
          conflict();
        return { expiresAt: expiresAt.toISOString() };
      } catch (cause) {
        await repository.failEnrollmentChallenge(claimed);
        throw cause;
      }
    },
    async confirmEnrollment(
      token: string,
      session: IdentitySession,
      code: string,
      requestId: string,
    ) {
      const claimed = await repository.claimEnrollment(session, "verifying", requestId);
      if (!claimed?.factorId || !claimed.challengeId || !claimed.challengeExpiresAt) conflict();
      let valid;
      try {
        valid = await provider.verify(claimed.challengeId, claimed.factorId, code);
      } catch (cause) {
        await repository.failEnrollmentVerification(claimed, true);
        throw cause;
      }
      if (!valid) {
        await repository.failEnrollmentVerification(claimed, false);
        throw new IdentityError("IDENTITY_MFA_INVALID", 400);
      }
      let fresh;
      try {
        fresh = await authenticate(token);
        if (claimed.challengeExpiresAt.getTime() <= Date.now())
          throw new IdentityError("IDENTITY_MFA_INVALID", 400);
      } catch (cause) {
        await repository.failEnrollmentVerification(claimed, true);
        throw cause;
      }
      if (!(await repository.finishEnrollment(claimed, "confirmed", requestId))) conflict();
      const newToken = randomSecret();
      if (!(await repository.rotateEnrollmentSession(fresh, secretHash(newToken))))
        throw new IdentityError("IDENTITY_UNAUTHENTICATED", 401);
      return { token: newToken, session: fresh };
    },
    async cancelEnrollment(token: string, session: IdentitySession, requestId: string) {
      requireRecentAuthentication(session);
      const current = await repository.getEnrollment(session.userId);
      if (current?.status === "cancelled") return;
      const claimed = await repository.claimEnrollment(session, "cancelling", requestId);
      if (!claimed?.factorId) conflict();
      try {
        // Only the exact factor created by this enrollment can reach this adapter method.
        await provider.cancelEnrollment(session.workosUserId, claimed.factorId);
      } catch (cause) {
        await repository.failEnrollmentCancellation(claimed);
        throw cause;
      }
      if (!(await repository.finishEnrollment(claimed, "cancelled", requestId))) conflict();
      await authenticate(token);
    },
  };
}
