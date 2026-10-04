import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import {
  documents,
  managedDocumentIdentityAttachments,
} from "../modules/document-intelligence/document.schema.js";
import type { DocumentAnalysis } from "@coverview/contracts";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_attachment_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});
async function owner() {
  const session = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "attachment-owner@isolated.test",
    device: "Isolated test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!session) throw new Error("Isolated identity unavailable");
  return session;
}
it("makes a detected passport available only to its assigned profile, while preserving explicit choices", async () => {
  const actor = await owner();
  const stranger = await owner();
  const repository = createDocumentRepository(database.db);
  const profiles = createManagedProfileRepository(database.db);
  const person = await profiles.create(
    actor,
    { kind: "person", displayName: "Family" },
    randomUUID(),
  );
  const company = await profiles.create(
    actor,
    { kind: "legal_entity", displayName: "Company" },
    randomUUID(),
  );
  const passportAnalysis: DocumentAnalysis = {
    category: "identity",
    evidence: null,
    pages: [{ page: 1, text: "PASSEPORT", method: "isolated", version: "1" }],
    fields: [
      {
        id: randomUUID(),
        field: "documentType",
        value: "Passeport",
        source: {
          page: 1,
          text: "PASSEPORT",
          method: "isolated",
          version: "1",
          confidence: null,
          box: null,
        },
      },
    ],
  };
  const original = await repository.create(
    actor,
    {
      profileId: person.id,
      name: "original.pdf",
      mime: "application/pdf",
      size: 80,
      checksum: digest(randomUUID()),
      analysisRequested: true,
    },
    randomUUID(),
  );
  const update = async (patch: Partial<typeof documents.$inferInsert>) => {
    await database.db.update(documents).set(patch).where(eq(documents.id, original.id));
  };
  await update({
    state: "ready",
    category: "identity",
    scanVersion: "isolated",
    analysis: passportAnalysis,
  });
  expect(await repository.identityAttachment(actor.userId, person.id)).toMatchObject({
    status: "ready",
    front: { id: original.id },
    documentType: "passport",
    documentTypeSource: "detected",
    backRequired: false,
  });
  expect((await repository.identityAttachment(actor.userId)).status).toBe("missing");
  expect((await repository.identityAttachment(stranger.userId)).status).toBe("missing");
  await expect(repository.identityAttachment(stranger.userId, person.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  await update({ managedProfileId: company.id });
  expect((await repository.identityAttachment(actor.userId, company.id)).status).toBe("missing");
  await update({ managedProfileId: null, profileAssignment: "ambiguous" });
  expect((await repository.identityAttachment(actor.userId)).status).toBe("missing");
  await update({ profileAssignment: "manual" });
  expect((await repository.identityAttachment(actor.userId)).status).toBe("ready");
  for (const state of ["quarantined", "deleting", "deleted"] as const) {
    await update({ state });
    expect((await repository.identityAttachment(actor.userId)).status).toBe("missing");
  }
  await update({ state: "ready", scanVersion: null });
  expect((await repository.identityAttachment(actor.userId)).status).toBe("missing");
  await update({ scanVersion: "isolated", analysis: { ...passportAnalysis, pages: [] } });
  expect((await repository.identityAttachment(actor.userId)).status).toBe("missing");
  await update({ analysis: passportAnalysis });
  const corrected = await repository.saveIdentityAttachment(
    actor,
    { revision: 0, documentType: "identity_card" },
    randomUUID(),
  );
  expect(corrected).toMatchObject({
    front: { id: original.id },
    documentType: "identity_card",
    status: "incomplete",
  });
  const removed = await repository.saveIdentityAttachment(
    actor,
    { revision: 1, combinedId: null, frontId: null, backId: null },
    randomUUID(),
  );
  expect(removed.status).toBe("missing");
  expect((await repository.identityAttachment(actor.userId)).status).toBe("missing");
});
it("persists both faces with partial recovery, owner isolation and replay without a false ready state", async () => {
  const actor = await owner();
  const stranger = await owner();
  const repository = createDocumentRepository(database.db);
  const create = async (checksum: string, identity = true) =>
    repository.create(
      actor,
      {
        name: "original.jpg",
        mime: "image/jpeg",
        size: 80,
        checksum: digest(checksum),
        analysisRequested: false,
        ...(identity ? { purpose: "identity_card" as const } : {}),
      },
      randomUUID(),
    );
  const front = await create("front");
  const back = await create("back");
  const unrelated = await create("insurance", false);
  await expect(
    repository.saveIdentityAttachment(
      { userId: actor.userId, id: stranger.id },
      { revision: 0, frontId: front.id },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "IDENTITY_UNAUTHENTICATED" });
  expect((await repository.identityAttachment(actor.userId)).status).toBe("missing");
  const firstInput = { revision: 0, frontId: front.id };
  const firstKey = randomUUID();
  const [first, replay] = await Promise.all([
    repository.saveIdentityAttachment(actor, firstInput, firstKey),
    repository.saveIdentityAttachment(actor, firstInput, firstKey),
  ]);
  expect(first.revision).toBe(1);
  expect(replay).toEqual(first);
  expect(first.status).toBe("processing");
  expect(first.front?.id).toBe(front.id);
  expect(first.back).toBeNull();
  expect((await repository.identityAttachment(stranger.userId)).status).toBe("missing");
  await expect(
    repository.saveIdentityAttachment(stranger, { revision: 0, frontId: front.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_NOT_FOUND" });
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 1, frontId: unrelated.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  await expect(
    repository.saveIdentityAttachment(actor, { ...firstInput, frontId: back.id }, firstKey),
  ).rejects.toMatchObject({ code: "DOCUMENT_IDEMPOTENCY_REUSED" });
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 0, backId: back.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_CONFLICT" });
  await repository.uploaded(actor, front.id, "image/jpeg");
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated-antivirus" })
    .where(and(eq(documents.userId, actor.userId), eq(documents.id, front.id)));
  expect((await repository.identityAttachment(actor.userId)).status).toBe("incomplete");
  const complete = await repository.saveIdentityAttachment(
    actor,
    { revision: 1, backId: back.id },
    randomUUID(),
  );
  expect(complete.front?.id).toBe(front.id);
  expect(complete.status).toBe("processing");
  await repository.uploaded(actor, back.id, "image/jpeg");
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated-antivirus" })
    .where(and(eq(documents.userId, actor.userId), eq(documents.id, back.id)));
  expect((await repository.identityAttachment(actor.userId)).status).toBe("ready");
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 2, backId: front.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  const duplicate = await create("front");
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 2, backId: duplicate.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 2, combinedId: front.id }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  await database.db
    .update(documents)
    .set({ category: "insurance" })
    .where(eq(documents.id, back.id));
  expect((await repository.identityAttachment(actor.userId)).status).toBe("needs_attention");
  await database.db
    .update(documents)
    .set({ category: "identity", state: "quarantined" })
    .where(eq(documents.id, back.id));
  expect((await repository.identityAttachment(actor.userId)).status).toBe("needs_attention");
  await repository.remove(actor, front.id);
  const afterRemoval = await repository.saveIdentityAttachment(actor, firstInput, firstKey);
  expect(afterRemoval.front).toBeNull();
  expect(afterRemoval.status).toBe("needs_attention");
  expect(afterRemoval.revision).toBe(2);
  const cleared = await repository.saveIdentityAttachment(
    actor,
    { revision: 2, frontId: null, backId: null },
    randomUUID(),
  );
  expect(cleared.status).toBe("missing");
  expect(cleared.revision).toBe(3);
  const combined = await create("combined");
  await repository.uploaded(actor, combined.id, "image/jpeg");
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated-antivirus" })
    .where(eq(documents.id, combined.id));
  expect(
    (
      await repository.saveIdentityAttachment(
        actor,
        { revision: 3, combinedId: combined.id },
        randomUUID(),
      )
    ).status,
  ).toBe("ready");
});

it("persists independent identity documents per profile and prevents cross-profile and cross-owner references", async () => {
  const actor = await owner();
  const stranger = await owner();
  const profiles = createManagedProfileRepository(database.db);
  const repository = createDocumentRepository(database.db);
  const first = await profiles.create(
    actor,
    { kind: "person", displayName: "First profile" },
    randomUUID(),
  );
  const second = await profiles.create(
    actor,
    { kind: "person", displayName: "Second profile" },
    randomUUID(),
  );
  const create = (profileId: string) =>
    repository.create(
      actor,
      {
        profileId,
        name: "Passport.jpg",
        mime: "image/jpeg",
        size: 80,
        checksum: digest(randomUUID()),
        analysisRequested: false,
        purpose: "identity_card",
      },
      randomUUID(),
    );
  const ownFile = await create("self");
  const firstFile = await create(first.id);
  const secondFile = await create(second.id);
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated" })
    .where(eq(documents.userId, actor.userId));
  const firstInput = {
    profileId: first.id,
    revision: 0,
    frontId: firstFile.id,
    documentType: "passport" as const,
  };
  const key = randomUUID();
  const [saved, replay] = await Promise.all([
    repository.saveIdentityAttachment(actor, firstInput, key),
    repository.saveIdentityAttachment(actor, firstInput, key),
  ]);
  expect(saved).toEqual(replay);
  expect(saved).toMatchObject({
    profileId: first.id,
    revision: 1,
    status: "ready",
    documentType: "passport",
    documentTypeSource: "declared",
    backRequired: false,
    back: null,
  });
  expect(
    await createDocumentRepository(database.db).identityAttachment(actor.userId, first.id),
  ).toEqual(saved);
  expect((await repository.identityAttachment(actor.userId)).status).toBe("missing");
  expect((await repository.identityAttachment(actor.userId, second.id)).status).toBe("missing");
  await expect(repository.identityAttachment(stranger.userId, first.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    repository.saveIdentityAttachment(stranger, firstInput, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 404 });
  for (const id of [ownFile.id, secondFile.id]) {
    await expect(
      repository.saveIdentityAttachment(
        actor,
        { profileId: first.id, revision: 1, frontId: id },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_NOT_FOUND" });
    await expect(
      database.db
        .update(managedDocumentIdentityAttachments)
        .set({ frontId: id })
        .where(
          and(
            eq(managedDocumentIdentityAttachments.userId, actor.userId),
            eq(managedDocumentIdentityAttachments.managedProfileId, first.id),
          ),
        ),
    ).rejects.toThrow();
  }
  await expect(
    repository.saveIdentityAttachment(
      actor,
      { ...firstInput, profileId: second.id, frontId: secondFile.id },
      key,
    ),
  ).rejects.toMatchObject({ code: "DOCUMENT_IDEMPOTENCY_REUSED" });
  await expect(
    repository.saveIdentityAttachment(
      actor,
      { ...firstInput, documentType: "residence_permit" },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "DOCUMENT_CONFLICT" });
  const changed = await repository.saveIdentityAttachment(
    actor,
    { profileId: first.id, revision: 1, documentType: "residence_permit" },
    randomUUID(),
  );
  expect(changed).toMatchObject({
    revision: 2,
    status: "incomplete",
    documentType: "residence_permit",
    backRequired: true,
  });
  await repository.remove(actor, firstFile.id);
  expect(await repository.saveIdentityAttachment(actor, firstInput, key)).toMatchObject({
    revision: 2,
    front: null,
    status: "needs_attention",
  });
  const cleared = await repository.saveIdentityAttachment(
    actor,
    { profileId: first.id, revision: 2, frontId: null },
    randomUUID(),
  );
  expect(cleared.status).toBe("missing");
});

it("requires a cited identity type to detect a one-page passport and keeps manual corrections", async () => {
  const actor = await owner();
  const repository = createDocumentRepository(database.db);
  const file = await repository.create(
    actor,
    {
      name: "Passport.jpg",
      mime: "image/jpeg",
      size: 80,
      checksum: digest(randomUUID()),
      analysisRequested: true,
      purpose: "identity_card",
    },
    randomUUID(),
  );
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated" })
    .where(eq(documents.id, file.id));
  const saved = await repository.saveIdentityAttachment(
    actor,
    { revision: 0, frontId: file.id },
    randomUUID(),
  );
  expect(saved).toMatchObject({
    status: "incomplete",
    documentType: "unknown",
    documentTypeSource: "unknown",
    backRequired: true,
  });
  const analysis = (value: string, quote: string, page: string): DocumentAnalysis => ({
    category: "identity",
    evidence: null,
    pages: [{ page: 1, text: page, method: "isolated", version: "1" }],
    fields: [
      {
        id: randomUUID(),
        field: "documentType",
        value,
        source: {
          page: 1,
          text: quote,
          method: "isolated",
          version: "1",
          confidence: null,
          box: null,
        },
      },
    ],
  });
  await database.db
    .update(documents)
    .set({ analysis: analysis("Passeport", "PASSEPORT", "CARTE D’IDENTITÉ") })
    .where(eq(documents.id, file.id));
  expect((await repository.identityAttachment(actor.userId)).documentType).toBe("unknown");
  await database.db
    .update(documents)
    .set({ analysis: analysis("Passeport", "CARTE D’IDENTITÉ", "CARTE D’IDENTITÉ") })
    .where(eq(documents.id, file.id));
  expect((await repository.identityAttachment(actor.userId)).documentType).toBe("unknown");
  await database.db
    .update(documents)
    .set({ analysis: analysis("Passeport", "PASSEPORT", "PASSEPORT\nOriginal") })
    .where(eq(documents.id, file.id));
  expect(await repository.identityAttachment(actor.userId)).toMatchObject({
    status: "ready",
    documentType: "passport",
    documentTypeSource: "detected",
    backRequired: false,
  });
  const corrected = await repository.saveIdentityAttachment(
    actor,
    { revision: 1, documentType: "identity_card" },
    randomUUID(),
  );
  expect(corrected).toMatchObject({
    status: "incomplete",
    documentTypeSource: "declared",
    documentType: "identity_card",
    backRequired: true,
  });
  const automatic = await repository.saveIdentityAttachment(
    actor,
    { revision: 2, documentType: "unknown" },
    randomUUID(),
  );
  expect(automatic).toMatchObject({
    status: "ready",
    documentType: "passport",
    documentTypeSource: "detected",
  });
  await database.db
    .update(documents)
    .set({ state: "quarantined" })
    .where(eq(documents.id, file.id));
  expect(await repository.identityAttachment(actor.userId)).toMatchObject({
    status: "needs_attention",
    documentType: "unknown",
  });
});

it("associates one company registry file without OCR and preserves scope, scan and replay protections", async () => {
  const actor = await owner();
  const stranger = await owner();
  const profiles = createManagedProfileRepository(database.db);
  const repository = createDocumentRepository(database.db);
  const company = await profiles.create(
    actor,
    { kind: "legal_entity", displayName: "Registry subject" },
    randomUUID(),
  );
  const person = await profiles.create(
    actor,
    { kind: "person", displayName: "Personal subject" },
    randomUUID(),
  );
  const create = (profileId: string, uploader = actor, identity = false) =>
    repository.create(
      uploader,
      {
        profileId,
        name: "original.pdf",
        mime: "application/pdf",
        size: 80,
        checksum: digest(randomUUID()),
        analysisRequested: false,
        ...(identity ? { purpose: "identity_card" as const } : {}),
      },
      randomUUID(),
    );
  const registry = await create(company.id);
  const personalFile = await create(person.id);
  const ownerFile = await create("self");
  const strangerFile = await create("self", stranger);
  const wrongIdentity = await create(company.id, actor, true);
  const input = {
    profileId: company.id,
    revision: 0,
    combinedId: registry.id,
    documentType: "unknown" as const,
  };
  expect(await repository.identityAttachment(actor.userId, company.id)).toMatchObject({
    status: "missing",
    backRequired: false,
    documentType: "unknown",
  });
  const key = randomUUID();
  const [saved, replay] = await Promise.all([
    repository.saveIdentityAttachment(actor, input, key),
    repository.saveIdentityAttachment(actor, input, key),
  ]);
  expect(saved).toEqual(replay);
  expect(saved).toMatchObject({
    revision: 1,
    status: "processing",
    combined: { id: registry.id, canDownload: false, category: "unknown" },
    front: null,
    back: null,
    documentType: "unknown",
    documentTypeSource: "unknown",
    backRequired: false,
  });
  for (const id of [personalFile.id, ownerFile.id, strangerFile.id]) {
    await expect(
      repository.saveIdentityAttachment(
        actor,
        { ...input, revision: 1, combinedId: id },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_NOT_FOUND" });
  }
  await expect(repository.identityAttachment(stranger.userId, company.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    repository.saveIdentityAttachment(stranger, input, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 404 });
  for (const [profileId, id] of [
    [person.id, personalFile.id],
    ["self", ownerFile.id],
  ]) {
    await expect(
      repository.saveIdentityAttachment(
        actor,
        { profileId, revision: 0, combinedId: id },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  }
  for (const invalid of [
    { combinedId: wrongIdentity.id },
    { combinedId: null, frontId: registry.id },
    { combinedId: null, backId: registry.id },
    { documentType: "passport" as const },
  ]) {
    await expect(
      repository.saveIdentityAttachment(actor, { ...input, revision: 1, ...invalid }, randomUUID()),
    ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  }
  await expect(
    repository.saveIdentityAttachment(actor, { ...input, combinedId: null }, key),
  ).rejects.toMatchObject({ code: "DOCUMENT_IDEMPOTENCY_REUSED" });
  await expect(
    repository.saveIdentityAttachment(actor, { ...input, combinedId: null }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_CONFLICT" });
  await repository.uploaded(actor, registry.id, "application/pdf");
  await database.db.update(documents).set({ state: "ready" }).where(eq(documents.id, registry.id));
  expect((await repository.identityAttachment(actor.userId, company.id)).status).toBe("incomplete");
  await database.db
    .update(documents)
    .set({ scanVersion: "isolated-antivirus" })
    .where(eq(documents.id, registry.id));
  expect(
    await createDocumentRepository(database.db).identityAttachment(actor.userId, company.id),
  ).toMatchObject({ status: "ready", combined: { id: registry.id, canDownload: true } });
  const [original] = await database.db
    .select()
    .from(documents)
    .where(eq(documents.id, registry.id));
  expect(original).toMatchObject({ category: "unknown", analysis: null, analysisRequested: false });
  await database.db
    .update(documents)
    .set({ state: "quarantined" })
    .where(eq(documents.id, registry.id));
  expect(await repository.saveIdentityAttachment(actor, input, key)).toMatchObject({
    revision: 1,
    status: "needs_attention",
    combined: { canDownload: false },
  });
  await expect(
    repository.saveIdentityAttachment(actor, { ...input, revision: 1 }, randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_ATTACHMENT_INVALID" });
  await repository.remove(actor, registry.id);
  expect(await repository.saveIdentityAttachment(actor, input, key)).toMatchObject({
    revision: 1,
    status: "needs_attention",
    combined: null,
  });
  expect(
    await repository.saveIdentityAttachment(
      actor,
      { ...input, revision: 1, combinedId: null },
      randomUUID(),
    ),
  ).toMatchObject({ revision: 2, status: "missing" });
});

it("keeps a company's historical identity association visible for replacement without treating it as a registry extract", async () => {
  const actor = await owner();
  const company = await createManagedProfileRepository(database.db).create(
    actor,
    { kind: "legal_entity", displayName: "Legacy company" },
    randomUUID(),
  );
  const repository = createDocumentRepository(database.db);
  const file = await repository.create(
    actor,
    {
      profileId: company.id,
      name: "original.jpg",
      mime: "image/jpeg",
      size: 80,
      checksum: digest(randomUUID()),
      analysisRequested: false,
      purpose: "identity_card",
    },
    randomUUID(),
  );
  await database.db
    .update(documents)
    .set({ state: "ready", scanVersion: "isolated-antivirus" })
    .where(eq(documents.id, file.id));
  await database.db.insert(managedDocumentIdentityAttachments).values({
    userId: actor.userId,
    managedProfileId: company.id,
    revision: 3,
    documentType: "passport",
    frontId: file.id,
  });
  expect(await repository.identityAttachment(actor.userId, company.id)).toMatchObject({
    revision: 3,
    status: "needs_attention",
    documentType: "unknown",
    documentTypeSource: "unknown",
    backRequired: false,
    front: { id: file.id, canDownload: true },
  });
  const cleared = await repository.saveIdentityAttachment(
    actor,
    { profileId: company.id, revision: 3, frontId: null },
    randomUUID(),
  );
  expect(cleared).toMatchObject({ revision: 4, status: "missing" });
  expect(await repository.get(actor.userId, file.id)).toMatchObject({
    id: file.id,
    canDownload: true,
    category: "identity",
  });
});
