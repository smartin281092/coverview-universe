import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "./db/database.js";
import { createAdminProfileTransferRepository } from "./admin-profile-transfer.repository.js";
import { adminProfileTransfers } from "./admin-profile-transfer.schema.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { identityAdminPermissions, identitySessions } from "../modules/identity/identity.schema.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { managedProfileSections } from "../modules/profiles/profiles.schema.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { createDocumentService } from "../modules/document-intelligence/document.service.js";
import {
  documents,
  documentCommands,
  documentOutbox,
} from "../modules/document-intelligence/document.schema.js";
import { createAuthorizationRepository } from "../modules/authorizations/authorizations.repository.js";
import { authorizationSignatures } from "../modules/authorizations/authorizations.schema.js";
import { createClientActivityRepository } from "../modules/client-activities/client-activities.repository.js";
import { actionCenterIdentity } from "../modules/document-intelligence/document.action-center.projection.js";
import { createActionCenterRepository } from "../modules/document-intelligence/document.action-center.repository.js";
import {
  actionCenterCommands,
  actionCenterManualReviews,
  actionCenterResolutions,
} from "../modules/document-intelligence/document.action-center.schema.js";
import {
  companyActionAudit,
  companyActionEvidence,
  companyServiceRequests,
} from "../modules/document-intelligence/document.company-actions.schema.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_profile_transfer_test")
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
async function owner(email = "owner@transfer.test") {
  const session = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email,
    device: "Isolated transfer test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!session) throw new Error("Isolated identity unavailable");
  return session;
}
async function fixture() {
  const [administrator, source, destination] = await Promise.all([owner(), owner(), owner()]);
  const permissionId = randomUUID();
  await database.db.insert(identityAdminPermissions).values({
    id: permissionId,
    userId: administrator.userId,
    permission: "administration.access",
    evidence: "Isolated transfer authorization",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, administrator.id));
  const actor = {
    userId: source.userId,
    id: administrator.id,
    administratorUserId: administrator.userId,
  };
  const profiles = createManagedProfileRepository(database.db);
  const profile = await profiles.create(
    source,
    { kind: "person", displayName: "Enfant devenu majeur" },
    randomUUID(),
  );
  return {
    source,
    destination,
    administrator,
    permissionId,
    actor,
    profiles,
    profile,
    transfers: createAdminProfileTransferRepository(database.db),
    documents: createDocumentRepository(database.db),
  };
}

it("lists each profile including holders, searches account or profile and paginates without duplicates", async () => {
  const user = await owner("directory-profiles@transfer.test");
  const profiles = createManagedProfileRepository(database.db);
  const person = await profiles.create(
    user,
    { kind: "person", displayName: "Directory% Enfant" },
    randomUUID(),
  );
  const company = await profiles.create(
    user,
    { kind: "legal_entity", displayName: "Directory Société" },
    randomUUID(),
  );
  const repository = createAdminProfileTransferRepository(database.db);
  const first = await repository.directory({ q: "directory-profiles", limit: 2 });
  const second = await repository.directory({
    q: "directory-profiles",
    limit: 2,
    cursor: first.nextCursor!,
  });
  const result = [...first.profiles, ...second.profiles];
  expect(result.map((entry) => entry.profileId).sort()).toEqual(
    ["self", person.id, company.id].sort(),
  );
  expect(
    result.every((entry) => entry.userId === user.userId && entry.accountEmail === user.email),
  ).toBe(true);
  expect(second.nextCursor).toBeNull();
  expect((await repository.directory({ q: "%" })).profiles.map((entry) => entry.profileId)).toEqual(
    [person.id],
  );
  await expect(
    repository.directory({ q: "different", cursor: first.nextCursor! }),
  ).rejects.toMatchObject({ statusCode: 400 });
});

