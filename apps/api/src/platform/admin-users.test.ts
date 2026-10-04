import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createAdminUserRepository } from "../modules/identity/identity.admin.repository.js";
import {
  createProfileRepository,
  lockProfileOwner,
} from "../modules/identity/identity.profile.repository.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import {
  identityAdminPermissions,
  identityAuditEvents,
  identitySessions,
  identityUsers,
} from "../modules/identity/identity.schema.js";
import { profileChoices } from "../modules/identity/identity.profile.schema.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { createDocumentService } from "../modules/document-intelligence/document.service.js";
import { documents } from "../modules/document-intelligence/document.schema.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function owner(email = "ordinary@admin-tests.test") {
  const session = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email,
    device: "Administrator boundary test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!session) throw new Error("Test identity unavailable");
  return session;
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_admin_users_test")
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

it("keeps administrator, session, target and owner authority distinct; rechecks MFA and permission under locks", async () => {
  const administrator = await owner("administrator@admin-tests.test");
  const target = await owner();
  const stranger = await owner();
  const profiles = createProfileRepository(database.db);
  const managed = createManagedProfileRepository(database.db);
  const actor = {
    userId: target.userId,
    id: administrator.id,
    administratorUserId: administrator.userId,
  };
  const input = { revision: 0, step: "information" as const, fields: { firstName: "Titulaire" } };
  await expect(
    profiles.save(target.userId, administrator.id, input, randomUUID()),
  ).rejects.toMatchObject({ code: "IDENTITY_UNAUTHENTICATED" });
  await expect(
    database.db.transaction((tx) => lockProfileOwner(tx, target.userId, administrator.id)),
  ).rejects.toMatchObject({ code: "IDENTITY_UNAUTHENTICATED" });
  await expect(
    profiles.save(target.userId, administrator.id, input, randomUUID(), administrator.userId),
  ).rejects.toMatchObject({ code: "IDENTITY_ACCESS_DENIED" });
  const permissionId = randomUUID();
  await database.db.insert(identityAdminPermissions).values({
    id: permissionId,
    userId: administrator.userId,
    permission: "administration.access",
    evidence: "Isolated automated-test grant",
  });
  await expect(
    managed.create(actor, { kind: "person", displayName: "Famille" }, randomUUID()),
  ).rejects.toMatchObject({ code: "IDENTITY_MFA_REQUIRED" });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, administrator.id));
  const key = randomUUID();
  const saved = await profiles.save(
    target.userId,
    administrator.id,
    input,
    key,
    administrator.userId,
  );
  expect(saved.fields.firstName).toMatchObject({
    value: "Titulaire",
    source: "user_entered",
    confirmedAt: null,
  });
  expect(saved.prefill).toMatchObject({ enabled: false, decidedAt: null });
  expect(
    await database.db.select().from(profileChoices).where(eq(profileChoices.userId, target.userId)),
  ).toHaveLength(0);
  expect((await profiles.get(administrator.userId)).fields).toEqual({});
  expect((await profiles.get(stranger.userId)).fields).toEqual({});
  await expect(profiles.save(target.userId, target.id, input, key)).rejects.toMatchObject({
    code: "PROFILE_IDEMPOTENCY_REUSED",
  });
  await expect(
    profiles.save(
      target.userId,
      administrator.id,
      { ...input, revision: saved.revision },
      randomUUID(),
      stranger.userId,
    ),
  ).rejects.toMatchObject({ code: "IDENTITY_UNAUTHENTICATED" });
  const createKey = randomUUID();
  const creation = { kind: "person" as const, displayName: "Membre de la famille" };
  const [person, replay] = await Promise.all([
    managed.create(actor, creation, createKey),
    managed.create(actor, creation, createKey),
  ]);
  expect(replay.id).toBe(person.id);
  expect((await managed.list(target.userId)).profiles).toHaveLength(2);
  await expect(managed.create(target, creation, createKey)).rejects.toMatchObject({
    code: "MANAGED_PROFILE_IDEMPOTENCY_REUSED",
  });
  const section = await managed.saveSection(
    actor,
    person.id,
    "general",
    { revision: 0, step: "details", fields: { firstName: "Enfant" } },
    randomUUID(),
  );
  expect(section.values.firstName).toBe("Enfant");
  expect(section.confirmedAt).toBeNull();
  const sections = {
    finances: {
      annualIncomeMinor: 6000000,
      monthlyExpensesMinor: 250000,
      savingsMinor: 0,
      debtsMinor: 10000,
      currency: "CHF" as const,
    },
    health: {
      insurer: "Test insurer",
      primaryDoctorName: "Test doctor",
      deductibleMinor: 250000,
      accidentCoverage: "yes" as const,
      heightCm: 170,
      weightKg: 65,
      smokingStatus: "never" as const,
      allergies: "Test note",
      chronicConditions: "Test note",
      ongoingTreatments: "Test note",
    },
  };
  for (const profileId of ["self", person.id]) {
    for (const sectionName of ["finances", "health"] as const) {
      const fields = sections[sectionName];
      const written = await managed.saveSection(
        actor,
        profileId,
        sectionName,
        { revision: 0, step: "information", fields },
        randomUUID(),
      );
      expect((await managed.section(target.userId, profileId, sectionName)).values).toEqual(fields);
      const cleared = await managed.saveSection(
        target,
        profileId,
        sectionName,
        {
          revision: written.revision,
          step: "information",
          fields: Object.fromEntries(Object.keys(fields).map((name) => [name, null])),
        },
        randomUUID(),
      );
      expect(cleared.values).toEqual({});
    }
  }
  await expect(
    managed.saveSection(
      actor,
      person.id,
      "general",
      { revision: section.revision, step: "review", fields: {}, confirm: true },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_INVALID_FIELDS" });
  await expect(
    managed.saveSection(
      { ...actor, userId: stranger.userId },
      person.id,
      "general",
      { revision: 0, step: "information", fields: {} },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_NOT_FOUND" });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date(Date.now() - 24 * 3600_000) })
    .where(eq(identitySessions.id, administrator.id));
  await expect(managed.create(actor, creation, randomUUID())).rejects.toMatchObject({
    code: "IDENTITY_MFA_REQUIRED",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, administrator.id));
  await database.db
    .update(identityAdminPermissions)
    .set({ revokedAt: new Date() })
    .where(eq(identityAdminPermissions.id, permissionId));
  await expect(
    profiles.save(
      target.userId,
      administrator.id,
      { ...input, revision: saved.revision },
      randomUUID(),
      administrator.userId,
    ),
  ).rejects.toMatchObject({ code: "IDENTITY_ACCESS_DENIED" });
  expect((await profiles.get(target.userId)).revision).toBe(saved.revision);
});

it("shares Admin uploads with the target Wallet profile and protects originals before scan and outside the owner", async () => {
  const administrator = await owner();
  const target = await owner();
  const stranger = await owner();
  await database.db.insert(identityAdminPermissions).values({
    id: randomUUID(),
    userId: administrator.userId,
    permission: "administration.access",
    evidence: "Isolated upload test",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, administrator.id));
  const actor = {
    userId: target.userId,
    id: administrator.id,
    administratorUserId: administrator.userId,
  };
  const managed = createManagedProfileRepository(database.db);
  const person = await managed.create(
    actor,
    { kind: "person", displayName: "Family" },
    randomUUID(),
  );
  const company = await managed.create(
    actor,
    { kind: "legal_entity", displayName: "Company" },
    randomUUID(),
  );
  const repository = createDocumentRepository(database.db);
  // PostgreSQL and upload/download service are real; object storage and antivirus are explicit doubles.
  const objects = new Map<string, Buffer>();
  const service = createDocumentService(repository, {
    put: (key, bytes) => {
      objects.set(key, Buffer.from(bytes));
      return Promise.resolve();
    },
    get: (key) => {
      const bytes = objects.get(key);
      if (!bytes) return Promise.reject(new Error("Missing test original"));
      return Promise.resolve(Buffer.from(bytes));
    },
    remove: (key) => {
      objects.delete(key);
      return Promise.resolve();
    },
    close: () => {},
  });
  for (const profileId of ["self", person.id, company.id]) {
    const bytes = Buffer.from(`%PDF-1.7\nIsolated upload ${profileId}\n%%EOF`);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const created = await repository.create(
      actor,
      {
        profileId,
        name: "original.pdf",
        mime: "application/pdf",
        size: bytes.length,
        checksum,
        analysisRequested: false,
      },
      randomUUID(),
    );
    await expect(service.upload(stranger, created.id, bytes)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      service.upload(actor, created.id, Buffer.alloc(bytes.length)),
    ).rejects.toMatchObject({ code: "DOCUMENT_UPLOAD_INVALID" });
    const uploaded = await service.upload(actor, created.id, bytes);
    expect(uploaded).toMatchObject({ profileId, state: "queued" });
    expect(await service.upload(actor, created.id, bytes)).toEqual(uploaded);
    expect(
      (await repository.list(target.userId, undefined, { profileId })).documents.map(
        (file) => file.id,
      ),
    ).toContain(created.id);
    await expect(service.download(target, created.id)).rejects.toMatchObject({
      code: "DOCUMENT_DOWNLOAD_BLOCKED",
    });
    await database.db
      .update(documents)
      .set({ state: "ready", scanVersion: "isolated-antivirus" })
      .where(eq(documents.id, created.id));
    expect((await service.download(target, created.id)).bytes).toEqual(bytes);
    expect((await service.download(actor, created.id)).checksum).toBe(checksum);
    await expect(service.download(stranger, created.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      repository.assertTarget(target.userId, profileId === "self" ? person.id : "self", created.id),
    ).rejects.toMatchObject({ statusCode: 404 });
  }
  expect(
    (await repository.list(target.userId, undefined, { scope: "account" })).documents,
  ).toHaveLength(3);
  expect(
    (await repository.list(administrator.userId, undefined, { scope: "account" })).documents,
  ).toHaveLength(0);
});

it("paginates users in stable order, searches literal names/emails, binds cursor to search and records target metadata without PII", async () => {
  const users = await Promise.all([
    owner("directory_alpha@admin-tests.test"),
    owner("directory_beta@admin-tests.test"),
    owner("directory_gamma@admin-tests.test"),
  ]);
  const fixedDate = new Date("2026-01-02T00:00:00.000Z");
  await database.db
    .update(identityUsers)
    .set({ createdAt: fixedDate })
    .where(
      inArray(
        identityUsers.id,
        users.map((user) => user.userId),
      ),
    );
  const repository = createAdminUserRepository(database.db);
  const first = await repository.list({ q: "directory_", limit: 2 });
  expect(first.users).toHaveLength(2);
  expect(first.nextCursor).not.toBeNull();
  const second = await repository.list({
    q: "directory_",
    limit: 2,
    cursor: first.nextCursor ?? undefined,
  });
  expect(second.nextCursor).toBeNull();
  expect([...first.users, ...second.users].map((user) => user.id)).toEqual(
    users
      .map((user) => user.userId)
      .sort()
      .reverse(),
  );
  expect((await repository.list({ q: "%", limit: 50 })).users).toEqual([]);
  await expect(
    repository.list({ q: "other", cursor: first.nextCursor ?? undefined }),
  ).rejects.toMatchObject({ statusCode: 400 });
  await expect(repository.list({ cursor: "not_a_cursor" })).rejects.toMatchObject({
    statusCode: 400,
  });
  await expect(repository.list({ limit: 51 })).rejects.toThrow();
  const actor = users[0];
  const target = users[1];
  if (!actor || !target) throw new Error("Expected directory test actors");
  await createProfileRepository(database.db).save(
    target.userId,
    target.id,
    { revision: 0, step: "information", fields: { firstName: "Recherche", lastName: "Distincte" } },
    randomUUID(),
  );
  expect(
    (await repository.list({ q: "recherche distincte" })).users.map((user) => user.id),
  ).toEqual([target.userId]);
  expect((await repository.get(target.userId)).displayName).toBe("Recherche Distincte");
  const requestId = randomUUID();
  await repository.audit(actor, requestId, target.userId, "profile:self", "read");
  const [audit] = await database.db
    .select()
    .from(identityAuditEvents)
    .where(
      and(
        eq(identityAuditEvents.requestId, requestId),
        eq(identityAuditEvents.action, "administration.access"),
      ),
    );
  expect(audit).toMatchObject({ userId: actor.userId, sessionId: actor.id });
  expect(JSON.parse(audit?.deduplicationKey ?? "{}")).toMatchObject({
    targetUserId: target.userId,
    resource: "profile:self",
    operation: "read",
  });
  expect(JSON.stringify(audit)).not.toContain(target.email);
});
