import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";
import type { createDatabase } from "../../platform/db/database.js";
import { createEnrollmentRepository } from "./identity.enrollment.repository.js";
import {
  identityAdminPermissions,
  identityAuditEvents,
  identityLogins,
  identityMfaChallenges,
  identityMfaEnrollments,
  identityProfiles,
  identitySessions,
  identityUsers,
} from "./identity.schema.js";

type Database = ReturnType<typeof createDatabase>["db"];
type Session = typeof identitySessions.$inferSelect;

export type IdentitySession = Session & {
  workosUserId: string;
  email: string;
  hasAdminPermission: boolean;
  globalRevocationPending: boolean;
  globalRevocationId: string | null;
};

export type CreateIdentitySession = {
  workosUserId: string;
  email: string;
  workosSessionId: string;
  tokenHash: string;
  device: string;
  expiresAt: Date;
  loginStartedAt: Date;
  requestId: string;
  authenticatedAt?: Date | null;
};

const hasAdminPermission = sql<boolean>`exists (
  select 1 from ${identityAdminPermissions}
  where ${identityAdminPermissions.userId} = ${identitySessions.userId}
    and ${identityAdminPermissions.permission} = 'administration.access'
    and ${identityAdminPermissions.revokedAt} is null
)`;
const noPendingEnrollment = sql<boolean>`not exists (
  select 1 from ${identityMfaEnrollments}
  where ${identityMfaEnrollments.userId} = ${identitySessions.userId}
    and ${identityMfaEnrollments.status} not in ('confirmed', 'cancelled')
)`;

async function readSession(executor: Pick<Database, "select">, condition: SQL | undefined) {
  const [session] = await executor
    .select({
      ...getTableColumns(identitySessions),
      workosUserId: identityUsers.workosUserId,
      email: identityUsers.email,
      globalRevocationPending: identityUsers.globalRevocationPending,
      globalRevocationId: identityUsers.globalRevocationId,
      hasAdminPermission,
    })
    .from(identitySessions)
    .innerJoin(identityUsers, eq(identityUsers.id, identitySessions.userId))
    .where(condition)
    .limit(1);
  return session;
}

const activeSession = (now: Date) =>
  and(isNull(identitySessions.revokedAt), gt(identitySessions.expiresAt, now));

