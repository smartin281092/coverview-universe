import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { and, count, eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../platform/db/database.js";
import {
  createIdentityRepository,
  type CreateIdentitySession,
  type IdentityRepository,
  type IdentitySession,
} from "./identity.repository.js";
import {
  identityAdminPermissions,
  identityAuditEvents,
  identityLogins,
  identityMfaChallenges,
  identityProfiles,
  identitySessions,
  identityUsers,
} from "./identity.schema.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: IdentityRepository;

const hash = (value: string = randomUUID()) => createHash("sha256").update(value).digest("hex");
const input = (overrides: Partial<CreateIdentitySession> = {}): CreateIdentitySession => ({
  workosUserId: `user_${randomUUID()}`,
  email: "person@identity.test",
  workosSessionId: `session_${randomUUID()}`,
  tokenHash: hash(),
  device: "Test browser",
  expiresAt: new Date(Date.now() + 3_600_000),
  loginStartedAt: new Date(Date.now() - 1000),
  requestId: randomUUID(),
  ...overrides,
});

async function session(overrides: Partial<CreateIdentitySession> = {}): Promise<IdentitySession> {
  const result = await repository.createSession(input(overrides));
  if (!result) throw new Error("Expected a new test session");
  return result;
}

async function grant(userId: string) {
  const id = `permission_${randomUUID()}`;
  await database.db.insert(identityAdminPermissions).values({
    id,
    userId,
    permission: "administration.access",
    evidence: "Isolated PostgreSQL test fixture; no external identity or real permission",
  });
  return id;
}

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_identity_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createIdentityRepository(database.db);
});

afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

it("consumes a browser-bound callback exactly once under concurrency and refuses expired state", async () => {
  const now = new Date();
  const stateHash = hash();
  const browserHash = hash();
  const login = {
    stateHash,
    browserHash,
    encryptedVerifier: "encrypted-test-fixture",
    surface: "client" as const,
    createdAt: now,
    expiresAt: new Date(+now + 60000),
  };
  await repository.createLogin(login);
  expect(await repository.consumeLogin(stateHash, hash(), now)).toBeUndefined();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => repository.consumeLogin(stateHash, browserHash, now)),
  );
  expect(results.filter(Boolean)).toEqual([login]);
  expect(await repository.consumeLogin(stateHash, browserHash, now)).toBeUndefined();

  const expiredHash = hash();
  await repository.createLogin({ ...login, stateHash: expiredHash });
  expect(await repository.consumeLogin(expiredHash, browserHash, login.expiresAt)).toBeUndefined();
  const rows = await database.db
    .select()
    .from(identityLogins)
    .where(eq(identityLogins.stateHash, expiredHash))
    .limit(1);
  expect(rows).toHaveLength(1);
});

it("keeps one canonical user and profile across concurrent logins without merging equal emails", async () => {
  const workosUserId = `user_${randomUUID()}`;
  const sessions = await Promise.all(Array.from({ length: 8 }, () => session({ workosUserId })));
  expect(new Set(sessions.map((value) => value.userId)).size).toBe(1);
  expect(new Set(sessions.map((value) => value.id)).size).toBe(8);
  const userId = sessions[0]!.userId;
  expect(
    await database.db
      .select()
      .from(identityProfiles)
      .where(eq(identityProfiles.userId, userId))
      .limit(2),
  ).toHaveLength(1);
  expect(
    await database.db
      .select()
      .from(identityUsers)
      .where(eq(identityUsers.workosUserId, workosUserId))
      .limit(2),
  ).toHaveLength(1);
  const other = await session({ email: sessions[0]!.email });
  expect(other.userId).not.toBe(userId);
});

it("rolls back the whole identity creation when a provider session is replayed", async () => {
  const first = await session();
  const replayUser = `user_${randomUUID()}`;
  await expect(
    session({ workosUserId: replayUser, workosSessionId: first.workosSessionId }),
  ).rejects.toThrow();
  expect(await repository.getUserByWorkosId(replayUser)).toBeUndefined();
});

it("keeps lists owner-scoped, bounded and stable across pages, excluding revoked and expired sessions", async () => {
  const first = await session();
  const others = await Promise.all(
    Array.from({ length: 21 }, () => session({ workosUserId: first.workosUserId })),
  );
  const stranger = await session();
  await repository.revokeSession(first.userId, others[0]!.id, randomUUID());
  const page1 = await repository.listSessions(first.userId, first.id);
  expect(page1.sessions).toHaveLength(20);
  expect(page1.nextCursor).not.toBeNull();
  const page2 = await repository.listSessions(first.userId, first.id, page1.nextCursor!);
  expect(page2.sessions).toHaveLength(1);
  expect(page2.nextCursor).toBeNull();
  const all = [...page1.sessions, ...page2.sessions];
  expect(new Set(all.map((value) => value.id)).size).toBe(21);
  expect(all.every((value) => value.userId === first.userId)).toBe(true);
  expect(all.filter((value) => value.current).map((value) => value.id)).toEqual([first.id]);
  expect(all.some((value) => value.id === stranger.id || value.id === others[0]!.id)).toBe(false);
  expect(
    (
      await repository.listSessions(
        first.userId,
        first.id,
        undefined,
        new Date(Date.now() + 7_200_000),
      )
    ).sessions,
  ).toEqual([]);
});

