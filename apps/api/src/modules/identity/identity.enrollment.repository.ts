import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { createDatabase } from "../../platform/db/database.js";
import {
  identityAuditEvents,
  identityMfaEnrollments,
  identitySessions,
  identityUsers,
} from "./identity.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type EnrollmentSession = Pick<typeof identitySessions.$inferSelect, "id" | "userId" | "tokenHash">;
export type Enrollment = typeof identityMfaEnrollments.$inferSelect;
type EnrollmentAction = "challenging" | "verifying" | "cancelling";
const actionNames = {
  challenging: "mfa.enrollment.challenge",
  verifying: "mfa.enrollment.verify",
  cancelling: "mfa.enrollment.cancel_request",
} as const;
export const enrollmentOperationTimeoutMs = 30_000;

// Same user -> session lock order as global logout; no network operation runs in these transactions.
async function lockSession(tx: Transaction, session: EnrollmentSession) {
  const [user] = await tx
    .select()
    .from(identityUsers)
    .where(eq(identityUsers.id, session.userId))
    .limit(1)
    .for("update");
  if (!user || user.globalRevocationPending) return false;
  const [active] = await tx
    .select({ id: identitySessions.id })
    .from(identitySessions)
    .where(
      and(
        eq(identitySessions.id, session.id),
        eq(identitySessions.userId, session.userId),
        eq(identitySessions.tokenHash, session.tokenHash),
        isNull(identitySessions.revokedAt),
        gt(identitySessions.expiresAt, new Date()),
      ),
    )
    .limit(1)
    .for("update");
  return Boolean(active);
}