it("atomically transfers the whole dossier, preserves original bytes and signer evidence, prevents source access and permits rereading", async () => {
  const f = await fixture();
  const general = await f.profiles.saveSection(
    f.source,
    f.profile.id,
    "general",
    {
      revision: 0,
      step: "information",
      fields: { firstName: "Enfant", lastName: "Test", avsNumber: "756.0000.0000.02" },
    },
    randomUUID(),
  );
  await f.profiles.saveSection(
    f.source,
    f.profile.id,
    "finances",
    { revision: 0, step: "information", fields: { currency: "CHF", savingsMinor: 12345 } },
    randomUUID(),
  );
  await f.profiles.saveSection(
    f.source,
    f.profile.id,
    "health",
    { revision: 0, step: "information", fields: { allergies: "Valeur privée isolée" } },
    randomUUID(),
  );
  // Storage is an explicit in-memory double; actual SQL, service upload/download and digest checks run.
  const objects = new Map<string, Buffer>();
  const service = createDocumentService(f.documents, {
    put: (key, bytes) => {
      objects.set(key, Buffer.from(bytes));
      return Promise.resolve();
    },
    get: (key) => {
      const bytes = objects.get(key);
      return bytes
        ? Promise.resolve(Buffer.from(bytes))
        : Promise.reject(new Error("Missing original"));
    },
    remove: (key) => {
      objects.delete(key);
      return Promise.resolve();
    },
    close: () => {},
  });
  const bytes = Buffer.from("%PDF-1.7\nDossier isolé\n%%EOF");
  const original = await f.documents.create(
    f.source,
    {
      profileId: f.profile.id,
      name: "dossier.pdf",
      mime: "application/pdf",
      size: bytes.length,
      checksum: digest(bytes),
      analysisRequested: false,
    },
    randomUUID(),
  );
  await service.upload(f.source, original.id, bytes);
  await database.db
    .update(documentOutbox)
    .set({ publishedAt: new Date() })
    .where(eq(documentOutbox.documentId, original.id));
  await f.documents.transition(f.source.userId, original.id, 1, {
    state: "ready",
    scanVersion: "isolated-antivirus",
  });
  const sourceInfo = {
    documentId: original.id,
    extractionId: randomUUID(),
    extractedAt: new Date().toISOString(),
  };
  await database.db
    .update(managedProfileSections)
    .set({ documentSources: { firstName: sourceInfo } })
    .where(
      and(
        eq(managedProfileSections.userId, f.source.userId),
        eq(managedProfileSections.managedProfileId, f.profile.id),
        eq(managedProfileSections.section, "general"),
      ),
    );
  const auth = createAuthorizationRepository(database.db);
  const draft = await auth.draft(f.source.userId, "mandate", f.profile.id);
  const signed = await auth.sign(
    f.source,
    "mandate",
    {
      profileId: f.profile.id,
      profileRevision: draft.profileRevision,
      contentHash: draft.contentHash,
      signerName: "Parent de test",
      place: "Genève",
      representative: true,
      accepted: true,
      drawing: [
        [
          [0.1, 0.1],
          [0.8, 0.8],
        ],
      ],
    },
    randomUUID(),
  );
  const activityRepo = createClientActivityRepository(database.db);
  const activity = await activityRepo.create(
    f.actor,
    f.profile.id,
    {
      kind: "task",
      title: "Suivi isolé",
      description: "Dossier à suivre",
      state: "open",
      startsAt: null,
      endsAt: null,
      timezone: "Europe/Zurich",
    },
    randomUUID(),
  );
  const requestId = randomUUID();
  await database.db.insert(companyServiceRequests).values({
    id: requestId,
    userId: f.source.userId,
    managedProfileId: f.profile.id,
    profileId: f.profile.id,
    profileName: "Enfant Test",
    companyId: "axa",
    group: "phone",
    values: { phone: "+41 22 123 45 67" },
    valuesHash: digest("phone"),
    profileRevision: general.revision,
    state: "confirmed",
  });
  await database.db.insert(companyActionEvidence).values({
    id: randomUUID(),
    userId: f.source.userId,
    requestId,
    kind: "confirmed",
    occurredAt: new Date(Date.now() - 1000),
    reference: "Preuve isolée",
    administratorUserId: f.administrator.userId,
  });
  await database.db.insert(companyActionAudit).values({
    id: randomUUID(),
    userId: f.source.userId,
    requestId,
    actorUserId: f.administrator.userId,
    sessionId: f.administrator.id,
    state: "confirmed",
    revision: 0,
  });
  const resolutionId = randomUUID();
  const oldActionId = actionCenterIdentity(f.source.userId, f.profile.id, "phone");
  await database.db.insert(actionCenterResolutions).values({
    id: resolutionId,
    userId: f.source.userId,
    managedProfileId: f.profile.id,
    profileId: f.profile.id,
    actionId: oldActionId,
    topic: "phone",
    observedHash: digest("observed"),
    profileHash: digest("profile"),
    fingerprint: digest("fingerprint"),
    actorUserId: f.source.userId,
    sessionId: f.source.id,
    history: {
      id: resolutionId,
      actionId: oldActionId,
      profileId: f.profile.id,
      profileName: "Enfant Test",
      topic: "phone",
      kind: "profile_review",
      choice: "custom",
      beforeValues: {},
      afterValues: {},
      response: "Rappeler",
      sources: [],
      createdAt: new Date().toISOString(),
      actor: "owner",
    },
  });
  await database.db.insert(actionCenterManualReviews).values({
    id: randomUUID(),
    userId: f.source.userId,
    resolutionId,
    actionId: oldActionId,
    profileId: f.profile.id,
    profileName: "Enfant Test",
    topic: "phone",
    response: "Rappeler",
  });
  const before = await f.profiles.get(f.source.userId, f.profile.id);
  const objectKey = (await f.documents.original(f.source.userId, original.id)).objectKey;
  const key = randomUUID();
  const input = { destinationUserId: f.destination.userId, revision: before.revision };
  const [transferred, replay] = await Promise.all([
    f.transfers.transfer(f.actor, f.profile.id, input, key),
    f.transfers.transfer(f.actor, f.profile.id, input, key),
  ]);
  expect(replay).toEqual(transferred);
  expect((await f.profiles.list(f.source.userId)).profiles.map((profile) => profile.id)).toEqual([
    "self",
  ]);
  expect((await f.profiles.get(f.destination.userId, f.profile.id)).displayName).toBe(
    before.displayName,
  );
  expect(await f.profiles.section(f.destination.userId, f.profile.id, "general")).toMatchObject({
    values: general.values,
    documentSources: { firstName: sourceInfo },
  });
  expect(
    (await f.profiles.section(f.destination.userId, f.profile.id, "health")).values.allergies,
  ).toBe("Valeur privée isolée");
  expect(
    (await f.profiles.section(f.destination.userId, f.profile.id, "finances")).values.savingsMinor,
  ).toBe(12345);
  expect((await service.download(f.destination, original.id)).bytes).toEqual(bytes);
  expect((await f.documents.original(f.destination.userId, original.id)).objectKey).toBe(objectKey);
  await expect(service.download(f.source, original.id)).rejects.toMatchObject({ statusCode: 404 });
  await expect(f.profiles.section(f.source.userId, f.profile.id, "health")).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(auth.receipt(f.source.userId, signed.id)).rejects.toMatchObject({ statusCode: 404 });
  expect(await auth.receipt(f.destination.userId, signed.id)).toEqual(signed);
  expect((await auth.status(f.destination.userId, f.profile.id)).mandate.signedAt).toBeNull();
  const [signature] = await database.db
    .select()
    .from(authorizationSignatures)
    .where(eq(authorizationSignatures.id, signed.id));
  expect(signature).toMatchObject({ userId: f.destination.userId, sessionId: f.source.id });
  expect(signature?.revokedAt).toBeInstanceOf(Date);
  expect(
    (
      await activityRepo.list({ ...f.actor, userId: f.destination.userId }, f.profile.id)
    ).activities.map((row) => row.id),
  ).toEqual([activity.id]);
  const [resolution] = await database.db
    .select()
    .from(actionCenterResolutions)
    .where(eq(actionCenterResolutions.id, resolutionId));
  expect(resolution).toMatchObject({
    userId: f.destination.userId,
    actorUserId: f.source.userId,
    sessionId: f.source.id,
    actionId: actionCenterIdentity(f.destination.userId, f.profile.id, "phone"),
  });
  expect(resolution?.history.actionId).toBe(resolution?.actionId);
  const [review] = await database.db
    .select()
    .from(actionCenterManualReviews)
    .where(eq(actionCenterManualReviews.resolutionId, resolutionId));
  expect(review?.userId).toBe(f.destination.userId);
  expect(review?.actionId).toBe(resolution?.actionId);
  for (const table of [companyActionEvidence, companyActionAudit]) {
    const [row] = await database.db.select().from(table).where(eq(table.requestId, requestId));
    expect(row?.userId).toBe(f.destination.userId);
  }
  expect(
    await database.db
      .select()
      .from(documentCommands)
      .where(eq(documentCommands.documentId, original.id)),
  ).toEqual([]);
  const targetDoc = await f.documents.get(f.destination.userId, original.id);
  await f.documents.retry(f.destination, original.id, targetDoc.revision, true, randomUUID());
  await f.documents.transition(f.destination.userId, original.id, 2, { state: "reading" });
  expect(
    (
      await f.documents.reserveAi(
        f.destination.userId,
        original.id,
        2,
        "isolated-no-provider-call",
        10,
      )
    )?.existing,
  ).toBe(false);
  expect(await f.documents.jobRow(f.source.userId, original.id, 1)).toBeUndefined();
  await expect(
    f.transfers.transfer(f.actor, f.profile.id, { ...input, revision: input.revision + 1 }, key),
  ).rejects.toMatchObject({ code: "PROFILE_TRANSFER_IDEMPOTENCY_REUSED" });
});