it("revokes only the owned device and audits concurrent duplicate requests once", async () => {
  const first = await session();
  const second = await session({ workosUserId: first.workosUserId });
  const stranger = await session();
  expect(await repository.revokeSession(stranger.userId, first.id, randomUUID())).toBeUndefined();
  expect(await repository.getSession(first.tokenHash, new Date())).toBeDefined();
  const revocations = await Promise.all(
    Array.from({ length: 8 }, () => repository.revokeSession(first.userId, first.id, randomUUID())),
  );
  expect(revocations.every((value) => value?.revokedAt !== null)).toBe(true);
  expect(await repository.getSession(first.tokenHash, new Date())).toBeUndefined();
  expect(await repository.getSession(second.tokenHash, new Date())).toBeDefined();
  expect(await repository.getSession(stranger.tokenHash, new Date())).toBeDefined();
  expect(
    await database.db
      .select()
      .from(identityAuditEvents)
      .where(
        and(
          eq(identityAuditEvents.sessionId, first.id),
          eq(identityAuditEvents.action, "session.revoke"),
        ),
      )
      .limit(2),
  ).toHaveLength(1);
  expect(
    (await repository.getSession(first.tokenHash, new Date(), { includeRevoked: true }))
      ?.remoteRevocationPending,
  ).toBe(true);
  expect(
    await repository.getSession(first.tokenHash, first.expiresAt, { includeRevoked: true }),
  ).toBeUndefined();
});

it("tracks pending remote revocation by owner without reactivating or duplicating a local logout", async () => {
  const first = await session();
  const stranger = await session();
  await repository.revokeSession(first.userId, first.id, randomUUID());
  await repository.markRemoteRevoked(first.workosSessionId, stranger.userId);
  expect((await repository.listPendingRevocations(first.userId)).map((value) => value.id)).toEqual([
    first.id,
  ]);
  await repository.markRemoteRevoked(first.workosSessionId, first.userId);
  expect(await repository.listPendingRevocations(first.userId)).toEqual([]);
  expect(
    (await repository.revokeSession(first.userId, first.id, randomUUID()))?.remoteRevocationPending,
  ).toBe(false);
  expect(await repository.getSession(first.tokenHash, new Date())).toBeUndefined();
});

it("global logout rejects callbacks in flight regardless of their transaction order", async () => {
  const first = await session();
  const second = await session({ workosUserId: first.workosUserId });
  const stranger = await session();
  const callbackInput = input({ workosUserId: first.workosUserId });
  await Promise.all([
    repository.createSession(callbackInput),
    repository.revokeAll(first.userId, randomUUID()),
  ]);
  expect(await repository.getSession(first.tokenHash, new Date())).toBeUndefined();
  expect(await repository.getSession(second.tokenHash, new Date())).toBeUndefined();
  expect(await repository.getSession(callbackInput.tokenHash, new Date())).toBeUndefined();
  expect(await repository.getSession(stranger.tokenHash, new Date())).toBeDefined();
  expect((await repository.getUserByWorkosId(first.workosUserId))?.globalRevocationPending).toBe(
    true,
  );
  expect(
    await repository.createSession(input({ workosUserId: first.workosUserId })),
  ).toBeUndefined();
});

it("keeps global logout idempotent and prevents an older remote completion from clearing a newer logout", async () => {
  const first = await session();
  const requestId = randomUUID();
  const old = await repository.revokeAll(first.userId, requestId);
  expect(old).toBeDefined();
  expect(await repository.revokeAll(first.userId, requestId)).toEqual(old);
  const current = await repository.revokeAll(first.userId, randomUUID());
  await repository.completeGlobalRevocation(first.userId, old!.revocationId);
  expect((await repository.getUserByWorkosId(first.workosUserId))?.globalRevocationPending).toBe(
    true,
  );
  await repository.completeGlobalRevocation(first.userId, current!.revocationId);
  expect((await repository.getUserByWorkosId(first.workosUserId))?.globalRevocationPending).toBe(
    false,
  );
  expect(
    await repository.createSession(
      input({ workosUserId: first.workosUserId, loginStartedAt: first.createdAt }),
    ),
  ).toBeUndefined();
  const [user] = await database.db
    .select()
    .from(identityUsers)
    .where(eq(identityUsers.id, first.userId))
    .limit(1);
  expect(
    await repository.createSession(
      input({
        workosUserId: first.workosUserId,
        email: "stale@identity.test",
        loginStartedAt: first.createdAt,
      }),
    ),
  ).toBeUndefined();
  const [unchangedUser] = await database.db
    .select({ email: identityUsers.email })
    .from(identityUsers)
    .where(eq(identityUsers.id, first.userId))
    .limit(1);
  expect(unchangedUser?.email).toBe(first.email);
  const newerLogin = await session({
    workosUserId: first.workosUserId,
    loginStartedAt: new Date(+user!.lastGlobalLogoutAt! + 1),
  });
  expect(newerLogin.userId).toBe(first.userId);
  const [audits] = await database.db
    .select({ count: count() })
    .from(identityAuditEvents)
    .where(
      and(
        eq(identityAuditEvents.userId, first.userId),
        eq(identityAuditEvents.action, "sessions.revoke_all"),
      ),
    );
  expect(audits?.count).toBe(2);
});

