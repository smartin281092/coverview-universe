import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import type {
  DocumentAnalysis,
  DocumentExtraction,
  DocumentRecord,
  DocumentFieldReviewInput,
} from "@coverview/contracts";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createProfileRepository } from "../modules/identity/identity.profile.repository.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { documents } from "../modules/document-intelligence/document.schema.js";
import { documentFieldCorrections } from "../modules/document-intelligence/document.field-review.schema.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function owner() {
  const actor = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "field-review@isolated.test",
    device: "Isolated test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!actor) throw new Error("Isolated owner unavailable");
  return actor;
}
type Actor = Awaited<ReturnType<typeof owner>>;
async function document(
  actor: Actor,
  values: Partial<Record<DocumentExtraction["field"], string>>,
  profileId = "self",
) {
  const repository = createDocumentRepository(database.db);
  const created = await repository.create(
    actor,
    {
      profileId,
      name: "Private original.pdf",
      mime: "application/pdf",
      size: 15,
      checksum: digest(randomUUID()),
      analysisRequested: true,
    },
    randomUUID(),
  );
  const analysis: DocumentAnalysis = {
    category: "identity",
    evidence: null,
    pages: [],
    fields: Object.entries(values).map(([field, value]) => ({
      id: randomUUID(),
      field: field as DocumentExtraction["field"],
      value,
      source: {
        page: 1,
        text: value,
        method: "isolated-test",
        version: "1",
        confidence: null,
        box: null,
      },
    })),
  };
  await database.db
    .update(documents)
    .set({ state: "ready", generation: 1, scanVersion: "isolated", analysis })
    .where(eq(documents.id, created.id));
  return repository.get(actor.userId, created.id);
}
function input(
  record: DocumentRecord,
  groupId: string,
  intent: "save" | "sync",
  replacements: Record<string, string> = {},
): DocumentFieldReviewInput {
  const group = record.reviewGroups?.find((item) => item.id === groupId);
  if (!group) throw new Error("Missing review group");
  return {
    revision: record.revision,
    profileRevision: group.profileRevision,
    intent,
    values: group.fields.map((field) => ({
      extractionId: field.extractionId,
      value: replacements[field.field] ?? field.value,
    })),
  };
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_field_review_test")
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

it("corrects the document without mutating the profile or source, then synchronizes only after an explicit command", async () => {
  const actor = await owner();
  const profiles = createProfileRepository(database.db);
  const before = await profiles.get(actor.userId);
  const repository = createDocumentRepository(database.db);
  const original = await document(actor, { firstName: "Misread", documentNumber: "AB123" });
  const payload = input(original, "firstName", "save", { firstName: "Corrected" });
  const key = randomUUID();
  const corrected = await repository.fields(actor, original.id, payload, key);
  expect(await profiles.get(actor.userId)).toEqual(before);
  expect(corrected.analysis).toEqual(original.analysis);
  expect(corrected.reviewGroups?.find((group) => group.id === "firstName")).toMatchObject({
    fields: [{ value: "Corrected", currentValue: null }],
  });
  expect(corrected.reviewGroups?.find((group) => group.id === "documentNumber")?.canSync).toBe(
    false,
  );
  expect(await repository.fields(actor, original.id, payload, key)).toEqual(corrected);
  expect(
    (await createDocumentRepository(database.db).get(actor.userId, original.id)).reviewGroups,
  ).toEqual(corrected.reviewGroups);
  await expect(
    repository.fields(
      actor,
      original.id,
      { ...payload, values: [{ ...payload.values[0]!, value: "Other" }] },
      key,
    ),
  ).rejects.toMatchObject({ code: "DOCUMENT_IDEMPOTENCY_REUSED" });
  const synced = await repository.fields(
    actor,
    original.id,
    input(corrected, "firstName", "sync"),
    randomUUID(),
  );
  expect((await profiles.get(actor.userId)).fields.firstName?.value).toBe("Corrected");
  expect(synced.reviewGroups?.find((group) => group.id === "firstName")?.different).toBe(false);
  expect(
    synced.profileComparisons?.find(
      (item) => item.extractionId === original.analysis!.fields[0]!.id,
    )?.different,
  ).toBe(false);
  expect((await repository.profileDifferences(actor.userId)).fields).toEqual([]);
  expect(synced.analysis).toEqual(original.analysis);
  await expect(
    repository.fields(actor, original.id, input(synced, "documentNumber", "sync"), randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_REVIEW_INVALID" });
});

it("groups address components and rejects partial, invalid, and stale synchronizations atomically", async () => {
  const actor = await owner();
  const profiles = createProfileRepository(database.db);
  const before = await profiles.get(actor.userId);
  await profiles.save(
    actor.userId,
    actor.id,
    {
      revision: before.revision,
      step: "address",
      fields: { street: "Existing 1", postalCode: "1000", city: "Existing", country: "CH" },
    },
    randomUUID(),
  );
  const repository = createDocumentRepository(database.db);
  const original = await document(actor, {
    street: "Read 2",
    postalCode: "1200",
    city: "Read city",
  });
  expect(original.reviewGroups?.map((group) => group.id)).toEqual(["address"]);
  const complete = input(original, "address", "sync");
  await expect(
    repository.fields(
      actor,
      original.id,
      { ...complete, values: complete.values.slice(0, 1) },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "DOCUMENT_REVIEW_INVALID" });
  const invalid = input(original, "address", "sync", { postalCode: "x".repeat(25) });
  await expect(repository.fields(actor, original.id, invalid, randomUUID())).rejects.toMatchObject({
    code: "DOCUMENT_REVIEW_INVALID",
  });
  const unchanged = await profiles.get(actor.userId);
  expect(unchanged.fields.street?.value).toBe("Existing 1");
  const current = await profiles.save(
    actor.userId,
    actor.id,
    { revision: unchanged.revision, step: "information", fields: { firstName: "Manual" } },
    randomUUID(),
  );
  await expect(repository.fields(actor, original.id, complete, randomUUID())).rejects.toMatchObject(
    { code: "DOCUMENT_CONFLICT" },
  );
  // An unrelated profile change must not block correction of the source document.
  const saved = await repository.fields(
    actor,
    original.id,
    { ...complete, intent: "save" },
    randomUUID(),
  );
  expect(await profiles.get(actor.userId)).toEqual(current);
  const synced = await repository.fields(
    actor,
    original.id,
    input(saved, "address", "sync"),
    randomUUID(),
  );
  const profile = await profiles.get(actor.userId);
  expect(profile.fields.street?.value).toBe("Read 2");
  expect(profile.fields.postalCode?.value).toBe("1200");
  expect(profile.fields.city?.value).toBe("Read city");
  expect(profile.fields.country?.value).toBe("CH");
  expect(profile.fields.firstName?.value).toBe("Manual");
  expect(synced.reviewGroups?.[0]?.different).toBe(false);
});

it("isolates managed people and companies and validates fields against the selected subject kind", async () => {
  const actor = await owner();
  const stranger = await owner();
  const profiles = createManagedProfileRepository(database.db);
  const repository = createDocumentRepository(database.db);
  const self = await createProfileRepository(database.db).get(actor.userId);
  const person = await profiles.create(
    actor,
    { kind: "person", displayName: "Person" },
    randomUUID(),
  );
  const entity = await profiles.create(
    actor,
    { kind: "legal_entity", displayName: "Entity" },
    randomUUID(),
  );
  const personDoc = await document(actor, { firstName: "Person value" }, person.id);
  await expect(
    repository.fields(stranger, personDoc.id, input(personDoc, "firstName", "sync"), randomUUID()),
  ).rejects.toMatchObject({ statusCode: 404 });
  const personResult = await repository.fields(
    actor,
    personDoc.id,
    input(personDoc, "firstName", "sync"),
    randomUUID(),
  );
  expect(personResult.reviewGroups?.[0]).toMatchObject({ profileRevision: 1, different: false });
  expect((await profiles.section(actor.userId, person.id, "general")).values.firstName).toBe(
    "Person value",
  );
  expect(await createProfileRepository(database.db).get(actor.userId)).toEqual(self);
  const entityDoc = await document(
    actor,
    { companyName: "Example SA", firstName: "Wrong subject" },
    entity.id,
  );
  expect(entityDoc.reviewGroups?.find((group) => group.id === "companyName")?.canSync).toBe(true);
  expect(entityDoc.reviewGroups?.find((group) => group.id === "firstName")?.canSync).toBe(false);
  await expect(
    repository.fields(actor, entityDoc.id, input(entityDoc, "firstName", "sync"), randomUUID()),
  ).rejects.toMatchObject({ code: "DOCUMENT_REVIEW_INVALID" });
  await repository.fields(
    actor,
    entityDoc.id,
    input(entityDoc, "companyName", "sync", { companyName: "Corrected SA" }),
    randomUUID(),
  );
  const entitySection = await profiles.section(actor.userId, entity.id, "general");
  expect(entitySection.values).toEqual({ companyName: "Corrected SA" });
  expect(entitySection.confirmedAt).toBeNull();
  expect((await profiles.section(actor.userId, person.id, "general")).values).toEqual({
    firstName: "Person value",
  });
});

it("does not carry corrections into a new reading and removes correction values with the original", async () => {
  const actor = await owner();
  const repository = createDocumentRepository(database.db);
  const original = await document(actor, { firstName: "First scan" });
  await repository.fields(
    actor,
    original.id,
    input(original, "firstName", "save", { firstName: "Owner correction" }),
    randomUUID(),
  );
  const analysis = original.analysis!;
  const next: DocumentAnalysis = {
    ...analysis,
    fields: [{ ...analysis.fields[0]!, id: randomUUID(), value: "New scan" }],
  };
  await database.db
    .update(documents)
    .set({ generation: 2, analysis: next })
    .where(eq(documents.id, original.id));
  const read = await repository.get(actor.userId, original.id);
  expect(read.reviewGroups?.[0]?.fields[0]?.value).toBe("New scan");
  await repository.remove(actor, original.id);
  const corrections = await database.db
    .select()
    .from(documentFieldCorrections)
    .where(
      and(
        eq(documentFieldCorrections.userId, actor.userId),
        eq(documentFieldCorrections.documentId, original.id),
      ),
    );
  expect(corrections).toEqual([]);
  await expect(
    repository.fields(actor, original.id, input(read, "firstName", "save"), randomUUID()),
  ).rejects.toMatchObject({ statusCode: 404 });
});

it("preserves legacy corrections only when a review receipt identifies the current extraction", async () => {
  const actor = await owner();
  const repository = createDocumentRepository(database.db);
  const original = await document(actor, { firstName: "Original scan" });
  const reviewed = await repository.review(
    actor,
    original.id,
    {
      revision: original.revision,
      profileRevision: original.reviewGroups![0]!.profileRevision,
      concernsMe: true,
      decisions: [
        {
          extractionId: original.analysis!.fields[0]!.id,
          choice: "correct",
          value: "Legacy correction",
        },
      ],
    },
    randomUUID(),
  );
  expect(reviewed.document.reviewGroups?.[0]?.fields[0]?.value).toBe("Legacy correction");
  // Simulate a pre-migration record: old decisions/receipts exist, the new table did not.
  await database.db
    .delete(documentFieldCorrections)
    .where(eq(documentFieldCorrections.documentId, original.id));
  const migration = await readFile(
    new URL("../../drizzle/0014_tidy_wrecking_crew.sql", import.meta.url),
    "utf8",
  );
  const marker = "-- Legacy corrections:";
  const start = migration.indexOf(marker);
  if (start < 0) throw new Error("Legacy migration oracle unavailable");
  const backfill = migration.slice(start);
  await database.pool.query(backfill);
  await database.pool.query(backfill);
  expect(
    (await repository.get(actor.userId, original.id)).reviewGroups?.[0]?.fields[0]?.value,
  ).toBe("Legacy correction");
  await database.db
    .delete(documentFieldCorrections)
    .where(eq(documentFieldCorrections.documentId, original.id));
  const analysis = original.analysis!;
  await database.db
    .update(documents)
    .set({
      generation: 2,
      analysis: {
        ...analysis,
        fields: [{ ...analysis.fields[0]!, id: randomUUID(), value: "Different reading" }],
      },
    })
    .where(eq(documents.id, original.id));
  await database.pool.query(backfill);
  expect(
    (await repository.get(actor.userId, original.id)).reviewGroups?.[0]?.fields[0]?.value,
  ).toBe("Different reading");
  expect(
    await database.db
      .select()
      .from(documentFieldCorrections)
      .where(eq(documentFieldCorrections.documentId, original.id)),
  ).toEqual([]);
});

it("rejects future birth dates on profile synchronization and stale concurrent document writes", async () => {
  const actor = await owner();
  const repository = createDocumentRepository(database.db);
  const profiles = createProfileRepository(database.db);
  const before = await profiles.get(actor.userId);
  const original = await document(actor, { birthDate: "2999-01-01" });
  expect(original.reviewGroups?.[0]?.canSync).toBe(true);
  await expect(
    repository.fields(actor, original.id, input(original, "birthDate", "sync"), randomUUID()),
  ).rejects.toMatchObject({ code: "PROFILE_INVALID_BIRTH_DATE" });
  expect(await profiles.get(actor.userId)).toEqual(before);
  const payload = input(original, "birthDate", "sync", { birthDate: "1990-01-02" });
  const attempts = await Promise.allSettled([
    repository.fields(actor, original.id, payload, randomUUID()),
    repository.fields(actor, original.id, payload, randomUUID()),
  ]);
  expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  const rejected = attempts.find((result) => result.status === "rejected");
  expect(rejected && rejected.status === "rejected" ? rejected.reason : null).toMatchObject({
    code: "DOCUMENT_CONFLICT",
  });
  expect((await profiles.get(actor.userId)).fields.birthDate?.value).toBe("1990-01-02");
});
