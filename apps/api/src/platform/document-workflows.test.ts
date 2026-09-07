import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createProfileRepository } from "../modules/identity/identity.profile.repository.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { documents } from "../modules/document-intelligence/document.schema.js";
import type { DocumentAnalysis } from "@coverview/contracts";

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
