import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { authorizationTexts } from "@coverview/contracts";
import type {
  ActionCenterItem,
  DocumentAnalysis,
  DocumentExtraction,
  ProfileValues,
} from "@coverview/contracts";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import {
  createProfileRepository,
  readDocumentProfile,
} from "../modules/identity/identity.profile.repository.js";
import { createNoticeRepository } from "../modules/identity/identity.notice.repository.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { identityAdminPermissions, identitySessions } from "../modules/identity/identity.schema.js";
import { createDocumentRepository } from "../modules/document-intelligence/document.repository.js";
import { documents } from "../modules/document-intelligence/document.schema.js";
import { createActionCenterRepository } from "../modules/document-intelligence/document.action-center.repository.js";
import {
  actionCenterResolutions,
  actionCenterManualReviews,
} from "../modules/document-intelligence/document.action-center.schema.js";
import { companyServiceRequests } from "../modules/document-intelligence/document.company-actions.schema.js";
import { createAuthorizationRepository } from "../modules/authorizations/index.js";
import { authorizationSignatures } from "../modules/authorizations/authorizations.schema.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function owner() {
  const actor = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "center@isolated.test",
    device: "Isolated test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!actor) throw new Error("Isolated actor unavailable");
  return actor;
}
type Actor = Awaited<ReturnType<typeof owner>>;
const completeProfile: ProfileValues = {
  firstName: "Isolated",
  lastName: "Person",
  birthDate: "1990-01-01",
  nationality: "Suisse",
  avsNumber: "756.1234.5678.97",
  occupation: "Testeur",
  street: "Rue actuelle 1",
  postalCode: "1200",
  city: "Genève",
  country: "Suisse",
  phone: "+41 22 123 45 67",
  contactEmail: "center@isolated.test",
};
async function save(actor: Actor, fields: ProfileValues) {
  const profile = await readDocumentProfile(database.db, actor.userId);
  return createProfileRepository(database.db).save(
    actor.userId,
    actor.id,
    { revision: profile.revision, step: "information", fields },
    randomUUID(),
  );
}
async function sign(actor: Actor, kind: "mandate" | "procuration", profileId = "self") {
  const repository = createAuthorizationRepository(database.db);
  const draft = await repository.draft(actor.userId, kind, profileId);
  return repository.sign(
    actor,
    kind,
    {
      profileId,
      profileRevision: draft.profileRevision,
      contentHash: draft.contentHash,
      signerName: profileId === "self" ? draft.profileName : "Représentant de test",
      place: "Genève",
      accepted: true,
      representative: profileId !== "self",
      drawing: [
        [
          [0.1, 0.1],
          [0.6, 0.8],
          [0.8, 0.2],
        ],
      ],
    },
    randomUUID(),
  );
}
async function original(
  actor: Actor,
  values: Partial<Record<DocumentExtraction["field"], string>>,
  companyId: "axa" | "allianz" | null = null,
  profileId = "self",
) {
  const repo = createDocumentRepository(database.db);
  const document = await repo.create(
    actor,
    {
      profileId,
      name: "Source isolée.pdf",
      mime: "application/pdf",
      size: 10,
      checksum: digest(randomUUID()),
      analysisRequested: true,
    },
    randomUUID(),
  );
  const source = {
    page: 1,
    text: companyId ?? "Identité",
    method: "isolated-test",
    version: "1",
    confidence: null,
    box: null,
  };
  const analysis: DocumentAnalysis = {
    category: companyId ? "insurance" : "identity",
    evidence: null,
    pages: [{ page: 1, text: source.text, method: "isolated-test", version: "1" }],
    fields: Object.entries(values).map(([field, value]) => ({
      id: randomUUID(),
      field: field as DocumentExtraction["field"],
      value,
      source,
    })),
    ...(companyId
      ? {
          insurance: {
            companyId,
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
    .where(and(eq(documents.userId, actor.userId), eq(documents.id, document.id)));
  return { document, analysis };
}
async function topic(actor: Actor, name: string, profileId = "self") {
  const repository = createActionCenterRepository(database.db);
  let cursor: string | undefined;
  do {
    const page = await repository.list(actor.userId, { profileId, ...(cursor ? { cursor } : {}) });
    const item = page.actions.find((entry) => entry.topic === name);
    if (item) return item;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  throw new Error(`Action absent: ${name}`);
}
async function keep(actor: Actor, action: ActionCenterItem) {
  return createActionCenterRepository(database.db).resolve(
    actor,
    action.id,
    { fingerprint: action.fingerprint, choice: "keep" },
    randomUUID(),
  );
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_action_center_test")
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

it("reopens an authorization requirement when an older text version has an unresolved manual review", async () => {
  const actor = await owner();
  const center = createActionCenterRepository(database.db);
  const action = await topic(actor, "authorization:management_mandate");
  const result = await center.resolve(
    actor,
    action.id,
    {
      fingerprint: action.fingerprint,
      choice: "custom",
      response: "Merci de m’aider à signer ce document.",
    },
    randomUUID(),
  );
  expect(result.action.state).toBe("in_progress");
  const [resolution] = await database.db
    .select()
    .from(actionCenterResolutions)
    .where(
      and(
        eq(actionCenterResolutions.userId, actor.userId),
        eq(actionCenterResolutions.id, result.resolution.id),
      ),
    );
  expect(resolution?.observedHash).toBe(
    digest(JSON.stringify([action.topic, authorizationTexts.version])),
  );
  // A stored decision about an earlier legal text must not absorb a new version's prerequisite.
  await database.db
    .update(actionCenterResolutions)
    .set({ observedHash: digest(JSON.stringify([action.topic, "isolated-earlier-version"])) })
    .where(
      and(
        eq(actionCenterResolutions.userId, actor.userId),
        eq(actionCenterResolutions.id, result.resolution.id),
      ),
    );
  const reopened = (await center.details(actor.userId, action.id)).action;
  expect(reopened).toMatchObject({
    id: action.id,
    state: "pending",
    requirements: [{ kind: "management_mandate", state: "missing" }],
  });
  expect(
    (await center.history(actor.userId)).entries.some((entry) => entry.id === result.resolution.id),
  ).toBe(true);
});

it("enforces a non-null resolution at the PostgreSQL boundary for resolved manual reviews", async () => {
  const actor = await owner();
  const center = createActionCenterRepository(database.db);
  const action = await topic(actor, "firstName");
  const result = await center.resolve(
    actor,
    action.id,
    {
      fingerprint: action.fingerprint,
      choice: "custom",
      response: "Veuillez examiner ma demande.",
    },
    randomUUID(),
  );
  await expect(
    database.db
      .update(actionCenterManualReviews)
      .set({ state: "resolved", resolution: null })
      .where(
        and(
          eq(actionCenterManualReviews.userId, actor.userId),
          eq(actionCenterManualReviews.resolutionId, result.resolution.id),
        ),
      ),
  ).rejects.toThrow();
  const [unchanged] = await database.db
    .select()
    .from(actionCenterManualReviews)
    .where(
      and(
        eq(actionCenterManualReviews.userId, actor.userId),
        eq(actionCenterManualReviews.resolutionId, result.resolution.id),
      ),
    );
  expect(unchanged).toMatchObject({ state: "requested", resolution: null });
});

it("deduplicates one datum across documents and companies and retains a decision without reopening on an identical source", async () => {
  const actor = await owner();
  const other = await owner();
  await save(actor, completeProfile);
  await original(actor, { street: "Ancienne rue", city: "Lausanne" }, "axa");
  await original(actor, { city: "Lausanne", street: "Ancienne rue" }, "allianz");
  const center = createActionCenterRepository(database.db);
  const action = await topic(actor, "address");
  expect(action.kind).toBe("profile_review");
  expect(action.variants).toHaveLength(1);
  expect(action.variants[0]?.sources).toHaveLength(2);
  expect(action.companies.map((company) => company.companyId).sort()).toEqual(["allianz", "axa"]);
  await expect(center.details(other.userId, action.id)).rejects.toMatchObject({ statusCode: 404 });
  const decision = await keep(actor, action);
  expect(decision.action).toMatchObject({
    id: action.id,
    kind: "company_notification",
    state: "pending",
  });
  expect(decision.action.choices.find((choice) => choice.id === "notify")?.enabled).toBe(false);
  await original(actor, { street: "Ancienne rue", city: "Lausanne" }, "axa");
  const same = (await center.details(actor.userId, action.id)).action;
  expect(same.kind).toBe("company_notification");
  expect(same.id).toBe(action.id);
  expect(
    (await center.history(actor.userId)).entries.filter((item) => item.actionId === action.id),
  ).toHaveLength(1);
  await save(actor, { city: "Neuchâtel" });
  expect((await center.details(actor.userId, action.id)).action.kind).toBe("profile_review");
});

it("normalizes profile corrections atomically, validates fields, replays one receipt, and never overwrites scan evidence", async () => {
  const actor = await owner();
  await save(actor, { firstName: "Isolated", lastName: "Person" });
  const { document, analysis } = await original(actor, {
    firstName: "  Nouvelle  ",
    companyName: "Compagnie émettrice",
  });
  const center = createActionCenterRepository(database.db);
  const action = await topic(actor, "firstName");
  expect(action.variants).toHaveLength(1);
  expect(
    (await center.list(actor.userId)).actions.some((entry) => entry.topic === "companyName"),
  ).toBe(false);
  await expect(
    center.resolve(
      actor,
      action.id,
      {
        fingerprint: action.fingerprint,
        choice: "correct",
        values: { companyName: "Incompatible" },
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 422 });
  const input = {
    fingerprint: action.fingerprint,
    choice: "variant" as const,
    variantId: action.variants[0]!.id,
  };
  const key = randomUUID();
  const [first, replay] = await Promise.all([
    center.resolve(actor, action.id, input, key),
    center.resolve(actor, action.id, input, key),
  ]);
  expect(replay).toEqual(first);
  expect(first.resolution.afterValues).toEqual({ firstName: "Nouvelle" });
  expect(first.action.state).toBe("complete");
  expect((await readDocumentProfile(database.db, actor.userId)).fields.firstName?.value).toBe(
    "Nouvelle",
  );
  expect(
    (await database.db.select().from(documents).where(eq(documents.id, document.id)))[0]?.analysis,
  ).toEqual(analysis);
  expect(
    await database.db
      .select()
      .from(actionCenterResolutions)
      .where(eq(actionCenterResolutions.userId, actor.userId)),
  ).toHaveLength(1);
  await expect(
    center.resolve(actor, action.id, { ...input, choice: "keep" }, key),
  ).rejects.toMatchObject({ code: "DOCUMENT_IDEMPOTENCY_REUSED" });
  const avs = await topic(actor, "avsNumber");
  const corrected = await center.resolve(
    actor,
    avs.id,
    { fingerprint: avs.fingerprint, choice: "correct", values: { avsNumber: "7561234567897" } },
    randomUUID(),
  );
  expect(corrected.resolution.afterValues).toEqual({ avsNumber: "756.1234.5678.97" });
  expect(corrected.action.state).toBe("complete");
});

it("requires the exact active mandate and atomically queues all companies without claiming that they were notified", async () => {
  const actor = await owner();
  await save(actor, completeProfile);
  await original(actor, { phone: "+41 21 000 00 00" }, "axa");
  await original(actor, { phone: "+41 21 000 00 00" }, "allianz");
  const center = createActionCenterRepository(database.db);
  await keep(actor, await topic(actor, "phone"));
  let action = await topic(actor, "phone");
  await expect(
    center.resolve(
      actor,
      action.id,
      { fingerprint: action.fingerprint, choice: "notify" },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "DOCUMENT_MANDATE_REQUIRED" });
  expect(
    await database.db
      .select()
      .from(companyServiceRequests)
      .where(eq(companyServiceRequests.userId, actor.userId)),
  ).toHaveLength(0);
  await sign(actor, "mandate");
  await sign(actor, "procuration");
  await createNoticeRepository(database.db).opened(actor.userId, actor.id);
  action = await topic(actor, "phone");
  const input = { fingerprint: action.fingerprint, choice: "notify" as const };
  const key = randomUUID();
  const result = await center.resolve(actor, action.id, input, key);
  expect(result.requests).toHaveLength(2);
  expect(
    result.requests.every((request) => request.state === "requested" && request.evidence === null),
  ).toBe(true);
  expect(result.action.state).toBe("in_progress");
  expect(result.summary).toMatchObject({
    pending: 0,
    inProgress: 1,
    completionPercent: 100,
    optimizationPercent: 100,
  });
  expect(await center.resolve(actor, action.id, input, key)).toEqual(result);
  expect(
    await database.db
      .select()
      .from(companyServiceRequests)
      .where(eq(companyServiceRequests.userId, actor.userId)),
  ).toHaveLength(2);
  await database.db
    .update(authorizationSignatures)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(authorizationSignatures.userId, actor.userId),
        eq(authorizationSignatures.kind, "mandate"),
      ),
    );
  await expect(center.resolve(actor, action.id, input, key)).rejects.toMatchObject({
    code: "DOCUMENT_MANDATE_REQUIRED",
  });
});

it("preserves custom instructions in an authorized manual-review workflow and immutable history after the source disappears", async () => {
  const actor = await owner();
  const administrator = await owner();
  const stranger = await owner();
  await save(actor, completeProfile);
  const source = await original(actor, { firstName: "Différent" });
  const center = createActionCenterRepository(database.db);
  const action = await topic(actor, "firstName");
  const result = await center.resolve(
    actor,
    action.id,
    {
      fingerprint: action.fingerprint,
      choice: "custom",
      response: "Il s’agit d’une ancienne information, merci de contrôler.",
    },
    randomUUID(),
  );
  expect(result.action.state).toBe("in_progress");
  expect((await readDocumentProfile(database.db, actor.userId)).fields.firstName?.value).toBe(
    "Isolated",
  );
  const [review] = await database.db
    .select()
    .from(actionCenterManualReviews)
    .where(eq(actionCenterManualReviews.userId, actor.userId));
  if (!review) throw new Error("Manual review unavailable");
  const admin = {
    id: administrator.id,
    userId: actor.userId,
    administratorUserId: administrator.userId,
  };
  const transition = {
    userId: actor.userId,
    id: review.id,
    revision: 0,
    state: "resolved" as const,
    resolution: "La source a été examinée ; le profil est conservé.",
  };
  await expect(center.transitionManual(admin, transition, randomUUID())).rejects.toMatchObject({
    code: "IDENTITY_ACCESS_DENIED",
  });
  await database.db.insert(identityAdminPermissions).values({
    id: randomUUID(),
    userId: administrator.userId,
    permission: "administration.access",
    evidence: "Isolated test",
  });
  await expect(center.transitionManual(admin, transition, randomUUID())).rejects.toMatchObject({
    code: "IDENTITY_MFA_REQUIRED",
  });
  await database.db
    .update(identitySessions)
    .set({ mfaVerifiedAt: new Date() })
    .where(eq(identitySessions.id, administrator.id));
  await expect(
    center.transitionManual(
      { ...admin, userId: stranger.userId },
      { ...transition, userId: stranger.userId },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  await center.transitionManual(admin, transition, randomUUID());
  expect((await center.details(actor.userId, action.id)).action.state).toBe("complete");
  await database.db
    .update(documents)
    .set({ deletedAt: new Date(), state: "deleted" })
    .where(eq(documents.id, source.document.id));
  const entries = (await center.history(actor.userId)).entries.filter(
    (entry) => entry.actionId === action.id,
  );
  expect(entries.map((entry) => entry.choice)).toEqual(["manual_completed", "custom"]);
  expect(entries[0]?.actor).toBe("administrator");
  expect((await center.history(stranger.userId)).entries).toHaveLength(0);
});

it("projects mandatory general information, scoped prerequisites and actual signature/opening dates into history", async () => {
  const actor = await owner();
  const stranger = await owner();
  const center = createActionCenterRepository(database.db);
  const initial = await center.list(actor.userId);
  expect(initial.actions.find((action) => action.topic === "avsNumber")?.requiredFields).toEqual([
    "avsNumber",
  ]);
  expect(
    initial.actions.find((action) => action.topic === "address")?.requiredFields.sort(),
  ).toEqual(["street", "postalCode", "city", "country"].sort());
  expect(initial.actions.some((action) => action.topic === "authorization:lsa45")).toBe(true);
  await save(actor, completeProfile);
  await sign(actor, "mandate");
  await sign(actor, "procuration");
  const notice = await createNoticeRepository(database.db).opened(actor.userId, actor.id);
  expect((await center.list(actor.userId)).summary).toMatchObject({
    pending: 0,
    completionPercent: 100,
  });
  const history = await center.history(actor.userId);
  expect(history.entries.filter((entry) => entry.choice === "signed")).toHaveLength(2);
  expect(history.entries.find((entry) => entry.choice === "opened")?.createdAt).toBe(
    notice.firstOpenedAt,
  );
  expect(history).toEqual(await center.history(actor.userId));
  const managed = await createManagedProfileRepository(database.db).create(
    actor,
    { kind: "legal_entity", displayName: "Société isolée" },
    randomUUID(),
  );
  const scoped = await center.list(actor.userId, { profileId: managed.id });
  expect(scoped.actions.every((action) => action.profileId === managed.id)).toBe(true);
  expect(scoped.actions.some((action) => action.topic === "authorization:lsa45")).toBe(false);
  expect(scoped.actions.some((action) => action.topic === "firstName")).toBe(false);
  expect(scoped.actions.some((action) => action.topic === "companyName")).toBe(true);
  await expect(center.list(stranger.userId, { profileId: managed.id })).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(center.history(stranger.userId, { profileId: managed.id })).rejects.toMatchObject({
    statusCode: 404,
  });
});

it("paginates pending and in-progress actions independently and scopes cursors to the selected state", async () => {
  const actor = await owner();
  const center = createActionCenterRepository(database.db);
  const managed = createManagedProfileRepository(database.db);
  for (let index = 0; index < 3; index += 1) {
    await managed.create(
      actor,
      { kind: "person", displayName: `Personne isolée ${index}` },
      randomUUID(),
    );
  }
  const before = await center.list(actor.userId);
  const second = await center.list(actor.userId, { cursor: before.nextCursor! });
  for (const action of [...before.actions, ...second.actions].slice(0, 21)) {
    await center.resolve(
      actor,
      action.id,
      {
        fingerprint: action.fingerprint,
        choice: "custom",
        response: "Demande prise en charge pour examen.",
      },
      randomUUID(),
    );
  }
  const pending = await center.list(actor.userId, { state: "pending" });
  const inProgress = await center.list(actor.userId, { state: "in_progress" });
  expect(pending.actions).toHaveLength(20);
  expect(inProgress.actions).toHaveLength(20);
  expect(pending.actions.every((action) => action.state === "pending")).toBe(true);
  expect(inProgress.actions.every((action) => action.state === "in_progress")).toBe(true);
  expect(pending.summary).toEqual(inProgress.summary);
  const pendingLast = await center.list(actor.userId, {
    state: "pending",
    cursor: pending.nextCursor!,
  });
  const inProgressLast = await center.list(actor.userId, {
    state: "in_progress",
    cursor: inProgress.nextCursor!,
  });
  const pendingIds = [...pending.actions, ...pendingLast.actions].map((action) => action.id);
  const inProgressIds = [...inProgress.actions, ...inProgressLast.actions].map(
    (action) => action.id,
  );
  expect(pendingIds).toHaveLength(pending.summary.pending);
  expect(inProgressIds).toHaveLength(21);
  expect(new Set(pendingIds).size).toBe(pendingIds.length);
  expect(new Set(inProgressIds).size).toBe(inProgressIds.length);
  expect(inProgressIds.some((id) => pendingIds.includes(id))).toBe(false);
  expect(pendingLast.nextCursor).toBeNull();
  expect(inProgressLast.nextCursor).toBeNull();
  await expect(
    center.list(actor.userId, { state: "in_progress", cursor: pending.nextCursor! }),
  ).rejects.toMatchObject({ statusCode: 422 });
  await expect(center.list(actor.userId, { cursor: pending.nextCursor! })).rejects.toMatchObject({
    statusCode: 422,
  });
  await expect(
    center.list(actor.userId, { state: "pending", profileId: "self", cursor: pending.nextCursor! }),
  ).rejects.toMatchObject({ statusCode: 422 });
  // Existing unfiltered cursors carry no state and remain accepted for the legacy list.
  const all = await center.list(actor.userId);
  expect(JSON.parse(Buffer.from(all.nextCursor!, "base64url").toString("utf8"))).not.toHaveProperty(
    "state",
  );
  expect((await center.list(actor.userId, { cursor: all.nextCursor! })).actions).toHaveLength(20);
  await expect(
    center.list(actor.userId, { state: "pending", cursor: all.nextCursor! }),
  ).rejects.toMatchObject({ statusCode: 422 });
});

it("saves a correction from the single response input, validates grouped addresses and dates, and replays once", async () => {
  const actor = await owner();
  const center = createActionCenterRepository(database.db);
  const managed = await createManagedProfileRepository(database.db).create(
    actor,
    { kind: "legal_entity", displayName: "Société isolée" },
    randomUUID(),
  );
  const registration = await topic(actor, "registrationNumber", managed.id);
  const input = {
    fingerprint: registration.fingerprint,
    choice: "correct" as const,
    response: "  CHE-123.456.789  ",
  };
  const key = randomUUID();
  const corrected = await center.resolve(actor, registration.id, input, key);
  expect(corrected.action.currentValues).toEqual({ registrationNumber: "CHE-123.456.789" });
  expect(corrected.action.state).toBe("complete");
  expect(corrected.resolution.choice).toBe("correct");
  expect(await center.resolve(actor, registration.id, input, key)).toEqual(corrected);
  expect(
    (await center.history(actor.userId)).entries.filter(
      (entry) => entry.actionId === registration.id,
    ),
  ).toHaveLength(1);
  expect(
    await database.db
      .select()
      .from(actionCenterManualReviews)
      .where(eq(actionCenterManualReviews.userId, actor.userId)),
  ).toHaveLength(0);

  const phone = await topic(actor, "phone");
  await expect(
    center.resolve(
      actor,
      phone.id,
      {
        fingerprint: phone.fingerprint,
        choice: "correct",
        response: "pas un téléphone",
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 422 });
  expect((await readDocumentProfile(database.db, actor.userId)).fields.phone).toBeUndefined();

  const address = await topic(actor, "address");
  await expect(
    center.resolve(
      actor,
      address.id,
      {
        fingerprint: address.fingerprint,
        choice: "correct",
        response: "Une ancienne adresse",
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 422 });
  const addressResult = await center.resolve(
    actor,
    address.id,
    {
      fingerprint: address.fingerprint,
      choice: "correct",
      response: "Rue isolée 4, 1200 Genève, Suisse",
    },
    randomUUID(),
  );
  expect(addressResult.action.currentValues).toEqual({
    street: "Rue isolée 4",
    postalCode: "1200",
    city: "Genève",
    country: "Suisse",
  });
  const companyAddress = await topic(actor, "address", managed.id);
  expect(
    (
      await center.resolve(
        actor,
        companyAddress.id,
        {
          fingerprint: companyAddress.fingerprint,
          choice: "correct",
          response: "Rue isolée 8; 1000; Lausanne; Suisse",
        },
        randomUUID(),
      )
    ).action.currentValues,
  ).toEqual({ street: "Rue isolée 8", postalCode: "1000", city: "Lausanne", country: "Suisse" });

  const birthDate = await topic(actor, "birthDate");
  await expect(
    center.resolve(
      actor,
      birthDate.id,
      {
        fingerprint: birthDate.fingerprint,
        choice: "correct",
        response: "31.02.2000",
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 422 });
  expect(
    (
      await center.resolve(
        actor,
        birthDate.id,
        {
          fingerprint: birthDate.fingerprint,
          choice: "correct",
          response: "29.02.2000",
        },
        randomUUID(),
      )
    ).action.currentValues,
  ).toEqual({ birthDate: "2000-02-29" });
});
