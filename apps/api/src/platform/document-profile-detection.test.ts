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

it("explicitly creates, fills and assigns a new homonym atomically and replays without duplicates", async () => {
  const actor = await owner({ firstName: "Alex", birthDate: "1980-01-01" });
  const stranger = await owner();
  const profiles = createManagedProfileRepository(database.db);
  const repository = createDocumentRepository(database.db);
  const canonical = await createProfileRepository(database.db).get(actor.userId);
  const doc = await prepare(actor, {
    firstName: "Alex",
    lastName: "Autre",
    birthDate: "2000-01-01",
    street: "Rue de test 2",
    phone: "+41 22 555 12 34",
    contactEmail: "alex@isolated.test",
  });
  await doc.complete();
  const original = await doc.read();
  expect(original).toMatchObject({
    profileAssignment: "ambiguous",
    profileCreation: { kind: "person", displayName: "Alex Autre" },
  });
  const input = { revision: original.revision, createProfile: true as const };
  const key = randomUUID();
  await expect(repository.assignProfile(stranger, original.id, input, key)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    repository.assignProfile(
      actor,
      original.id,
      { ...input, revision: original.revision - 1 },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect((await profiles.list(actor.userId)).profiles).toHaveLength(1);
  const [first, replay] = await Promise.all([
    repository.assignProfile(actor, original.id, input, key),
    repository.assignProfile(actor, original.id, input, key),
  ]);
  expect(replay).toEqual(first);
  expect(first).toMatchObject({ profileAssignment: "created", profileCreation: null });
  expect(first.profileId).not.toBe("self");
  const section = await profiles.section(actor.userId, first.profileId!, "general");
  expect(section.values).toMatchObject({
    firstName: "Alex",
    lastName: "Autre",
    birthDate: "2000-01-01",
    street: "Rue de test 2",
    phone: "+41 22 555 12 34",
    contactEmail: "alex@isolated.test",
  });
  expect(section.documentSources?.street?.documentId).toBe(original.id);
  expect(section.confirmedAt).toBeNull();
  expect((await profiles.list(actor.userId)).profiles).toHaveLength(2);
  expect((await profiles.list(stranger.userId)).profiles).toHaveLength(1);
  expect(await createProfileRepository(database.db).get(actor.userId)).toEqual(canonical);
  expect(
    (await repository.list(actor.userId, undefined, { profileId: first.profileId! })).documents.map(
      (item) => item.id,
    ),
  ).toEqual([original.id]);
  await expect(
    repository.assignProfile(actor, original.id, input, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect((await profiles.list(actor.userId)).profiles).toHaveLength(2);
});

it("creates a company from its extracted identity and rejects missing or mixed identities", async () => {
  const actor = await owner();
  const repository = createDocumentRepository(database.db);
  const profiles = createManagedProfileRepository(database.db);
  const doc = await prepare(actor, {
    companyName: "Exemple SA",
    registrationNumber: "CHE-111.222.333",
    street: "Rue de test 3",
  });
  await doc.complete();
  const original = await doc.read();
  expect(original.profileCreation).toEqual({ kind: "legal_entity", displayName: "Exemple SA" });
  const created = await repository.assignProfile(
    actor,
    original.id,
    { revision: original.revision, createProfile: true },
    randomUUID(),
  );
  expect(
    (await profiles.list(actor.userId)).profiles.find((item) => item.id === created.profileId),
  ).toMatchObject({ kind: "legal_entity", displayName: "Exemple SA" });
  expect(
    (await profiles.section(actor.userId, created.profileId!, "general")).values,
  ).toMatchObject({
    companyName: "Exemple SA",
    registrationNumber: "CHE-111.222.333",
    street: "Rue de test 3",
  });
  for (const fields of [
    { lastName: "Sans prénom" },
    { firstName: "Alex", companyName: "Mélange SA" },
    {},
  ]) {
    const missing = await prepare(actor, fields);
    await missing.complete();
    const current = await missing.read();
    expect(current.profileCreation).toBeNull();
    await expect(
      repository.assignProfile(
        actor,
        current.id,
        { revision: current.revision, createProfile: true },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  }
  const failed = await prepare(actor, {});
  await repository.transition(actor.userId, failed.doc.id, 1, {
    state: "failed",
    failure: "ai_invalid_result",
  });
  const interrupted = await failed.read();
  expect(interrupted.analysis).toBeNull();
  expect(interrupted.profileCreation).toBeNull();
  await expect(
    repository.assignProfile(
      actor,
      interrupted.id,
      { revision: interrupted.revision, createProfile: true },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 422 });
  expect((await profiles.list(actor.userId)).profiles).toHaveLength(2);
});

it("retains partial extraction without automatically assigning or enriching an uncertain identity", async () => {
  const actor = await owner({ firstName: "Alex" });
  const doc = await prepare(actor, { firstName: "Alex", street: "Rue de test" });
  doc.extracted.warnings = ["fields"];
  await doc.complete();
  const result = await doc.read();
  expect(result).toMatchObject({
    state: "ready",
    profileAssignment: "missing_identity",
    analysis: { warnings: ["fields"] },
  });
  expect(result.analysis?.fields).toHaveLength(2);
  expect(
    (await createProfileRepository(database.db).get(actor.userId)).fields.street?.value,
  ).toBeUndefined();
  const assigned = await createDocumentRepository(database.db).assignProfile(
    actor,
    result.id,
    { revision: result.revision, profileId: "self" },
    randomUUID(),
  );
  expect(assigned.profileAssignment).toBe("manual");
  expect((await createProfileRepository(database.db).get(actor.userId)).fields.street?.value).toBe(
    "Rue de test",
  );
});

it.each(["person", "legal_entity"] as const)(
  "creates a manually named %s for a failed document atomically without rejected fields",
  async (kind) => {
    const actor = await owner();
    const stranger = await owner();
    const repository = createDocumentRepository(database.db);
    const profiles = createManagedProfileRepository(database.db);
    const doc = await prepare(actor, {});
    await repository.transition(actor.userId, doc.doc.id, 1, {
      state: "failed",
      failure: "ai_invalid_result",
    });
    const original = await doc.read();
    const input = {
      revision: original.revision,
      createProfile: true as const,
      profile: { kind, displayName: "  Dossier saisi  " },
    };
    const key = randomUUID();
    await expect(repository.assignProfile(stranger, original.id, input, key)).rejects.toMatchObject(
      { statusCode: 404 },
    );
    await expect(
      repository.assignProfile(
        actor,
        original.id,
        { ...input, revision: original.revision - 1 },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(() =>
      repository.assignProfile(
        actor,
        original.id,
        { ...input, profile: { kind, displayName: "  " } },
        randomUUID(),
      ),
    ).toThrow();
    expect((await profiles.list(actor.userId)).profiles).toHaveLength(1);
    const [first, replay] = await Promise.all([
      repository.assignProfile(actor, original.id, input, key),
      repository.assignProfile(actor, original.id, input, key),
    ]);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({ state: "failed", analysis: null, profileAssignment: "created" });
    expect(
      (await profiles.list(actor.userId)).profiles.find((item) => item.id === first.profileId),
    ).toMatchObject({ kind, displayName: "Dossier saisi" });
    expect((await profiles.section(actor.userId, first.profileId!, "general")).values).toEqual({});
    expect((await profiles.list(actor.userId)).profiles).toHaveLength(2);
    await expect(
      repository.assignProfile(
        actor,
        original.id,
        { ...input, profile: { kind, displayName: "Autre" } },
        key,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect((await profiles.list(stranger.userId)).profiles).toHaveLength(1);
  },
);

it.each([undefined, { kind: "person" as const, displayName: "Profil manuel" }])(
  "enforces the profile limit during explicit creation without assigning the document (%j)",
  async (profile) => {
    const actor = await owner();
    await database.db.insert(managedProfiles).values(
      Array.from({ length: 49 }, (_, index) => ({
        id: `prf_${randomUUID()}`,
        userId: actor.userId,
        kind: "person" as const,
        displayName: `Limit ${index}`,
      })),
    );
    const doc = await prepare(actor, { firstName: "Nouvelle personne" });
    await doc.complete();
    const original = await doc.read();
    await expect(
      createDocumentRepository(database.db).assignProfile(
        actor,
        original.id,
        { revision: original.revision, createProfile: true, ...(profile ? { profile } : {}) },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "MANAGED_PROFILE_LIMIT_REACHED" });
    expect(await doc.read()).toEqual(original);
    expect(
      (await createManagedProfileRepository(database.db).list(actor.userId)).profiles,
    ).toHaveLength(50);
  },
);
