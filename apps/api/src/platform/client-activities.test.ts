import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  clientActivityCreateInputSchema,
  type ClientActivityCreateInput,
} from "@coverview/contracts";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { identityAdminPermissions, identitySessions } from "../modules/identity/identity.schema.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { createClientActivityRepository } from "../modules/client-activities/client-activities.repository.js";
import {
  clientActivityCommands,
  clientActivityAudit,
} from "../modules/client-activities/client-activities.schema.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
async function owner() {
  const session = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: `activities-${randomUUID()}@test.test`,
    device: "Activities isolated test",
    tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!session) throw new Error("Test session unavailable");
  return session;
}
async function context() {
  const administrator = await owner();
  const target = await owner();
  const stranger = await owner();
  await database.db.insert(identityAdminPermissions).values({
    id: randomUUID(),
    userId: administrator.userId,
    permission: "administration.access",
    evidence: "Isolated activity test grant",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, administrator.id));
  return {
    administrator,
    target,
    stranger,
    actor: {
      userId: target.userId,
      id: administrator.id,
      administratorUserId: administrator.userId,
    },
  };
}
const note: ClientActivityCreateInput = {
  kind: "note",
  title: "Contact de suivi",
  description: "Note de test privée",
  state: "open",
  startsAt: null,
  endsAt: null,
  timezone: "Europe/Zurich",
};
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_client_activities_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

it("isolates activities between owners and exact person/company/self profiles; audits without note copies", async () => {
  const { actor, stranger } = await context();
  const repository = createClientActivityRepository(database.db);
  const profiles = createManagedProfileRepository(database.db);
  const person = await profiles.create(
    actor,
    { kind: "person", displayName: "Personne test" },
    randomUUID(),
  );
  const company = await profiles.create(
    actor,
    { kind: "legal_entity", displayName: "Société test" },
    randomUUID(),
  );
  for (const profileId of ["self", person.id, company.id]) {
    const saved = await repository.create(actor, profileId, note, randomUUID());
    expect(await repository.get(actor, profileId, saved.id)).toMatchObject({
      description: note.description,
      profileId,
    });
    expect((await repository.list(actor, profileId)).activities.map((row) => row.id)).toEqual([
      saved.id,
    ]);
    await expect(
      repository.get(actor, profileId === "self" ? person.id : "self", saved.id),
    ).rejects.toMatchObject({ code: "CLIENT_ACTIVITY_NOT_FOUND" });
    await expect(
      repository.get({ ...actor, userId: stranger.userId }, "self", saved.id),
    ).rejects.toMatchObject({ code: "CLIENT_ACTIVITY_NOT_FOUND" });
  }
  await expect(
    repository.create({ ...actor, userId: stranger.userId }, person.id, note, randomUUID()),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_NOT_FOUND" });
  const audit = await database.db
    .select()
    .from(clientActivityAudit)
    .where(eq(clientActivityAudit.userId, actor.userId));
  expect(audit).toHaveLength(3);
  expect(
    audit.every(
      (entry) =>
        entry.administratorUserId === actor.administratorUserId && entry.sessionId === actor.id,
    ),
  ).toBe(true);
  expect(JSON.stringify(audit)).not.toContain(note.description);
});

it("rechecks live administrative permission and MFA for reads, writes and replays", async () => {
  const { actor, administrator, target } = await context();
  const repository = createClientActivityRepository(database.db);
  const key = randomUUID();
  await repository.create(actor, "self", note, key);
  await expect(
    repository.list(
      { userId: target.userId, id: target.id, administratorUserId: target.userId },
      "self",
    ),
  ).rejects.toMatchObject({ code: "IDENTITY_ACCESS_DENIED" });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date(Date.now() - 25 * 3600000) })
    .where(eq(identitySessions.id, administrator.id));
  await expect(repository.list(actor, "self")).rejects.toMatchObject({
    code: "IDENTITY_MFA_REQUIRED",
  });
  await expect(repository.create(actor, "self", note, key)).rejects.toMatchObject({
    code: "IDENTITY_MFA_REQUIRED",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, administrator.id));
  await database.db
    .update(identityAdminPermissions)
    .set({ revokedAt: new Date() })
    .where(eq(identityAdminPermissions.userId, administrator.userId));
  await expect(repository.list(actor, "self")).rejects.toMatchObject({
    code: "IDENTITY_ACCESS_DENIED",
  });
});

