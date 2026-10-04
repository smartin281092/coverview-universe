import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createProfileRepository } from "../modules/identity/identity.profile.repository.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { createDocumentService } from "../modules/document-intelligence/document.service.js";
import { documents } from "../modules/document-intelligence/document.schema.js";
import { profileSaveInputSchema, type DocumentAnalysis } from "@coverview/contracts";
import { eq } from "drizzle-orm";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createDocumentRepository>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function owner() {
  const result = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "document-owner@workflow.test",
    device: "Isolated test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!result) throw new Error("Test identity unavailable");
  return result;
}
const source = {
  page: 1,
  text: "Extrait du document de test",
  method: "isolated-test",
  version: "1",
  confidence: null,
  box: null,
};
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_document_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createDocumentRepository(database.db);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

it("retains pending Lead originals and rechecks access and exact bytes around shared storage", async () => {
  const actor = await owner();
  const bytes = Buffer.from("%PDF-1.7\nIsolated original");
  const original = await repository.create(
    actor,
    {
      name: "Original.pdf",
      mime: "application/pdf",
      size: bytes.length,
      checksum: digest(bytes.toString()),
      analysisRequested: true,
      purpose: "lead_offer",
    },
    randomUUID(),
  );
  await database.pool.query(
    "update files set retained_at=now(),updated_at=now()-interval '2 days' where id=$1",
    [original.id],
  );
  await repository.cleanup();
  expect((await repository.get(actor.userId, original.id)).state).toBe("pending");
  const stored = new Map<string, Buffer>();
  let revokeDuringPut = false;
  const service = createDocumentService(repository, {
    async put(key, value) {
      stored.set(key, value);
      if (revokeDuringPut)
        await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
          actor.id,
        ]);
    },
    get: (key) => Promise.resolve(stored.get(key)!),
    remove: (key) => {
      stored.delete(key);
      return Promise.resolve();
    },
    close: () => {},
  });
  const authorize = () => repository.authorizeUpload(actor, original.id);
  const confirm = (mime: string) => repository.uploaded(actor, original.id, mime);
  await expect(
    service.uploadShared(actor.userId, original.id, Buffer.from("wrong"), authorize, confirm),
  ).rejects.toMatchObject({ code: "DOCUMENT_UPLOAD_INVALID" });
  expect(stored.size).toBe(0);
  revokeDuringPut = true;
  await expect(
    service.uploadShared(actor.userId, original.id, bytes, authorize, confirm),
  ).rejects.toMatchObject({ code: "IDENTITY_UNAUTHENTICATED" });
  expect((await repository.original(actor.userId, original.id)).state).toBe("pending");
  expect(
    (
      await database.pool.query("select id from document_outbox where document_id=$1", [
        original.id,
      ])
    ).rowCount,
  ).toBe(0);
});

