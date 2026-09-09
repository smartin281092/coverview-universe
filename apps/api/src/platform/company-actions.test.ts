import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { CompanyAction, DocumentAnalysis, DocumentExtraction } from "@coverview/contracts";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createProfileRepository } from "../modules/identity/identity.profile.repository.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { identityAdminPermissions, identitySessions } from "../modules/identity/identity.schema.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { documents } from "../modules/document-intelligence/document.schema.js";
import { createCompanyActionRepository } from "../modules/document-intelligence/document.company-actions.repository.js";
import {
  companyServiceRequests,
  companyActionEvidence,
} from "../modules/document-intelligence/document.company-actions.schema.js";
import { companyActionProjection } from "../modules/document-intelligence/document.company-actions.projection.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function owner() {
  const session = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "actions@isolated.test",
    device: "Isolated test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!session) throw new Error("Isolated owner unavailable");
  return session;
}
type Actor = Awaited<ReturnType<typeof owner>>;
async function original(
  actor: Actor,
  values: Partial<Record<DocumentExtraction["field"], string>>,
  profileId = "self",
  trustedCompany = true,
) {
  const repository = createDocumentRepository(database.db);
  const file = await repository.create(
    actor,
    {
      profileId,
      name: "AXA document.pdf",
      mime: "application/pdf",
      size: 10,
      checksum: digest(randomUUID()),
      analysisRequested: true,
    },
    randomUUID(),
  );
  const source = {
    page: 1,
    text: "AXA",
    method: "isolated-test",
    version: "1",
    confidence: null,
    box: null,
  };
  const analysis: DocumentAnalysis = {
    category: "insurance",
    evidence: null,
    pages: [{ page: 1, text: "AXA", method: "isolated-test", version: "1" }],
    fields: Object.entries(values).map(([field, value]) => ({
      id: randomUUID(),
      field: field as DocumentExtraction["field"],
      value,
      source,
    })),
    ...(trustedCompany
      ? {
          insurance: {
            companyId: "axa",
            companySource: source,
            domain: null,
            domainSource: null,
            policyNumber: null,
            insuredSubject: null,
            startsOn: null,
            endsOn: null,
            premium: null,
          },
        }
      : {}),
  };
  await database.db
    .update(documents)
    .set({ state: "ready", generation: 1, scanVersion: "isolated", analysis })
    .where(eq(documents.id, file.id));
  return repository.get(actor.userId, file.id);
}
const requestInput = (action: CompanyAction) => ({
  profileId: action.profileId,
  companyId: action.companyId,
  group: action.group,
  profileRevision: action.profileRevision,
  values: action.currentValues,
});
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_company_actions_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