it("requires administration and MFA, refuses holder/active documents and preserves data after rejected requests", async () => {
  const f = await fixture();
  const input = { destinationUserId: f.destination.userId, revision: f.profile.revision };
  await expect(
    f.transfers.transfer(f.source, f.profile.id, input, randomUUID()),
  ).rejects.toMatchObject({ code: "IDENTITY_ACCESS_DENIED" });
  await expect(f.transfers.transfer(f.actor, "self", input, randomUUID())).rejects.toMatchObject({
    code: "PROFILE_TRANSFER_SELF_UNAVAILABLE",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: null })
    .where(eq(identitySessions.id, f.administrator.id));
  await expect(
    f.transfers.transfer(f.actor, f.profile.id, input, randomUUID()),
  ).rejects.toMatchObject({ code: "IDENTITY_MFA_REQUIRED" });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, f.administrator.id));
  const doc = await f.documents.create(
    f.source,
    {
      profileId: f.profile.id,
      name: "pending.pdf",
      mime: "application/pdf",
      size: 80,
      checksum: digest("pending"),
      analysisRequested: false,
    },
    randomUUID(),
  );
  await expect(
    f.transfers.transfer(f.actor, f.profile.id, input, randomUUID()),
  ).rejects.toMatchObject({ code: "PROFILE_TRANSFER_BUSY" });
  expect((await f.documents.original(f.source.userId, doc.id)).userId).toBe(f.source.userId);
  expect((await f.profiles.get(f.source.userId, f.profile.id)).revision).toBe(0);
  await database.db
    .update(identityAdminPermissions)
    .set({ revokedAt: new Date() })
    .where(eq(identityAdminPermissions.id, f.permissionId));
  await expect(
    f.transfers.transfer(f.actor, f.profile.id, input, randomUUID()),
  ).rejects.toMatchObject({ code: "IDENTITY_ACCESS_DENIED" });
});