it("requires an explicit unrevoked permission and immediately observes its withdrawal", async () => {
  const first = await session();
  expect(first.hasAdminPermission).toBe(false);
  expect(await repository.markMfaVerified(first.id, new Date(), hash())).toBeUndefined();
  expect(
    await repository.saveChallenge(
      first.id,
      "challenge_fixture",
      "factor_fixture",
      new Date(Date.now() + 60000),
    ),
  ).toBe(false);
  const permissionId = await grant(first.userId);
  expect((await repository.getSession(first.tokenHash, new Date()))?.hasAdminPermission).toBe(true);
  await database.db
    .update(identityAdminPermissions)
    .set({ revokedAt: new Date() })
    .where(eq(identityAdminPermissions.id, permissionId));
  expect((await repository.getSession(first.tokenHash, new Date()))?.hasAdminPermission).toBe(
    false,
  );
  expect(await repository.markMfaVerified(first.id, new Date(), hash())).toBeUndefined();
  await expect(
    database.db.insert(identityAdminPermissions).values({
      id: randomUUID(),
      userId: first.userId,
      permission: "administration.access",
      evidence: " ",
    }),
  ).rejects.toThrow();
});

it("binds global logout retries to the original source session and key under concurrent requests", async () => {
  const first = await session();
  const second = await session({ workosUserId: first.workosUserId });
  const stranger = await session();
  expect(await repository.revokeAll(first.userId, randomUUID(), stranger.id)).toBeUndefined();
  const keys = [randomUUID(), randomUUID()];
  const results = await Promise.all(
    keys.map((key) => repository.revokeAll(first.userId, key, first.id)),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  const winner = results.findIndex(Boolean);
  const result = results[winner]!;
  const key = keys[winner]!;
  expect(await repository.revokeAll(first.userId, key, first.id)).toEqual(result);
  expect(await repository.revokeAll(first.userId, key, second.id)).toBeUndefined();
  expect(await repository.revokeAll(first.userId, randomUUID(), first.id)).toBeUndefined();
  const user = await repository.getUserByWorkosId(first.workosUserId);
  expect(user?.lastGlobalLogoutAt).toEqual(result.cutoff);
  const [audit] = await database.db
    .select()
    .from(identityAuditEvents)
    .where(
      and(
        eq(identityAuditEvents.userId, first.userId),
        eq(identityAuditEvents.action, "sessions.revoke_all"),
      ),
    )
    .limit(2);
  expect(audit?.sessionId).toBe(first.id);
  expect(audit?.createdAt).toEqual(result.cutoff);

  await repository.completeGlobalRevocation(first.userId, result.revocationId);
  const newer = await session({
    workosUserId: first.workosUserId,
    loginStartedAt: new Date(+result.cutoff + 1),
  });
  expect(await repository.revokeAll(first.userId, key, first.id)).toEqual(result);
  expect(await repository.getSession(newer.tokenHash, new Date())).toBeDefined();
  expect((await repository.getUserByWorkosId(first.workosUserId))?.globalRevocationPending).toBe(
    false,
  );
});

it("binds one-use MFA challenges to one session and rotates the handle only after successful verification", async () => {
  const first = await session();
  const second = await session({ workosUserId: first.workosUserId });
  await grant(first.userId);
  expect(
    await repository.saveChallenge(
      first.id,
      "challenge_fixture",
      "factor_fixture",
      new Date(Date.now() + 60000),
    ),
  ).toBe(true);
  expect(await repository.consumeChallenge(second.id)).toBeUndefined();
  const consumed = await Promise.all(
    Array.from({ length: 5 }, () => repository.consumeChallenge(first.id)),
  );
  expect(consumed.filter(Boolean)).toHaveLength(1);
  const tokenHash = hash();
  const verified = await repository.markMfaVerified(first.id, new Date(), tokenHash, randomUUID());
  expect(verified?.mfaVerifiedAt).toBeInstanceOf(Date);
  expect(await repository.getSession(first.tokenHash, new Date())).toBeUndefined();
  expect((await repository.getSession(tokenHash, new Date()))?.id).toBe(first.id);
  expect((await repository.getSession(second.tokenHash, new Date()))?.mfaVerifiedAt).toBeNull();
});

it("a revocation during the external MFA call prevents elevation and drops pending challenges", async () => {
  const first = await session();
  await grant(first.userId);
  await repository.saveChallenge(
    first.id,
    "challenge_fixture",
    "factor_fixture",
    new Date(Date.now() + 60000),
  );
  expect(await repository.consumeChallenge(first.id)).toBeDefined();
  await repository.revokeSession(first.userId, first.id, randomUUID());
  expect(await repository.markMfaVerified(first.id, new Date(), hash())).toBeUndefined();
  expect(
    await repository.saveChallenge(
      first.id,
      "challenge_after_logout",
      "factor_fixture",
      new Date(Date.now() + 60000),
    ),
  ).toBe(false);
  const second = await session({ workosUserId: first.workosUserId });
  await repository.saveChallenge(
    second.id,
    "challenge_global_logout",
    "factor_fixture",
    new Date(Date.now() + 60000),
  );
  await repository.revokeAll(first.userId, randomUUID());
  expect(await repository.consumeChallenge(second.id)).toBeUndefined();
  expect(await repository.markMfaVerified(second.id, new Date(), hash())).toBeUndefined();
});

it("permits a later MFA proof on the same session without colliding with its previous audit", async () => {
  const first = await session();
  await grant(first.userId);
  const initialHash = hash();
  expect(await repository.markMfaVerified(first.id, new Date(), initialHash)).toBeDefined();
  const laterHash = hash();
  expect(
    await repository.markMfaVerified(first.id, new Date(Date.now() + 960000), laterHash),
  ).toBeDefined();
  expect(await repository.getSession(initialHash, new Date())).toBeUndefined();
  expect((await repository.getSession(laterHash, new Date()))?.id).toBe(first.id);
  const audits = await database.db
    .select({ id: identityAuditEvents.id })
    .from(identityAuditEvents)
    .where(
      and(
        eq(identityAuditEvents.sessionId, first.id),
        eq(identityAuditEvents.action, "mfa.verify"),
      ),
    )
    .limit(3);
  expect(audits).toHaveLength(2);
});

it("stores only opaque handle hashes and refuses raw or structurally invalid handles", async () => {
  const raw = `test-only-opaque-handle-${randomUUID()}`;
  const first = await session({ tokenHash: hash(raw) });
  const [persisted] = await database.db
    .select()
    .from(identitySessions)
    .where(eq(identitySessions.id, first.id))
    .limit(1);
  expect(JSON.stringify(persisted)).not.toContain(raw);
  expect(await repository.getSession(raw, new Date())).toBeUndefined();
  await expect(session({ tokenHash: raw })).rejects.toThrow();
});

it("purges expired temporary secrets on activity in bounded batches without deleting live challenges", async () => {
  const now = new Date();
  const first = await session();
  const second = await session({ workosUserId: first.workosUserId });
  await database.db.insert(identityMfaChallenges).values([
    {
      sessionId: first.id,
      challengeId: "expired_challenge",
      factorId: "factor_fixture",
      expiresAt: new Date(+now - 1000),
    },
    {
      sessionId: second.id,
      challengeId: "live_challenge",
      factorId: "factor_fixture",
      expiresAt: new Date(+now + 60000),
    },
  ]);
  const expired = Array.from({ length: 101 }, () => ({
    stateHash: hash(),
    browserHash: hash(),
    encryptedVerifier: "expired-encrypted-fixture",
    surface: "client" as const,
    createdAt: new Date(+now - 90000000),
    expiresAt: new Date(+now - 86400000),
  }));
  await database.db.insert(identityLogins).values(expired);
  const fresh = {
    stateHash: hash(),
    browserHash: hash(),
    encryptedVerifier: "live-encrypted-fixture",
    surface: "client" as const,
    createdAt: now,
    expiresAt: new Date(+now + 60000),
  };
  await repository.createLogin(fresh);
  const remaining = await database.db
    .select({ stateHash: identityLogins.stateHash })
    .from(identityLogins)
    .where(
      inArray(
        identityLogins.stateHash,
        expired.map((value) => value.stateHash),
      ),
    )
    .limit(102);
  expect(remaining).toHaveLength(1);
  expect(await repository.consumeChallenge(first.id)).toBeUndefined();
  expect((await repository.consumeChallenge(second.id))?.challengeId).toBe("live_challenge");
  expect(await repository.consumeLogin(fresh.stateHash, fresh.browserHash, now)).toEqual(fresh);
});