it("isolates owner and managed profiles, groups addresses, uses corrected values and refuses an inferred recipient", async () => {
  const actor = await owner();
  const other = await owner();
  const profiles = createProfileRepository(database.db);
  const managed = createManagedProfileRepository(database.db);
  const actions = createCompanyActionRepository(database.db);
  await profiles.save(
    actor.userId,
    actor.id,
    {
      revision: 0,
      step: "information",
      fields: { street: "Rue nouvelle 10", city: "Genève", postalCode: "1200" },
    },
    randomUUID(),
  );
  const person = await managed.create(
    actor,
    { kind: "person", displayName: "Personne liée" },
    randomUUID(),
  );
  await managed.saveSection(
    actor,
    person.id,
    "general",
    { revision: 0, step: "information", fields: { city: "Berne" } },
    randomUUID(),
  );
  const selfDocument = await original(actor, {
    street: "Rue ancienne 3",
    city: "Lausanne",
    postalCode: "1000",
  });
  await original(actor, { city: "Neuchâtel" }, person.id);
  const legacy = await original(actor, { phone: "+41790000001" }, "self", false);
  const list = await actions.list(actor.userId);
  expect(list.actions).toHaveLength(2);
  expect(list.actions.find((item) => item.profileId === "self")).toMatchObject({
    group: "address",
    currentValues: { street: "Rue nouvelle 10", city: "Genève", postalCode: "1200" },
    status: "needs_notification",
  });
  expect((await actions.list(other.userId)).actions).toEqual([]);
  await expect(actions.list(other.userId, { documentId: selfDocument.id })).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(actions.list(other.userId, { profileId: person.id })).rejects.toMatchObject({
    statusCode: 404,
  });
  expect((await actions.list(actor.userId, { documentId: legacy.id })).actions).toEqual([]);
  const review = selfDocument.reviewGroups!.find((group) => group.id === "address")!;
  await createDocumentRepository(database.db).fields(
    actor,
    selfDocument.id,
    {
      revision: selfDocument.revision,
      profileRevision: review.profileRevision,
      intent: "save",
      values: review.fields.map((field) => ({
        extractionId: field.extractionId,
        value: field.field === "city" ? "Nyon" : field.value,
      })),
    },
    randomUUID(),
  );
  expect(
    (await actions.list(actor.userId, { documentId: selfDocument.id })).actions[0]?.observations[0]
      ?.values.city,
  ).toBe("Nyon");
  const own = (await actions.list(actor.userId)).actions.find((item) => item.profileId === "self")!;
  await expect(actions.request(other, requestInput(own), randomUUID())).rejects.toMatchObject({
    statusCode: 409,
  });
  const key = randomUUID();
  const [first, replay] = await Promise.all([
    actions.request(actor, requestInput(own), key),
    actions.request(actor, requestInput(own), key),
  ]);
  expect(first).toEqual(replay);
  expect((await actions.request(actor, requestInput(own), randomUUID())).id).toBe(first.id);
  await expect(
    actions.request(actor, { ...requestInput(own), values: { city: "Forged" } }, key),
  ).rejects.toMatchObject({ code: "DOCUMENT_IDEMPOTENCY_REUSED" });
  await expect(
    database.db
      .update(companyServiceRequests)
      .set({ userId: other.userId, managedProfileId: person.id, profileId: person.id })
      .where(eq(companyServiceRequests.id, first.id)),
  ).rejects.toThrow();
});

