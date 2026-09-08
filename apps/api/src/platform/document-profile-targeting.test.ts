import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { DocumentAnalysis, DocumentExtraction } from "@coverview/contracts";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createProfileRepository } from "../modules/identity/identity.profile.repository.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { documents } from "../modules/document-intelligence/document.schema.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function owner() {
  const session = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "document-target@isolated.test",
    device: "Isolated test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!session) throw new Error("Isolated identity unavailable");
  return session;
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
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_document_targets_test")
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

it("isolates each document library, target ownership, comparisons, companies and identity attachments", async () => {
  const actor = await owner();
  const stranger = await owner();
  const profiles = createManagedProfileRepository(database.db);
  const repository = createDocumentRepository(database.db);
  const profile = await profiles.create(
    actor,
    { kind: "person", displayName: "Family member" },
    randomUUID(),
  );
  await profiles.saveSection(
    actor,
    profile.id,
    "general",
    { revision: 0, step: "information", fields: { firstName: "Child" } },
    randomUUID(),
  );
  const input = {
    name: "Original AXA.pdf",
    mime: "application/pdf",
    size: 15,
    checksum: digest("original"),
    analysisRequested: true,
    purpose: "identity_card" as const,
  };
  const self = await repository.create(actor, input, randomUUID());
  const family = await repository.create(actor, { ...input, profileId: profile.id }, randomUUID());
  expect(self.profileId).toBe("self");
  expect(family.profileId).toBe(profile.id);
  expect((await repository.list(actor.userId)).documents.map((item) => item.id)).toEqual([self.id]);
  expect(
    (await repository.list(actor.userId, undefined, { profileId: profile.id })).documents.map(
      (item) => item.id,
    ),
  ).toEqual([family.id]);
  await expect(repository.assertTarget(actor.userId, "self", family.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(repository.assertTarget(stranger.userId, profile.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    repository.create(stranger, { ...input, profileId: profile.id }, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    database.db
      .update(documents)
      .set({ userId: stranger.userId })
      .where(eq(documents.id, family.id)),
  ).rejects.toThrow();
  const companyPage = {
    page: 1,
    text: "AXA\nPolice d’assurance",
    method: "isolated-test",
    version: "1",
  };
  await database.db
    .update(documents)
    .set({
      state: "ready",
      scanVersion: "isolated",
      analysis: { ...analysis({}), pages: [companyPage] },
    })
    .where(eq(documents.id, self.id));
  await database.db
    .update(documents)
    .set({
      state: "ready",
      scanVersion: "isolated",
      analysis: { ...analysis({ firstName: "Different child" }), pages: [companyPage] },
    })
    .where(eq(documents.id, family.id));
  const detail = await repository.get(actor.userId, family.id);
  expect(detail.profileComparisons).toMatchObject([{ currentValue: "Child", different: true }]);
  expect((await repository.profileDifferences(actor.userId)).fields).toEqual([]);
  expect(
    (await repository.insuranceCompany(actor.userId, "axa")).documents.map((item) => item.id),
  ).toEqual([self.id]);
  await expect(
    repository.saveIdentityAttachment(actor, { revision: 0, combinedId: family.id }, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    repository.review(
      actor,
      family.id,
      {
        revision: detail.revision,
        profileRevision: 0,
        concernsMe: true,
        decisions: [{ extractionId: detail.analysis!.fields[0]!.id, choice: "use" }],
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "DOCUMENT_REVIEW_INVALID" });
  await repository.remove(actor, self.id);
  expect((await repository.referencedCompanies(actor.userId)).companyIds).toEqual([]);
});

it("enriches only the selected person or company, retains manual values and source provenance, and replays worker completion safely", async () => {
  const actor = await owner();
  const profiles = createManagedProfileRepository(database.db);
  const canonical = createProfileRepository(database.db);
  const repository = createDocumentRepository(database.db);
  const original = await canonical.get(actor.userId);
  const person = await profiles.create(
    actor,
    { kind: "person", displayName: "Family" },
    randomUUID(),
  );
  const company = await profiles.create(
    actor,
    { kind: "legal_entity", displayName: "Business" },
    randomUUID(),
  );
  await profiles.saveSection(
    actor,
    person.id,
    "general",
    { revision: 0, step: "information", fields: { firstName: "Manual" } },
    randomUUID(),
  );
  const process = async (profileId: string, extracted: DocumentAnalysis) => {
    const doc = await repository.create(
      actor,
      {
        profileId,
        name: "Original.pdf",
        mime: "application/pdf",
        size: 15,
        checksum: digest(randomUUID()),
        analysisRequested: true,
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
    const usage = { inputTokens: 1, outputTokens: 1, model: "isolated" };
    await repository.completeAnalysis(actor.userId, doc.id, 1, call.id, extracted, usage);
    const section = await profiles.section(actor.userId, profileId, "general");
    await repository.completeAnalysis(actor.userId, doc.id, 1, call.id, extracted, usage);
    expect(await profiles.section(actor.userId, profileId, "general")).toEqual(section);
    return { doc, section };
  };
  const personResult = await process(
    person.id,
    analysis({
      firstName: "Extracted",
      lastName: "Family",
      birthDate: "2999-01-01",
      phone: "+41 22 555 12 34",
      contactEmail: "family@isolated.test",
      companyName: "Not a person",
    }),
  );
  expect(personResult.section.values).toEqual({
    firstName: "Manual",
    lastName: "Family",
    phone: "+41 22 555 12 34",
    contactEmail: "family@isolated.test",
  });
  expect(personResult.section.documentSources?.lastName?.documentId).toBe(personResult.doc.id);
  expect(personResult.section.documentSources?.firstName).toBeUndefined();
  expect(personResult.section.confirmedAt).toBeNull();
  const companyResult = await process(
    company.id,
    analysis({
      companyName: "Example SA",
      registrationNumber: "CHE-111.222.333",
      firstName: "Not a company",
      street: "Rue de test 1",
      contactEmail: "company@isolated.test",
    }),
  );
  expect(companyResult.section.values).toEqual({
    companyName: "Example SA",
    registrationNumber: "CHE-111.222.333",
    street: "Rue de test 1",
    contactEmail: "company@isolated.test",
  });
  expect(companyResult.section.documentSources?.companyName?.documentId).toBe(companyResult.doc.id);
  expect(await canonical.get(actor.userId)).toEqual(original);
  const saved = await profiles.saveSection(
    actor,
    company.id,
    "general",
    {
      revision: companyResult.section.revision,
      step: "details",
      fields: { companyName: "Edited SA" },
    },
    randomUUID(),
  );
  expect(saved.documentSources?.companyName).toBeUndefined();
  expect(saved.documentSources?.registrationNumber?.documentId).toBe(companyResult.doc.id);
});