it("persists contact and company choices with owner sessions, revision conflicts and retry safety", async () => {
  const actor = await owner();
  const stranger = await owner();
  const profiles = createProfileRepository(database.db);
  const original = await profiles.get(actor.userId);
  expect(original.insuranceCompanies).toBeNull();
  const input = profileSaveInputSchema.parse({
    revision: original.revision,
    step: original.step,
    fields: { phone: "+41 79 123 45 67", contactEmail: "contact@workflow.test", city: "Lausanne" },
    insuranceCompanies: ["axa", "liechtenstein-life"],
  });
  const key = randomUUID();
  const [saved, replay] = await Promise.all([
    profiles.save(actor.userId, actor.id, input, key),
    profiles.save(actor.userId, actor.id, input, key),
  ]);
  expect(replay).toEqual(saved);
  expect(await profiles.get(actor.userId)).toEqual(saved);
  expect(saved.insuranceCompanies).toEqual(["axa", "liechtenstein-life"]);
  expect(saved.fields.phone?.value).toBe(input.fields.phone);
  expect(saved.fields.contactEmail?.source).toBe("user_entered");
  expect(saved.revision).toBe(original.revision + 1);
  expect((await profiles.get(stranger.userId)).insuranceCompanies).toBeNull();
  await expect(
    profiles.save(actor.userId, stranger.id, { ...input, revision: saved.revision }, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 401 });
  await expect(profiles.save(actor.userId, actor.id, input, randomUUID())).rejects.toMatchObject({
    statusCode: 409,
  });
  await expect(
    profiles.save(actor.userId, actor.id, { ...input, insuranceCompanies: [] }, key),
  ).rejects.toMatchObject({ code: "PROFILE_IDEMPOTENCY_REUSED", statusCode: 422 });
  const corrected = await profiles.save(
    actor.userId,
    actor.id,
    { revision: saved.revision, step: saved.step, fields: { city: "Genève" } },
    randomUUID(),
  );
  expect(corrected.insuranceCompanies).toEqual(saved.insuranceCompanies);
  const cleared = await profiles.save(
    actor.userId,
    actor.id,
    {
      revision: corrected.revision,
      step: corrected.step,
      fields: { phone: null },
      insuranceCompanies: [],
    },
    randomUUID(),
  );
  expect(cleared.fields.phone).toBeUndefined();
  expect((await profiles.get(actor.userId)).insuranceCompanies).toEqual([]);
  expect(
    profileSaveInputSchema.safeParse({ ...input, insuranceCompanies: ["unknown"] }).success,
  ).toBe(false);
  expect(
    profileSaveInputSchema.safeParse({ ...input, insuranceCompanies: ["axa", "axa"] }).success,
  ).toBe(false);
  expect(
    profileSaveInputSchema.safeParse({ ...input, fields: { phone: "not a phone" } }).success,
  ).toBe(false);
  expect(
    profileSaveInputSchema.safeParse({ ...input, fields: { contactEmail: "not an email" } })
      .success,
  ).toBe(false);

  const document = await repository.create(
    actor,
    {
      name: "AXA contrat.pdf",
      mime: "application/pdf",
      size: 100,
      checksum: digest("company reference"),
      analysisRequested: true,
    },
    randomUUID(),
  );
  await database.db
    .update(documents)
    .set({
      analysis: {
        category: "insurance",
        evidence: source,
        fields: [],
        pages: [
          {
            page: 1,
            text: "Liechtenstein Life Assurance AG. Taxation",
            method: "isolated-test",
            version: "1",
          },
        ],
      },
    })
    .where(eq(documents.id, document.id));
  expect(await repository.referencedCompanies(actor.userId)).toEqual({
    companyIds: ["axa", "liechtenstein-life"],
  });
  expect(await repository.referencedCompanies(stranger.userId)).toEqual({ companyIds: [] });
  // Finding document references must neither mutate the profile nor repopulate an explicit empty choice.
  expect((await profiles.get(actor.userId)).insuranceCompanies).toEqual([]);
  await database.db
    .update(documents)
    .set({ deletedAt: new Date(), state: "deleted" })
    .where(eq(documents.id, document.id));
  expect(await repository.referencedCompanies(actor.userId)).toEqual({ companyIds: [] });
});

