import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { DocumentAnalysis, DocumentExtraction, ProfileValues } from "@coverview/contracts";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createProfileRepository } from "../modules/identity/identity.profile.repository.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { managedProfiles } from "../modules/profiles/profiles.schema.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { createActionCenterRepository } from "../modules/document-intelligence/document.action-center.repository.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function owner(values: ProfileValues = {}) {
  const actor = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "matching@isolated.test",
    device: "Isolated test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!actor) throw new Error("Missing isolated session");
  const canonical = createProfileRepository(database.db);
  const current = await canonical.get(actor.userId);
  await canonical.save(
    actor.userId,
    actor.id,
    { revision: current.revision, step: "information", fields: values },
    randomUUID(),
  );
  return actor;
}
type Actor = Awaited<ReturnType<typeof owner>>;
async function person(actor: Actor, values: ProfileValues) {
  const repository = createManagedProfileRepository(database.db);
  const profile = await repository.create(
    actor,
    { kind: "person", displayName: [values.firstName, values.lastName].filter(Boolean).join(" ") },
    randomUUID(),
  );
  await repository.saveSection(
    actor,
    profile.id,
    "general",
    { revision: 0, step: "information", fields: values },
    randomUUID(),
  );
  return profile;
}
function analysis(values: Partial<Record<DocumentExtraction["field"], string>>): DocumentAnalysis {
  return {
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
}
async function prepare(
  actor: Actor,
  values: Partial<Record<DocumentExtraction["field"], string>>,
  profileId?: string,
) {
  const repository = createDocumentRepository(database.db);
  const doc = await repository.create(
    actor,
    {
      name: "Original.pdf",
      mime: "application/pdf",
      size: 15,
      checksum: digest(randomUUID()),
      analysisRequested: true,
      detectProfile: true,
      ...(profileId ? { profileId } : {}),
    },
    randomUUID(),
  );
  await repository.uploaded(actor, doc.id, "application/pdf");
  await repository.transition(actor.userId, doc.id, 1, {
    state: "reading",
    scanVersion: "isolated",
  });
  const call = await repository.reserveAi(actor.userId, doc.id, 1, "isolated", 20);
  if (!call) throw new Error("Missing isolated call");
  const extracted = analysis(values);
  const complete = () =>
    repository.completeAnalysis(actor.userId, doc.id, 1, call.id, extracted, {
      inputTokens: 1,
      outputTokens: 1,
      model: "isolated",
    });
  return { doc, complete, extracted, read: () => repository.get(actor.userId, doc.id) };
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_profile_detection_test")
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

it("matches the owner and a managed person with normalized first names, enriches empty fields only, and preserves explicit targets", async () => {
  const actor = await owner({ firstName: "Élodie", lastName: "Manuel" });
  const child = await person(actor, {
    firstName: "Marie Claire",
    birthDate: "2002-03-04",
    city: "Lausanne",
  });
  const selfDoc = await prepare(actor, {
    firstName: " ELODIE ",
    lastName: "Scan",
    nationality: "CH",
  });
  await selfDoc.complete();
  expect(await selfDoc.read()).toMatchObject({ profileId: "self", profileAssignment: "matched" });
  const holder = await createProfileRepository(database.db).get(actor.userId);
  expect(holder.fields.lastName?.value).toBe("Manuel");
  expect(holder.fields.nationality?.value).toBe("CH");
  const childDoc = await prepare(actor, {
    firstName: "marie   claire",
    birthDate: "2002-03-04",
    city: "Genève",
    phone: "+41 22 555 12 34",
  });
  await childDoc.complete();
  expect(await childDoc.read()).toMatchObject({
    profileId: child.id,
    profileAssignment: "matched",
  });
  const section = await createManagedProfileRepository(database.db).section(
    actor.userId,
    child.id,
    "general",
  );
  expect(section.values).toMatchObject({ city: "Lausanne", phone: "+41 22 555 12 34" });
  expect(section.documentSources?.phone?.documentId).toBe(childDoc.doc.id);
  expect(section.confirmedAt).toBeNull();
  const explicit = await prepare(
    actor,
    { firstName: "Un autre prénom", contactEmail: "child@isolated.test" },
    child.id,
  );
  await explicit.complete();
  expect(await explicit.read()).toMatchObject({ profileId: child.id, profileAssignment: null });
  expect(
    (await createManagedProfileRepository(database.db).list(actor.userId)).profiles,
  ).toHaveLength(2);
});

it("creates one person for concurrent extractions and replays, keeps provenance and makes documents visible across the account", async () => {
  const actor = await owner({ firstName: "Parent" });
  const stranger = await owner({ firstName: "Léa" });
  const canonical = await createProfileRepository(database.db).get(actor.userId);
  const first = await prepare(actor, {
    firstName: "Léa",
    lastName: "Test",
    birthDate: "2001-02-03",
    street: "Rue de test 1",
  });
  const second = await prepare(actor, {
    firstName: "LEA",
    birthDate: "2001-02-03",
    contactEmail: "lea@isolated.test",
  });
  await Promise.all([first.complete(), second.complete()]);
  const result = await first.read();
  expect(result.profileId).not.toBe("self");
  expect(result.profileAssignedAt).toBeTruthy();
  expect((await second.read()).profileId).toBe(result.profileId);
  const profiles = createManagedProfileRepository(database.db);
  expect((await profiles.list(actor.userId)).profiles).toHaveLength(2);
  const section = await profiles.section(actor.userId, result.profileId!, "general");
  expect(section.values).toMatchObject({
    lastName: "Test",
    street: "Rue de test 1",
    birthDate: "2001-02-03",
    contactEmail: "lea@isolated.test",
  });
  expect(section.documentSources?.street?.documentId).toBe(first.doc.id);
  await first.complete();
  expect(await profiles.section(actor.userId, result.profileId!, "general")).toEqual(section);
  expect(await createProfileRepository(database.db).get(actor.userId)).toEqual(canonical);
  const documents = createDocumentRepository(database.db);
  expect((await documents.list(actor.userId)).documents).toHaveLength(0);
  expect(
    (await documents.list(actor.userId, undefined, { scope: "account" })).documents,
  ).toHaveLength(2);
  expect(
    (await documents.list(stranger.userId, undefined, { scope: "account" })).documents,
  ).toHaveLength(0);
  await expect(documents.get(stranger.userId, result.id)).rejects.toMatchObject({
    statusCode: 404,
  });
});

it("uses birth date to disambiguate homonyms, but holds conflicting or ambiguous identities without changing a profile", async () => {
  const actor = await owner({ firstName: "Alex", birthDate: "1980-01-01" });
  const other = await person(actor, { firstName: "Alex", birthDate: "2010-01-01" });
  const exact = await prepare(actor, { firstName: "Alex", birthDate: "2010-01-01" });
  await exact.complete();
  expect((await exact.read()).profileId).toBe(other.id);
  const profiles = createManagedProfileRepository(database.db);
  const before = await profiles.list(actor.userId);
  for (const values of [
    { firstName: "Alex" },
    { firstName: "Alex", birthDate: "1990-01-01" },
    { firstName: "Alex", birthDate: "2999-01-01" },
  ]) {
    const doc = await prepare(actor, values);
    await doc.complete();
    const result = await doc.read();
    expect(result.profileAssignment).toBe("ambiguous");
    expect(result.profileAssignedAt).toBeNull();
    expect(result.profileComparisons).toEqual([]);
    expect(result.reviewGroups?.every((group) => !group.canSync && !group.different)).toBe(true);
  }
  expect(await profiles.list(actor.userId)).toEqual(before);
});

it("requires an explicit owner-scoped resolution for ambiguity, records it idempotently, and excludes unresolved scans from actions", async () => {
  const actor = await owner({ firstName: "Alex", birthDate: "1980-01-01" });
  const other = await person(actor, { firstName: "Alex", birthDate: "2010-01-01" });
  const stranger = await owner();
  const foreign = await person(stranger, { firstName: "Alex" });
  const repository = createDocumentRepository(database.db);
  const actions = createActionCenterRepository(database.db);
  const before = await actions.summary(actor.userId);
  const doc = await prepare(actor, { firstName: "Alex", phone: "+41 22 555 12 34" });
  await doc.complete();
  const result = await doc.read();
  expect(await actions.summary(actor.userId)).toEqual(before);
  expect((await repository.profileDifferences(actor.userId)).fields).toEqual([]);
  await expect(
    repository.fields(
      actor,
      result.id,
      {
        revision: result.revision,
        intent: "sync",
        profileRevision: 0,
        values: [{ extractionId: doc.extracted.fields[0]!.id, value: "Alex" }],
      },
      randomUUID(),
    ),
  ).rejects.toThrow();
  await expect(
    repository.assignProfile(
      stranger,
      result.id,
      { revision: result.revision, profileId: foreign.id },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    repository.assignProfile(
      actor,
      result.id,
      { revision: result.revision, profileId: foreign.id },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    repository.assignProfile(
      actor,
      result.id,
      { revision: result.revision - 1, profileId: other.id },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  const key = randomUUID();
  const input = { revision: result.revision, profileId: other.id };
  const assigned = await repository.assignProfile(actor, result.id, input, key);
  expect(assigned).toMatchObject({ profileId: other.id, profileAssignment: "manual" });
  const section = await createManagedProfileRepository(database.db).section(
    actor.userId,
    other.id,
    "general",
  );
  expect(section.values.phone).toBe("+41 22 555 12 34");
  expect(await repository.assignProfile(actor, result.id, input, key)).toEqual(assigned);
  expect(
    await createManagedProfileRepository(database.db).section(actor.userId, other.id, "general"),
  ).toEqual(section);
  await expect(
    repository.assignProfile(
      actor,
      result.id,
      { revision: assigned.revision, profileId: "self" },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
});

it("does not create profiles without a usable first name or for a company and respects the fifty-profile limit", async () => {
  const actor = await owner({ firstName: "Parent" });
  for (const fields of [
    { birthDate: "2000-01-01", lastName: "Test" },
    { companyName: "Entreprise Test" },
  ]) {
    const doc = await prepare(actor, fields);
    await doc.complete();
    expect((await doc.read()).profileAssignment).toBe("missing_identity");
  }
  await database.db.insert(managedProfiles).values(
    Array.from({ length: 49 }, (_, index) => ({
      id: `prf_${randomUUID()}`,
      userId: actor.userId,
      kind: "person" as const,
      displayName: `Isolated ${index}`,
    })),
  );
  const doc = await prepare(actor, { firstName: "Nouvelle personne" });
  await doc.complete();
  expect((await doc.read()).profileAssignment).toBe("profile_limit");
  expect(
    await database.db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.userId, actor.userId)),
  ).toHaveLength(49);
});