it("deduplicates concurrent creates, rejects reused payloads and stale writes; replay cannot restore erased notes", async () => {
  const { actor } = await context();
  const repository = createClientActivityRepository(database.db);
  const key = randomUUID();
  const [first, duplicate] = await Promise.all([
    repository.create(actor, "self", note, key),
    repository.create(actor, "self", note, key),
  ]);
  expect(first).toEqual(duplicate);
  expect((await repository.list(actor, "self")).activities).toHaveLength(1);
  await expect(
    repository.create(actor, "self", { ...note, title: "Changed" }, key),
  ).rejects.toMatchObject({ code: "CLIENT_ACTIVITY_IDEMPOTENCY_REUSED" });
  const updated = await repository.update(
    actor,
    "self",
    first.id,
    { ...note, description: "", state: "completed", revision: 0 },
    randomUUID(),
  );
  expect(updated).toMatchObject({ description: "", revision: 1, state: "completed" });
  await expect(
    repository.update(actor, "self", first.id, { ...note, revision: 0 }, randomUUID()),
  ).rejects.toMatchObject({ code: "CLIENT_ACTIVITY_CONFLICT" });
  expect(await repository.create(actor, "self", note, key)).toEqual(updated);
  const commands = await database.db
    .select()
    .from(clientActivityCommands)
    .where(eq(clientActivityCommands.userId, actor.userId));
  expect(commands).toHaveLength(2);
  expect(JSON.stringify(commands)).not.toContain(note.description);
  await database.db
    .update(clientActivityCommands)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(
      and(eq(clientActivityCommands.userId, actor.userId), eq(clientActivityCommands.key, key)),
    );
  await repository.purgeExpiredCommands();
  expect(
    await database.db
      .select()
      .from(clientActivityCommands)
      .where(eq(clientActivityCommands.userId, actor.userId)),
  ).toHaveLength(1);
});

it("stores timed activities in UTC with their IANA timezone and rejects invalid scheduling", async () => {
  const { actor } = await context();
  const repository = createClientActivityRepository(database.db);
  for (const kind of ["task", "event", "appointment"] as const) {
    const input = {
      ...note,
      kind,
      startsAt: "2026-10-12T10:00:00+02:00",
      endsAt: "2026-10-12T11:00:00+02:00",
    };
    const saved = await repository.create(actor, "self", input, randomUUID());
    expect(saved).toMatchObject({
      kind,
      startsAt: "2026-10-12T08:00:00.000Z",
      endsAt: "2026-10-12T09:00:00.000Z",
      timezone: "Europe/Zurich",
    });
  }
  expect(clientActivityCreateInputSchema.safeParse({ ...note, kind: "appointment" }).success).toBe(
    false,
  );
  expect(
    clientActivityCreateInputSchema.safeParse({ ...note, endsAt: "2026-10-12T08:00:00Z" }).success,
  ).toBe(false);
  expect(
    clientActivityCreateInputSchema.safeParse({
      ...note,
      startsAt: "2026-10-12T10:00:00Z",
      endsAt: "2026-10-12T08:00:00Z",
    }).success,
  ).toBe(false);
  expect(
    clientActivityCreateInputSchema.safeParse({ ...note, timezone: "Invalid/Zone" }).success,
  ).toBe(false);
});

it("paginates newest-first without duplication and cannot use another profile's cursor", async () => {
  const { actor, stranger } = await context();
  const repository = createClientActivityRepository(database.db);
  const ids: string[] = [];
  for (let count = 0; count < 22; count++)
    ids.push(
      (
        await repository.create(
          actor,
          "self",
          { ...note, title: `Pagination ${count}` },
          randomUUID(),
        )
      ).id,
    );
  const first = await repository.list(actor, "self");
  expect(first.activities).toHaveLength(20);
  expect(first.activities[0]?.id).toBe(ids[21]);
  expect(first.nextCursor).toBeTruthy();
  const second = await repository.list(actor, "self", { cursor: first.nextCursor ?? undefined });
  expect(second.activities).toHaveLength(2);
  expect(second.nextCursor).toBeNull();
  expect(new Set([...first.activities, ...second.activities].map((entry) => entry.id)).size).toBe(
    22,
  );
  await expect(
    repository.list({ ...actor, userId: stranger.userId }, "self", {
      cursor: first.nextCursor ?? undefined,
    }),
  ).rejects.toMatchObject({ code: "CLIENT_ACTIVITY_NOT_FOUND" });
});