it("enriches only empty fields once; scopes differences and correction requests; keeps delivery truthful", async () => {
  const actor = await owner();
  const stranger = await owner();
  const profiles = createProfileRepository(database.db);
  const originalProfile = await profiles.get(actor.userId);
  await profiles.save(
    actor.userId,
    actor.id,
    { revision: originalProfile.revision, step: "information", fields: { firstName: "Actuel" } },
    randomUUID(),
  );
  let document = await repository.create(
    actor,
    {
      name: "scan.pdf",
      mime: "application/pdf",
      size: 100,
      checksum: digest("scan"),
      analysisRequested: true,
    },
    randomUUID(),
  );
  document = await repository.uploaded(actor, document.id, "application/pdf");
  await repository.transition(actor.userId, document.id, 1, { state: "reading" });
  const call = await repository.reserveAi(actor.userId, document.id, 1, "isolated-test", 20);
  if (!call) throw new Error("Test reservation failed");
  const conflictId = randomUUID();
  const analysis: DocumentAnalysis = {
    category: "insurance",
    classification: "insurance_policy",
    title: "Contrat d’assurance",
    titleSource: source,
    evidence: source,
    fields: [
      { id: conflictId, field: "firstName", value: "Ancien", source },
      { id: randomUUID(), field: "street", value: "Rue Exemple 12", source },
      { id: randomUUID(), field: "city", value: "Lausanne", source },
      { id: randomUUID(), field: "city", value: "Genève", source },
      { id: randomUUID(), field: "birthDate", value: "2999-01-01", source },
    ],
    pages: [],
  };
  await repository.completeAnalysis(actor.userId, document.id, 1, call.id, analysis, {
    inputTokens: 0,
    outputTokens: 0,
    model: "isolated-test",
  });
  const profile = await profiles.get(actor.userId);
  expect(profile.fields.firstName?.value).toBe("Actuel");
  expect(profile.fields.street).toMatchObject({
    value: "Rue Exemple 12",
    source: "document_extracted",
    confirmedAt: null,
    documentSource: { documentId: document.id },
  });
  expect(profile.fields.city).toBeUndefined();
  expect(profile.fields.birthDate).toBeUndefined();
  await repository.completeAnalysis(actor.userId, document.id, 1, call.id, analysis, {
    inputTokens: 0,
    outputTokens: 0,
    model: "isolated-test",
  });
  expect((await profiles.get(actor.userId)).revision).toBe(profile.revision);
  document = await repository.get(actor.userId, document.id);
  expect(document.profileComparisons).toContainEqual({
    extractionId: conflictId,
    currentValue: "Actuel",
    different: true,
  });
  expect((await repository.profileDifferences(actor.userId)).fields).toEqual([
    { field: "firstName", count: 1, documentId: document.id },
  ]);
  expect((await repository.profileDifferences(stranger.userId)).fields).toEqual([]);
  await expect(repository.get(stranger.userId, document.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  const input = {
    revision: document.revision,
    profileRevision: profile.revision,
    concernsMe: true,
    notification: { insurer: "Assureur de test" },
    decisions: [{ extractionId: conflictId, choice: "keep" as const }],
  };
  const key = randomUUID();
  const [first, replay] = await Promise.all([
    repository.review(actor, document.id, input, key),
    repository.review(actor, document.id, input, key),
  ]);
  expect(replay).toEqual(first);
  const requests = await repository.changeRequests(actor.userId);
  expect(requests.requests).toHaveLength(1);
  const request = requests.requests[0];
  if (!request) throw new Error("Request missing");
  expect(request).toMatchObject({
    state: "prepared",
    previousValue: "Ancien",
    requestedValue: "Actuel",
  });
  expect((await repository.changeRequests(stranger.userId)).requests).toEqual([]);
  await expect(
    repository.cancelChangeRequest(stranger, document.id, request.id, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    repository.review(
      actor,
      document.id,
      { ...input, concernsMe: false, revision: first.document.revision },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 422 });
  expect(
    (await repository.cancelChangeRequest(actor, document.id, request.id, randomUUID())).state,
  ).toBe("cancelled");
  await repository.remove(actor, document.id);
  expect((await repository.changeRequests(actor.userId)).requests).toEqual([]);
  expect((await profiles.get(actor.userId)).fields.street?.value).toBe("Rue Exemple 12");
  expect((await repository.profileDifferences(actor.userId)).fields).toEqual([]);
});

it("searches and groups the entire owned library before paginating and rejects a cursor from different filters", async () => {
  const actor = await owner();
  const stranger = await owner();
  const rows = Array.from({ length: 25 }, (_, i) => ({
    id: `doc_${randomUUID()}`,
    userId: actor.userId,
    name: `original-${i}.pdf`,
    mime: "application/pdf",
    declaredMime: "application/pdf",
    size: 100,
    checksum: digest(`file${i}`),
    objectKey: `test/${randomUUID()}`,
    state: "ready" as const,
    category: "insurance" as const,
    createdAt: new Date(Date.UTC(2026, 8, 1, 0, i)),
    analysis: {
      category: "insurance" as const,
      classification: i === 0 ? ("power_of_attorney" as const) : ("insurance_policy" as const),
      title: i === 0 ? "Procuration été" : `Contrat ${String(i).padStart(2, "0")}`,
      evidence: null,
      fields: [],
      pages: [],
    },
  }));
  await database.db.insert(documents).values(rows);
  const first = await repository.list(actor.userId);
  expect(first.documents).toHaveLength(20);
  expect(first.total).toBe(25);
  expect(first.nextCursor).not.toBeNull();
  const second = await repository.list(actor.userId, first.nextCursor ?? undefined);
  expect(second.documents).toHaveLength(5);
  expect(new Set([...first.documents, ...second.documents].map((row) => row.id)).size).toBe(25);
  expect(
    (await repository.list(actor.userId, undefined, { q: "ete" })).documents.map((row) => row.id),
  ).toEqual([rows[0]?.id]);
  expect(
    (await repository.list(actor.userId, undefined, { classification: "power_of_attorney" })).total,
  ).toBe(1);
  expect(
    (await repository.list(actor.userId, undefined, { sort: "oldest" })).documents[0]?.id,
  ).toBe(rows[0]?.id);
  expect((await repository.list(stranger.userId)).documents).toEqual([]);
  await expect(
    repository.list(actor.userId, first.nextCursor ?? undefined, { q: "other" }),
  ).rejects.toMatchObject({ statusCode: 400 });
});