export function createIdentityRepository(db: Database) {
  return {
    ...createEnrollmentRepository(db),
    async createLogin(input: typeof identityLogins.$inferInsert) {
      // Expiry is a technical lifetime, not an invented retention period for personal records.
      await db
        .delete(identityLogins)
        .where(
          inArray(
            identityLogins.stateHash,
            db
              .select({ stateHash: identityLogins.stateHash })
              .from(identityLogins)
              .where(lte(identityLogins.expiresAt, input.createdAt))
              .orderBy(asc(identityLogins.expiresAt), asc(identityLogins.stateHash))
              .limit(100),
          ),
        );
      await db
        .delete(identityMfaChallenges)
        .where(
          inArray(
            identityMfaChallenges.sessionId,
            db
              .select({ sessionId: identityMfaChallenges.sessionId })
              .from(identityMfaChallenges)
              .where(lte(identityMfaChallenges.expiresAt, input.createdAt))
              .orderBy(asc(identityMfaChallenges.expiresAt), asc(identityMfaChallenges.sessionId))
              .limit(100),
          ),
        );
      await db.insert(identityLogins).values(input);
    },

    async consumeLogin(stateHash: string, browserHash: string, now: Date) {
      const [login] = await db
        .delete(identityLogins)
        .where(
          and(
            eq(identityLogins.stateHash, stateHash),
            eq(identityLogins.browserHash, browserHash),
            gt(identityLogins.expiresAt, now),
          ),
        )
        .returning();
      return login;
    },

    async getUserByWorkosId(workosUserId: string) {
      const [user] = await db
        .select({
          id: identityUsers.id,
          workosUserId: identityUsers.workosUserId,
          globalRevocationPending: identityUsers.globalRevocationPending,
          globalRevocationId: identityUsers.globalRevocationId,
          lastGlobalLogoutAt: identityUsers.lastGlobalLogoutAt,
        })
        .from(identityUsers)
        .where(eq(identityUsers.workosUserId, workosUserId))
        .limit(1);
      return user;
    },

    async createSession(input: CreateIdentitySession): Promise<IdentitySession | undefined> {
      return db.transaction(async (tx) => {
        // Upsert locks this canonical user until commit, serializing callbacks with global logout.
        const [user] = await tx
          .insert(identityUsers)
          .values({
            id: `usr_${randomUUID()}`,
            workosUserId: input.workosUserId,
            email: input.email,
          })
          .onConflictDoUpdate({
            target: identityUsers.workosUserId,
            set: { workosUserId: input.workosUserId },
          })
          .returning();
        if (!user) throw new Error("Canonical identity was not persisted");
        if (
          user.globalRevocationPending ||
          (user.lastGlobalLogoutAt && input.loginStartedAt <= user.lastGlobalLogoutAt)
        )
          return undefined;

        await tx
          .update(identityUsers)
          .set({ email: input.email })
          .where(eq(identityUsers.id, user.id));

        await tx
          .insert(identityProfiles)
          .values({ id: `prof_${randomUUID()}`, userId: user.id })
          .onConflictDoNothing({ target: identityProfiles.userId });
        const sessionId = `sess_${randomUUID()}`;
        await tx.insert(identitySessions).values({
          id: sessionId,
          userId: user.id,
          workosSessionId: input.workosSessionId,
          tokenHash: input.tokenHash,
          device: input.device,
          authenticatedAt: input.authenticatedAt ?? null,
          expiresAt: input.expiresAt,
        });
        await tx.insert(identityAuditEvents).values({
          id: `audit_${randomUUID()}`,
          userId: user.id,
          sessionId,
          action: "login",
          requestId: input.requestId,
          deduplicationKey: `login:${sessionId}`,
        });
        return readSession(tx, eq(identitySessions.id, sessionId));
      });
    },

    async getSession(tokenHash: string, now: Date, options: { includeRevoked?: boolean } = {}) {
      if (options.includeRevoked) {
        return readSession(
          db,
          and(eq(identitySessions.tokenHash, tokenHash), gt(identitySessions.expiresAt, now)),
        );
      }
      return db.transaction(async (tx) => {
        const [active] = await tx
          .update(identitySessions)
          .set({ lastSeenAt: now })
          .where(and(eq(identitySessions.tokenHash, tokenHash), activeSession(now)))
          .returning({ id: identitySessions.id });
        if (!active) return undefined;
        return readSession(tx, and(eq(identitySessions.id, active.id), activeSession(now)));
      });
    },

    async listSessions(userId: string, currentId: string, cursor?: string, now = new Date()) {
      const rows = await db
        .select()
        .from(identitySessions)
        .where(
          and(
            eq(identitySessions.userId, userId),
            activeSession(now),
            cursor ? gt(identitySessions.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(identitySessions.id))
        .limit(21);
      const sessions = rows
        .slice(0, 20)
        .map((session) => ({ ...session, current: session.id === currentId }));
      return { sessions, nextCursor: rows.length > 20 ? (sessions.at(-1)?.id ?? null) : null };
    },

    async revokeSession(userId: string, sessionId: string, requestId: string) {
      return db.transaction(async (tx) => {
        const owned = and(eq(identitySessions.userId, userId), eq(identitySessions.id, sessionId));
        const [revoked] = await tx
          .update(identitySessions)
          .set({
            revokedAt: sql`clock_timestamp()`,
            remoteRevocationPending: true,
            mfaVerifiedAt: null,
          })
          .where(and(owned, isNull(identitySessions.revokedAt)))
          .returning({ id: identitySessions.id });
        if (revoked) {
          await tx.insert(identityAuditEvents).values({
            id: `audit_${randomUUID()}`,
            userId,
            sessionId,
            action: "session.revoke",
            requestId,
            deduplicationKey: `session.revoke:${sessionId}`,
          });
          await tx
            .delete(identityMfaChallenges)
            .where(eq(identityMfaChallenges.sessionId, sessionId));
        }
        return readSession(tx, owned);
      });
    },

    async revokeAll(userId: string, requestId: string, sourceSessionId?: string) {
      return db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(identityUsers)
          .where(eq(identityUsers.id, userId))
          .limit(1)
          .for("update");
        if (!user) return undefined;
        const deduplicationKey = `sessions.revoke_all:${userId}:${requestId}`;
        const [previous] = await tx
          .select({
            revocationId: identityAuditEvents.revocationId,
            sessionId: identityAuditEvents.sessionId,
            cutoff: identityAuditEvents.createdAt,
          })
          .from(identityAuditEvents)
          .where(eq(identityAuditEvents.deduplicationKey, deduplicationKey))
          .limit(1);
        if (previous?.revocationId) {
          if (previous.sessionId !== (sourceSessionId ?? null)) return undefined;
          return {
            userId,
            workosUserId: user.workosUserId,
            revocationId: previous.revocationId,
            cutoff: previous.cutoff,
          };
        }
        if (sourceSessionId) {
          const [source] = await tx
            .select({ id: identitySessions.id })
            .from(identitySessions)
            .where(
              and(
                eq(identitySessions.id, sourceSessionId),
                eq(identitySessions.userId, userId),
                isNull(identitySessions.revokedAt),
                gt(identitySessions.expiresAt, sql`clock_timestamp()`),
              ),
            )
            .limit(1)
            .for("update");
          if (!source) return undefined;
        }

        const revocationId = `revoke_${randomUUID()}`;
        const [updated] = await tx
          .update(identityUsers)
          .set({
            lastGlobalLogoutAt: sql`clock_timestamp()`,
            globalRevocationPending: true,
            globalRevocationId: revocationId,
          })
          .where(eq(identityUsers.id, userId))
          .returning({ cutoff: identityUsers.lastGlobalLogoutAt });
        if (!updated?.cutoff) throw new Error("Global revocation cutoff was not persisted");
        const cutoff = updated.cutoff;
        await tx
          .update(identitySessions)
          .set({
            revokedAt: cutoff,
            remoteRevocationPending: true,
            mfaVerifiedAt: null,
          })
          .where(and(eq(identitySessions.userId, userId), isNull(identitySessions.revokedAt)));
        await tx.delete(identityMfaChallenges).where(sql`${identityMfaChallenges.sessionId} in (
          select ${identitySessions.id} from ${identitySessions} where ${identitySessions.userId} = ${userId}
        )`);
        await tx.insert(identityAuditEvents).values({
          id: `audit_${randomUUID()}`,
          userId,
          sessionId: sourceSessionId ?? null,
          action: "sessions.revoke_all",
          requestId,
          deduplicationKey,
          revocationId,
          createdAt: cutoff,
        });
        return { userId, workosUserId: user.workosUserId, revocationId, cutoff };
      });
    },

    async listPendingRevocations(userId: string, limit = 20, workosSessionIds?: string[]) {
      if (workosSessionIds && workosSessionIds.length > 100)
        throw new Error("Session query exceeds provider bound");
      return db
        .select()
        .from(identitySessions)
        .where(
          and(
            eq(identitySessions.userId, userId),
            eq(identitySessions.remoteRevocationPending, true),
            workosSessionIds
              ? inArray(identitySessions.workosSessionId, workosSessionIds)
              : undefined,
          ),
        )
        .orderBy(asc(identitySessions.id))
        .limit(Math.max(1, Math.min(100, limit)));
    },

    async markRemoteRevoked(workosSessionId: string, userId: string) {
      await db
        .update(identitySessions)
        .set({ remoteRevocationPending: false })
        .where(
          and(
            eq(identitySessions.userId, userId),
            eq(identitySessions.workosSessionId, workosSessionId),
          ),
        );
    },

    async completeGlobalRevocation(userId: string, revocationId: string) {
      await db
        .update(identityUsers)
        .set({ globalRevocationPending: false })
        .where(
          and(eq(identityUsers.id, userId), eq(identityUsers.globalRevocationId, revocationId)),
        );
    },

    async saveChallenge(sessionId: string, challengeId: string, factorId: string, expiresAt: Date) {
      const now = new Date();
      return db.transaction(async (tx) => {
        const [session] = await tx
          .select({ id: identitySessions.id })
          .from(identitySessions)
          .where(
            and(
              eq(identitySessions.id, sessionId),
              activeSession(now),
              hasAdminPermission,
              noPendingEnrollment,
            ),
          )
          .limit(1)
          .for("update");
        if (!session) return false;
        await tx
          .insert(identityMfaChallenges)
          .values({ sessionId, challengeId, factorId, expiresAt })
          .onConflictDoUpdate({
            target: identityMfaChallenges.sessionId,
            set: { challengeId, factorId, expiresAt },
          });
        return true;
      });
    },

    async consumeChallenge(sessionId: string) {
      const [challenge] = await db
        .delete(identityMfaChallenges)
        .where(eq(identityMfaChallenges.sessionId, sessionId))
        .returning();
      return challenge;
    },

    async markMfaVerified(
      sessionId: string,
      now: Date,
      newTokenHash: string,
      requestId: string = randomUUID(),
    ) {
      return db.transaction(async (tx) => {
        const [session] = await tx
          .update(identitySessions)
          .set({ mfaVerifiedAt: now, tokenHash: newTokenHash })
          .where(
            and(
              eq(identitySessions.id, sessionId),
              activeSession(now),
              hasAdminPermission,
              noPendingEnrollment,
            ),
          )
          .returning({ userId: identitySessions.userId });
        if (!session) return undefined;
        await tx.insert(identityAuditEvents).values({
          id: `audit_${randomUUID()}`,
          userId: session.userId,
          sessionId,
          action: "mfa.verify",
          requestId,
          deduplicationKey: `mfa.verify:${sessionId}:${requestId}`,
        });
        return readSession(tx, eq(identitySessions.id, sessionId));
      });
    },
  };
}

export type IdentityRepository = ReturnType<typeof createIdentityRepository>;