export function createEnrollmentRepository(db: Database) {
  async function read(userId: string) {
    const [row] = await db
      .select()
      .from(identityMfaEnrollments)
      .where(eq(identityMfaEnrollments.userId, userId))
      .limit(1);
    return row;
  }
  async function updateClaim(
    row: Enrollment,
    values: Partial<typeof identityMfaEnrollments.$inferInsert>,
  ) {
    const [updated] = await db
      .update(identityMfaEnrollments)
      .set({ ...values, updatedAt: new Date() })
      .where(
        and(
          eq(identityMfaEnrollments.userId, row.userId),
          eq(identityMfaEnrollments.operationId, row.operationId),
          eq(identityMfaEnrollments.claimId, row.claimId),
          eq(identityMfaEnrollments.status, row.status),
        ),
      )
      .returning();
    return updated;
  }
  return {
    getEnrollment: read,
    async reserveEnrollment(session: EnrollmentSession, requestId: string) {
      return db.transaction(async (tx) => {
        if (!(await lockSession(tx, session))) return undefined;
        const [previous] = await tx
          .select()
          .from(identityMfaEnrollments)
          .where(eq(identityMfaEnrollments.userId, session.userId))
          .limit(1)
          .for("update");
        if (previous && previous.status !== "cancelled") return undefined;
        const deduplicationKey = `mfa.enrollment.start:${session.userId}:${requestId}`;
        const [attempt] = await tx
          .insert(identityAuditEvents)
          .values({
            id: `audit_${randomUUID()}`,
            userId: session.userId,
            sessionId: session.id,
            action: "mfa.enrollment.start",
            requestId,
            deduplicationKey,
          })
          .onConflictDoNothing({ target: identityAuditEvents.deduplicationKey })
          .returning({ id: identityAuditEvents.id });
        if (!attempt) return undefined;
        const now = new Date();
        const values = {
          userId: session.userId,
          sessionId: session.id,
          operationId: randomUUID(),
          status: "creating" as const,
          factorId: null,
          challengeId: null,
          challengeExpiresAt: null,
          claimId: randomUUID(),
          verificationUncertain: false,
          createdAt: now,
          updatedAt: now,
        };
        const [row] = await tx
          .insert(identityMfaEnrollments)
          .values(values)
          .onConflictDoUpdate({ target: identityMfaEnrollments.userId, set: values })
          .returning();
        return row;
      });
    },
    saveEnrollmentCreated: (
      row: Enrollment,
      factorId: string,
      challengeId: string,
      expiresAt: Date,
    ) =>
      updateClaim(row, { status: "pending", factorId, challengeId, challengeExpiresAt: expiresAt }),
    failEnrollmentCreation: (row: Enrollment) => updateClaim(row, { status: "recovery" }),
    async claimEnrollment(session: EnrollmentSession, action: EnrollmentAction, requestId: string) {
      return db.transaction(async (tx) => {
        if (!(await lockSession(tx, session))) return undefined;
        const [row] = await tx
          .select()
          .from(identityMfaEnrollments)
          .where(eq(identityMfaEnrollments.userId, session.userId))
          .limit(1)
          .for("update");
        if (!row?.factorId) return undefined;
        const stale = row.updatedAt.getTime() + enrollmentOperationTimeoutMs <= Date.now();
        const resumableVerification = row.status === "recovery" && row.verificationUncertain;
        const resumableCancellation = row.status === "recovery" && !row.verificationUncertain;
        if (
          action === "challenging" &&
          !(
            row.status === "pending" ||
            resumableVerification ||
            (stale && ["challenging", "verifying"].includes(row.status))
          )
        )
          return undefined;
        if (
          action === "verifying" &&
          !(
            row.status === "pending" &&
            row.sessionId === session.id &&
            row.challengeId &&
            row.challengeExpiresAt &&
            row.challengeExpiresAt.getTime() > Date.now()
          )
        )
          return undefined;
        if (
          action === "cancelling" &&
          (row.verificationUncertain ||
            !(
              row.status === "pending" ||
              resumableCancellation ||
              (stale && row.status === "cancelling")
            ))
        )
          return undefined;
        const name = actionNames[action];
        const [attempt] = await tx
          .insert(identityAuditEvents)
          .values({
            id: `audit_${randomUUID()}`,
            userId: session.userId,
            sessionId: session.id,
            action: name,
            requestId,
            deduplicationKey: `${name}:${row.operationId}:${requestId}`,
          })
          .onConflictDoNothing({ target: identityAuditEvents.deduplicationKey })
          .returning({ id: identityAuditEvents.id });
        if (!attempt) return undefined;
        const claimId = randomUUID();
        await tx
          .update(identityMfaEnrollments)
          .set({
            status: action,
            claimId,
            sessionId: session.id,
            updatedAt: new Date(),
            verificationUncertain:
              row.verificationUncertain || action === "verifying" || row.status === "verifying",
            ...(action === "verifying" ? {} : { challengeId: null, challengeExpiresAt: null }),
          })
          .where(eq(identityMfaEnrollments.userId, session.userId));
        // Preserve the uncertainty before this attempt: a definitive invalid code cannot clear an earlier uncertain success.
        return { ...row, claimId, sessionId: session.id, status: action };
      });
    },
    saveEnrollmentChallenge: (row: Enrollment, challengeId: string, expiresAt: Date) =>
      updateClaim(row, { status: "pending", challengeId, challengeExpiresAt: expiresAt }),
    failEnrollmentChallenge: (row: Enrollment) =>
      updateClaim(row, { status: "pending", challengeId: null, challengeExpiresAt: null }),
    failEnrollmentVerification: (row: Enrollment, uncertain: boolean) =>
      updateClaim(row, {
        status: uncertain ? "recovery" : "pending",
        challengeId: null,
        challengeExpiresAt: null,
        verificationUncertain: uncertain || row.verificationUncertain,
      }),
    failEnrollmentCancellation: (row: Enrollment) =>
      updateClaim(row, { status: "recovery", challengeId: null, challengeExpiresAt: null }),
    async finishEnrollment(row: Enrollment, outcome: "confirmed" | "cancelled", requestId: string) {
      return db.transaction(async (tx) => {
        // Audit foreign keys also lock these parents. Take them before enrollment,
        // matching reservation/claims/global logout, even when the session was revoked in flight.
        const [user] = await tx
          .select({ id: identityUsers.id })
          .from(identityUsers)
          .where(eq(identityUsers.id, row.userId))
          .limit(1)
          .for("update");
        if (!user) return false;
        const [session] = await tx
          .select({ id: identitySessions.id })
          .from(identitySessions)
          .where(
            and(eq(identitySessions.id, row.sessionId), eq(identitySessions.userId, row.userId)),
          )
          .limit(1)
          .for("update");
        if (!session) return false;
        const [updated] = await tx
          .update(identityMfaEnrollments)
          .set({
            status: outcome,
            challengeId: null,
            challengeExpiresAt: null,
            verificationUncertain: false,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(identityMfaEnrollments.userId, row.userId),
              eq(identityMfaEnrollments.operationId, row.operationId),
              eq(identityMfaEnrollments.claimId, row.claimId),
              eq(identityMfaEnrollments.status, row.status),
            ),
          )
          .returning();
        if (!updated) return false;
        const action = outcome === "confirmed" ? "mfa.enrollment.confirm" : "mfa.enrollment.cancel";
        await tx
          .insert(identityAuditEvents)
          .values({
            id: `audit_${randomUUID()}`,
            userId: row.userId,
            sessionId: row.sessionId,
            action,
            requestId,
            deduplicationKey: `${action}:${row.operationId}`,
          })
          .onConflictDoNothing({ target: identityAuditEvents.deduplicationKey });
        return true;
      });
    },
    async rotateEnrollmentSession(session: EnrollmentSession, tokenHash: string) {
      return db.transaction(async (tx) => {
        if (!(await lockSession(tx, session))) return false;
        await tx
          .update(identitySessions)
          .set({ tokenHash, mfaVerifiedAt: null })
          .where(
            and(eq(identitySessions.id, session.id), eq(identitySessions.userId, session.userId)),
          );
        return true;
      });
    },
  };
}