it("rolls all ownership and cache changes back if the final durable transfer receipt cannot be written", async () => {
  const f = await fixture();
  await f.profiles.saveSection(
    f.source,
    f.profile.id,
    "health",
    {
      revision: 0,
      step: "information",
      fields: { allergies: "Rollback isolé" },
    },
    randomUUID(),
  );
  const doc = await f.documents.create(
    f.source,
    {
      profileId: f.profile.id,
      name: "rollback.pdf",
      mime: "application/pdf",
      size: 80,
      checksum: digest("rollback"),
      analysisRequested: false,
    },
    randomUUID(),
  );
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated" })
    .where(eq(documents.id, doc.id));
  const beforeCommands = await database.db
    .select()
    .from(documentCommands)
    .where(eq(documentCommands.documentId, doc.id));
  const before = await f.profiles.get(f.source.userId, f.profile.id);
  await database.db.execute(
    sql`create function reject_isolated_transfer() returns trigger language plpgsql as $$ begin raise exception 'isolated transfer failure'; end $$`,
  );
  await database.db.execute(
    sql`create trigger reject_isolated_transfer before insert on admin_profile_transfers for each row execute function reject_isolated_transfer()`,
  );
  try {
    await expect(
      f.transfers.transfer(
        f.actor,
        f.profile.id,
        { destinationUserId: f.destination.userId, revision: before.revision },
        randomUUID(),
      ),
    ).rejects.toThrow();
    expect((await f.profiles.get(f.source.userId, f.profile.id)).revision).toBe(before.revision);
    expect(
      (await f.profiles.section(f.source.userId, f.profile.id, "health")).values.allergies,
    ).toBe("Rollback isolé");
    expect((await f.documents.original(f.source.userId, doc.id)).userId).toBe(f.source.userId);
    expect(
      await database.db
        .select()
        .from(documentCommands)
        .where(eq(documentCommands.documentId, doc.id)),
    ).toEqual(beforeCommands);
    await expect(f.profiles.get(f.destination.userId, f.profile.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(
      await database.db
        .select()
        .from(adminProfileTransfers)
        .where(eq(adminProfileTransfers.profileId, f.profile.id)),
    ).toEqual([]);
  } finally {
    await database.db.execute(
      sql`drop trigger reject_isolated_transfer on admin_profile_transfers`,
    );
    await database.db.execute(sql`drop function reject_isolated_transfer()`);
  }
});

it("allows exactly one concurrent destination and rejects stale ownership before any second move", async () => {
  const f = await fixture();
  const otherDestination = await owner();
  const results = await Promise.allSettled(
    [f.destination, otherDestination].map((destination) =>
      f.transfers.transfer(
        f.actor,
        f.profile.id,
        { destinationUserId: destination.userId, revision: 0 },
        randomUUID(),
      ),
    ),
  );
  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  const failed = results.find((result) => result.status === "rejected");
  expect(failed?.status === "rejected" ? failed.reason : null).toMatchObject({
    code: "PROFILE_TRANSFER_CONFLICT",
  });
  const rows = await database.db
    .select()
    .from(adminProfileTransfers)
    .where(eq(adminProfileTransfers.profileId, f.profile.id));
  expect(rows).toHaveLength(1);
  expect((await f.profiles.get(rows[0]!.destinationUserId, f.profile.id)).revision).toBe(1);
});

it("removes cached action responses from the former account while keeping the transferred history readable", async () => {
  const f = await fixture();
  const center = createActionCenterRepository(database.db);
  const id = actionCenterIdentity(f.source.userId, f.profile.id, "firstName");
  const { action } = await center.details(f.source.userId, id);
  const key = randomUUID();
  const input = {
    fingerprint: action.fingerprint,
    choice: "custom" as const,
    response: "Veuillez appeler le client.",
  };
  const result = await center.resolve(f.source, id, input, key);
  expect(
    (await database.db.select().from(actionCenterCommands).where(eq(actionCenterCommands.key, key)))
      .length,
  ).toBe(1);
  const current = await f.profiles.get(f.source.userId, f.profile.id);
  await f.transfers.transfer(
    f.actor,
    f.profile.id,
    { destinationUserId: f.destination.userId, revision: current.revision },
    randomUUID(),
  );
  expect(
    await database.db.select().from(actionCenterCommands).where(eq(actionCenterCommands.key, key)),
  ).toEqual([]);
  await expect(center.resolve(f.source, id, input, key)).rejects.toMatchObject({ statusCode: 404 });
  const history = await center.history(f.destination.userId, { profileId: f.profile.id });
  expect(history.entries.find((entry) => entry.id === result.resolution.id)).toMatchObject({
    response: input.response,
    actionId: actionCenterIdentity(f.destination.userId, f.profile.id, "firstName"),
  });
  const previousHistory = await center.history(f.source.userId);
  expect(previousHistory.entries.some((entry) => entry.id === result.resolution.id)).toBe(false);
});