it("requires admin permission, MFA and dated evidence; retains old proof without treating changed profile values as notified", async () => {
  const actor = await owner();
  const administrator = await owner();
  const stranger = await owner();
  const actions = createCompanyActionRepository(database.db);
  const profiles = createProfileRepository(database.db);
  const profile = await profiles.save(
    actor.userId,
    actor.id,
    { revision: 0, step: "information", fields: { city: "Genève" } },
    randomUUID(),
  );
  await original(actor, { city: "Lausanne" });
  const action = (await actions.list(actor.userId)).actions[0]!;
  const requestKey = randomUUID();
  const requested = await actions.request(actor, requestInput(action), requestKey);
  expect((await actions.list(actor.userId)).actions[0]).toMatchObject({
    status: "requested",
    evidence: null,
  });
  const admin = {
    id: administrator.id,
    userId: actor.userId,
    administratorUserId: administrator.userId,
  };
  const transition = {
    userId: actor.userId,
    id: requested.id,
    revision: requested.revision,
    state: "notified" as const,
    evidence: {
      occurredAt: new Date(Date.now() - 500).toISOString(),
      reference: "Référence courrier de test isolé",
    },
  };
  await expect(actions.transition(admin, transition, randomUUID())).rejects.toMatchObject({
    code: "IDENTITY_ACCESS_DENIED",
  });
  const permission = randomUUID();
  await database.db
    .insert(identityAdminPermissions)
    .values({
      id: permission,
      userId: administrator.userId,
      permission: "administration.access",
      evidence: "Isolated test",
    });
  await expect(actions.transition(admin, transition, randomUUID())).rejects.toMatchObject({
    code: "IDENTITY_MFA_REQUIRED",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, administrator.id));
  await expect(
    actions.transition(
      { ...admin, userId: stranger.userId },
      { ...transition, userId: stranger.userId },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    actions.transition(
      admin,
      {
        ...transition,
        evidence: {
          ...transition.evidence,
          occurredAt: new Date(Date.now() + 60000).toISOString(),
        },
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 422 });
  const key = randomUUID();
  const notified = await actions.transition(admin, transition, key);
  expect(await actions.transition(admin, transition, key)).toEqual(notified);
  expect((await actions.list(actor.userId)).actions[0]).toMatchObject({
    status: "notified",
    evidence: { reference: transition.evidence.reference },
  });
  // A new upload of an undated old document does not pretend to be newer company knowledge.
  await original(actor, { city: "Ancienne ville" });
  expect((await actions.list(actor.userId)).actions[0]?.status).toBe("notified");
  await profiles.save(
    actor.userId,
    actor.id,
    { revision: profile.revision, step: "information", fields: { city: "Fribourg" } },
    randomUUID(),
  );
  const changed = (await actions.list(actor.userId)).actions[0]!;
  expect(changed.status).toBe("needs_review");
  expect(changed.canRequest).toBe(true);
  expect(changed.evidence).toBeNull();
  expect(
    (await actions.adminList()).requests.find((item) => item.id === requested.id),
  ).toMatchObject({ superseded: true, allowedTransitions: [] });
  await expect(
    actions.transition(
      admin,
      { ...transition, revision: notified.revision, state: "confirmed" },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });
  const next = await actions.request(actor, requestInput(changed), randomUUID());
  expect(next.id).not.toBe(requested.id);
  expect(await actions.request(actor, requestInput(action), requestKey)).toEqual(requested);
  await expect(actions.request(actor, requestInput(action), randomUUID())).rejects.toMatchObject({
    statusCode: 409,
  });
  await database.db
    .update(identityAdminPermissions)
    .set({ revokedAt: new Date() })
    .where(eq(identityAdminPermissions.id, permission));
  await expect(actions.transition(admin, transition, key)).rejects.toMatchObject({
    code: "IDENTITY_ACCESS_DENIED",
  });
  expect(
    await database.db
      .select()
      .from(companyActionEvidence)
      .where(eq(companyActionEvidence.requestId, requested.id)),
  ).toHaveLength(1);
});

it("keeps complementary address observations separate from contradictions and compares actual document dates with proof dates", () => {
  const now = new Date().toISOString();
  const base = {
    profileId: "self",
    profileName: "Personne",
    profileRevision: 1,
    companyId: "axa" as const,
    group: "address" as const,
    currentValues: { street: "Rue 1", city: "Genève" },
    requests: [],
  };
  const source = {
    documentId: `doc_${randomUUID()}`,
    documentTitle: "Document",
    recordedAt: now,
    documentDate: null,
    ambiguous: false,
  };
  expect(
    companyActionProjection({ ...base, observations: [{ ...source, values: { street: "Rue 1" } }] })
      .status,
  ).toBe("unknown");
  expect(
    companyActionProjection({
      ...base,
      observations: [
        { ...source, values: { street: "Rue 1" } },
        { ...source, values: { city: "Genève" } },
      ],
    }).status,
  ).toBe("current");
  const proof = {
    id: randomUUID(),
    userId: randomUUID(),
    profileId: "self",
    profileName: "Personne",
    companyId: "axa" as const,
    group: "address" as const,
    values: base.currentValues,
    profileRevision: 1,
    revision: 1,
    state: "confirmed" as const,
    superseded: false,
    allowedTransitions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    evidence: {
      kind: "confirmed" as const,
      occurredAt: "2026-01-02T00:00:00.000Z",
      recordedAt: "2026-01-02T00:00:00.000Z",
      reference: "Confirmation isolée",
    },
  };
  expect(
    companyActionProjection({
      ...base,
      requests: [proof],
      observations: [{ ...source, values: { city: "Ancienne ville" }, documentDate: "2026-01-01" }],
    }).status,
  ).toBe("confirmed");
  expect(
    companyActionProjection({
      ...base,
      requests: [proof],
      observations: [{ ...source, values: { city: "Autre ville" }, documentDate: "2026-01-03" }],
    }).status,
  ).toBe("needs_notification");
});
