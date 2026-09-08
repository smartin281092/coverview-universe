import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase } from "./db/database.js";
import { createIdentityRepository } from "../modules/identity/identity.repository.js";
import { createProfileRepository } from "../modules/identity/identity.profile.repository.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import {
  managedProfileCommands,
  managedProfileSections,
} from "../modules/profiles/profiles.schema.js";
import {
  profileSaveInputSchema,
  profileSectionSaveInputSchema,
  profileValuesSchema,
} from "@coverview/contracts";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createManagedProfileRepository>;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
async function owner() {
  const session = await createIdentityRepository(database.db).createSession({
    workosUserId: `user_${randomUUID()}`,
    workosSessionId: `session_${randomUUID()}`,
    email: "managed-owner@isolated.test",
    device: "Isolated test",
    tokenHash: digest(randomUUID()),
    expiresAt: new Date(Date.now() + 3600000),
    loginStartedAt: new Date(Date.now() - 1000),
    requestId: randomUUID(),
  });
  if (!session) throw new Error("Isolated identity unavailable");
  return session;
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_managed_profiles_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createManagedProfileRepository(database.db);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});

it("keeps canonical identity distinct from managed people/entities and enforces owner/session and SQL isolation", async () => {
  const actor = await owner();
  const stranger = await owner();
  const canonical = createProfileRepository(database.db);
  const original = await canonical.get(actor.userId);
  expect((await repository.list(actor.userId)).profiles).toMatchObject([
    {
      id: "self",
      isSelf: true,
      kind: "person",
      completion: { general: 0, finances: 0, health: 0 },
    },
  ]);
  const key = randomUUID();
  const [person, replay] = await Promise.all([
    repository.create(actor, { kind: "person", displayName: "Personne privée" }, key),
    repository.create(actor, { kind: "person", displayName: "Personne privée" }, key),
  ]);
  expect(replay).toEqual(person);
  const entity = await repository.create(
    actor,
    { kind: "legal_entity", displayName: "Société privée" },
    randomUUID(),
  );
  expect(entity.completion.health).toBeNull();
  expect((await repository.list(actor.userId)).profiles).toHaveLength(3);
  expect((await repository.list(stranger.userId)).profiles).toHaveLength(1);
  const saved = await repository.saveSection(
    actor,
    person.id,
    "general",
    { revision: 0, step: "contact", fields: { firstName: "Autre", lastName: "Personne" } },
    randomUUID(),
  );
  expect(saved.completion).toBe(11); // (33 + 0 + 0) / 3.
  expect(saved.step).toBe("contact");
  expect((await repository.section(actor.userId, person.id, "general")).step).toBe("contact");
  expect(await canonical.get(actor.userId)).toEqual(original);
  await expect(repository.get(stranger.userId, person.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(repository.section(stranger.userId, person.id, "general")).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    repository.saveSection(
      { userId: actor.userId, id: stranger.id },
      person.id,
      "general",
      { revision: saved.revision, step: "review", fields: {} },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 401 });
  await expect(
    repository.saveSection(
      actor,
      entity.id,
      "health",
      { revision: 0, step: "information", fields: {} },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_SECTION_UNAVAILABLE" });
  await expect(
    repository.saveSection(
      actor,
      "self",
      "general",
      { revision: 0, step: "information", fields: {} },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_SECTION_UNAVAILABLE" });
  await expect(
    repository.saveSection(
      actor,
      entity.id,
      "general",
      { revision: 0, step: "information", fields: { firstName: "Wrong kind" } },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_INVALID_FIELDS" });
  await expect(
    database.db.insert(managedProfileSections).values({
      id: `psec_${randomUUID()}`,
      userId: stranger.userId,
      managedProfileId: person.id,
      section: "general",
    }),
  ).rejects.toThrow();
  await canonical.save(
    actor.userId,
    actor.id,
    { revision: original.revision, step: "address", fields: { firstName: "Titulaire" } },
    randomUUID(),
  );
  expect(await repository.section(actor.userId, "self", "general")).toMatchObject({
    values: { firstName: "Titulaire" },
    completion: 6,
    step: "details",
  });
  expect((await repository.section(actor.userId, person.id, "general")).values.firstName).toBe(
    "Autre",
  );
});

it("persists independent sections, counts zero amounts, rejects stale/cross-profile replays and never turns empty review into complete data", async () => {
  const actor = await owner();
  const stranger = await owner();
  const person = await repository.create(
    actor,
    { kind: "person", displayName: "Dossier A" },
    randomUUID(),
  );
  const other = await repository.create(
    actor,
    { kind: "person", displayName: "Dossier B" },
    randomUUID(),
  );
  const key = randomUUID();
  const input = profileSectionSaveInputSchema.parse({
    revision: 0,
    step: "details",
    fields: { annualIncomeMinor: 0, currency: "CHF" },
  });
  const [saved, replay] = await Promise.all([
    repository.saveSection(actor, person.id, "finances", input, key),
    repository.saveSection(actor, person.id, "finances", input, key),
  ]);
  expect(replay).toEqual(saved);
  expect(saved).toMatchObject({
    revision: 1,
    completion: 34,
    step: "details",
    values: { annualIncomeMinor: 0, currency: "CHF" },
  });
  await expect(
    repository.saveSection(actor, other.id, "finances", input, key),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_IDEMPOTENCY_REUSED" });
  await expect(
    repository.saveSection(actor, person.id, "finances", input, randomUUID()),
  ).rejects.toMatchObject({ statusCode: 409 });
  expect((await repository.section(actor.userId, other.id, "finances")).completion).toBe(0);
  await expect(
    repository.saveSection(
      actor,
      other.id,
      "finances",
      { revision: 0, step: "contact", fields: {} },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_INVALID_FIELDS" });
  await expect(
    database.db.insert(managedProfileSections).values({
      id: `psec_${randomUUID()}`,
      userId: actor.userId,
      managedProfileId: other.id,
      section: "health",
      step: "contact",
    }),
  ).rejects.toThrow();
  expect((await repository.section(actor.userId, person.id, "general")).step).toBe("information");
  const healthKey = randomUUID();
  const healthInput = profileSectionSaveInputSchema.parse({
    revision: 0,
    step: "review",
    fields: {
      allergies: "Aucune connue",
      accidentCoverage: "unknown",
      primaryDoctorName: "  Dre Exemple  ",
    },
    confirm: true,
  });
  const health = await repository.saveSection(actor, person.id, "health", healthInput, healthKey);
  expect(health.completion).toBe(31); // (33 + 29) / 2; confirmation adds no progress.
  expect(health.values.primaryDoctorName).toBe("Dre Exemple");
  expect(
    (await repository.section(actor.userId, person.id, "health")).values.primaryDoctorName,
  ).toBe("Dre Exemple");
  expect(
    (await repository.section(actor.userId, other.id, "health")).values.primaryDoctorName,
  ).toBeUndefined();
  await expect(repository.section(stranger.userId, person.id, "health")).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(health.confirmedAt).not.toBeNull();
  const [record] = await database.db
    .select({ response: managedProfileCommands.response })
    .from(managedProfileCommands)
    .where(
      and(
        eq(managedProfileCommands.userId, actor.userId),
        eq(managedProfileCommands.key, healthKey),
      ),
    )
    .limit(1);
  expect(record?.response).toEqual({ profileId: person.id, section: "health" });
  // Simulate the previous deployment's private snapshot to verify its neutralization too.
  await database.db
    .update(managedProfileCommands)
    .set({ response: sql`${JSON.stringify(health)}::jsonb` })
    .where(
      and(
        eq(managedProfileCommands.userId, actor.userId),
        eq(managedProfileCommands.key, healthKey),
      ),
    );
  expect((await repository.section(actor.userId, person.id, "finances")).step).toBe("details");
  const edited = await repository.saveSection(
    actor,
    person.id,
    "health",
    {
      revision: health.revision,
      step: "information",
      fields: { allergies: null, primaryDoctorName: null },
    },
    randomUUID(),
  );
  expect(edited.completion).toBe(17);
  expect(edited.confirmedAt).toBeNull();
  const oldRetry = await repository.saveSection(actor, person.id, "health", healthInput, healthKey);
  expect(oldRetry).toEqual(edited);
  expect(oldRetry.values.allergies).toBeUndefined();
  expect(oldRetry.values.primaryDoctorName).toBeUndefined();
  expect(
    (await repository.section(actor.userId, person.id, "health")).values.primaryDoctorName,
  ).toBeUndefined();
  expect(
    (await repository.section(actor.userId, person.id, "health")).values.allergies,
  ).toBeUndefined();
  const retained = await database.db
    .select({ response: managedProfileCommands.response })
    .from(managedProfileCommands)
    .where(eq(managedProfileCommands.userId, actor.userId));
  expect(JSON.stringify(retained)).not.toContain("Aucune connue");
  expect(JSON.stringify(retained)).not.toContain("Dre Exemple");
  const emptyReview = await repository.saveSection(
    actor,
    "self",
    "health",
    { revision: 0, step: "review", fields: {}, confirm: true },
    randomUUID(),
  );
  expect(emptyReview.completion).toBe(0);
  expect(emptyReview.confirmedAt).not.toBeNull();
  const profile = await repository.get(actor.userId, person.id);
  expect(profile.completion).toEqual({ general: 0, finances: 34, health: 17 });
  await expect(
    repository.saveSection(
      actor,
      other.id,
      "finances",
      { revision: 0, step: "information", fields: { savingsMinor: 0 } },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_INVALID_FIELDS" });
  expect(
    profileSectionSaveInputSchema.safeParse({
      revision: 0,
      step: "information",
      fields: { annualIncomeMinor: 12.5 },
    }).success,
  ).toBe(false);
  expect(
    profileSectionSaveInputSchema.safeParse({
      revision: 0,
      step: "information",
      fields: { ongoingTreatments: "x".repeat(1001) },
    }).success,
  ).toBe(false);
  await database.db
    .update(managedProfileCommands)
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where(
      and(eq(managedProfileCommands.userId, actor.userId), eq(managedProfileCommands.key, key)),
    );
  await Promise.all([repository.purgeExpiredCommands(), repository.purgeExpiredCommands()]);
  expect(
    await database.db
      .select({ id: managedProfileCommands.id })
      .from(managedProfileCommands)
      .where(
        and(eq(managedProfileCommands.userId, actor.userId), eq(managedProfileCommands.key, key)),
      ),
  ).toEqual([]);
  expect(
    (
      await database.db
        .select({ id: managedProfileCommands.id })
        .from(managedProfileCommands)
        .where(eq(managedProfileCommands.userId, actor.userId))
    ).length,
  ).toBeGreaterThan(0);
});

it("resumes contact for canonical, draft and company profiles while keeping completion independent of confirmations", async () => {
  const actor = await owner();
  const canonical = createProfileRepository(database.db);
  const original = await canonical.get(actor.userId);
  const confirmed = await canonical.confirm(
    actor.userId,
    actor.id,
    { revision: original.revision, prefill: false, version: "1" },
    randomUUID(),
  );
  expect(confirmed.prefill.enabled).toBe(false);
  expect(confirmed.prefill.decidedAt).not.toBeNull();
  expect(await repository.section(actor.userId, "self", "general")).toMatchObject({
    completion: 0,
    confirmedAt: null,
  });
  expect((await repository.get(actor.userId, "self")).completion.general).toBe(0);
  await canonical.save(
    actor.userId,
    actor.id,
    { revision: confirmed.revision, step: "contact", fields: { firstName: "Titulaire" } },
    randomUUID(),
  );
  expect(await repository.section(actor.userId, "self", "general")).toMatchObject({
    step: "contact",
    completion: 6,
    confirmedAt: null,
  });
  expect((await canonical.get(actor.userId)).step).toBe("contact");
  const draftTokenHash = digest(randomUUID());
  const draft = await canonical.saveDraft(
    draftTokenHash,
    { revision: 0, step: "contact", fields: { phone: "+41 22 000 00 00" } },
    randomUUID(),
  );
  expect((await canonical.getDraft(draftTokenHash)).draft?.step).toBe("contact");
  const attached = await canonical.attach(
    actor.userId,
    actor.id,
    draftTokenHash,
    { draftRevision: draft.revision },
    randomUUID(),
  );
  expect(attached.resumeStep).toBe("contact");
  expect(attached.profile.step).toBe("contact");
  expect((await canonical.get(actor.userId)).fields.phone?.value).toBe("+41 22 000 00 00");
  expect(await repository.section(actor.userId, "self", "general")).toMatchObject({
    step: "contact",
    completion: 22,
  });
  const entity = await repository.create(
    actor,
    { kind: "legal_entity", displayName: "Entreprise" },
    randomUUID(),
  );
  const saved = await repository.saveSection(
    actor,
    entity.id,
    "general",
    { revision: 0, step: "review", fields: { registrationNumber: "CHE-1" }, confirm: true },
    randomUUID(),
  );
  expect(saved.completion).toBe(17); // (50 + 0 + 0) / 3, rounded.
  expect(saved.confirmedAt).not.toBeNull();
  expect((await repository.get(actor.userId, entity.id)).completion).toEqual({
    general: 17,
    finances: 0,
    health: null,
  });
  const contact = await repository.saveSection(
    actor,
    entity.id,
    "general",
    {
      revision: saved.revision,
      step: "contact",
      fields: { phone: "+41 22 000 00 00", contactEmail: "company@isolated.test" },
    },
    randomUUID(),
  );
  expect(contact.completion).toBe(50); // (50 + 100 + 0) / 3.
  expect(await repository.section(actor.userId, entity.id, "general")).toMatchObject({
    step: "contact",
    values: { phone: "+41 22 000 00 00", contactEmail: "company@isolated.test" },
    completion: 50,
  });
  const profiles = (await repository.list(actor.userId)).profiles;
  expect(profiles.find((profile) => profile.id === "self")?.completion.general).toBe(22);
  expect(profiles.find((profile) => profile.id === entity.id)?.completion.general).toBe(50);
});

it("validates and normalizes optional Swiss AVS numbers without assigning one to empty profiles", () => {
  // Synthetic checksum vector, used only in the disposable test database.
  expect(
    profileValuesSchema.parse({ avsNumber: " 756 0000.0000 02 ", occupation: " Architecte " }),
  ).toEqual({
    avsNumber: "756.0000.0000.02",
    occupation: "Architecte",
  });
  expect(profileValuesSchema.parse({})).toEqual({});
  for (const avsNumber of [
    "7560000000003",
    "756000000002",
    "75600000000002",
    "7570000000002",
    "756abc0000002",
    "756-0000-0000-02",
  ])
    expect(profileValuesSchema.safeParse({ avsNumber }).success).toBe(false);
  expect(profileValuesSchema.safeParse({ occupation: "x".repeat(161) }).success).toBe(false);
  expect(
    profileSaveInputSchema.parse({
      revision: 0,
      step: "information",
      fields: { avsNumber: null, occupation: null },
    }).fields,
  ).toEqual({ avsNumber: null, occupation: null });
});

it("persists, isolates and removes AVS and occupation while including them in the information step", async () => {
  const actor = await owner();
  const stranger = await owner();
  const canonical = createProfileRepository(database.db);
  const original = await canonical.get(actor.userId);
  const person = await repository.create(
    actor,
    { kind: "person", displayName: "Personne privée" },
    randomUUID(),
  );
  const entity = await repository.create(
    actor,
    { kind: "legal_entity", displayName: "Société privée" },
    randomUUID(),
  );
  const self = await canonical.save(
    actor.userId,
    actor.id,
    {
      revision: original.revision,
      step: "information",
      fields: { avsNumber: "7560000000002", occupation: " Architecte " },
    },
    randomUUID(),
  );
  expect(self.fields.avsNumber?.value).toBe("756.0000.0000.02");
  expect(self.fields.occupation?.value).toBe("Architecte");
  expect((await canonical.get(actor.userId)).fields).toEqual(self.fields);
  expect((await repository.section(actor.userId, "self", "general")).values).toMatchObject({
    avsNumber: "756.0000.0000.02",
    occupation: "Architecte",
  });
  expect((await canonical.get(stranger.userId)).fields.avsNumber).toBeUndefined();
  await expect(
    canonical.save(
      actor.userId,
      stranger.id,
      {
        revision: self.revision,
        step: "information",
        fields: { avsNumber: null },
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ statusCode: 401 });
  const input = profileSectionSaveInputSchema.parse({
    revision: 0,
    step: "information",
    fields: { avsNumber: "756 0000 0000 19", occupation: " Enseignante " },
  });
  const key = randomUUID();
  const managed = await repository.saveSection(actor, person.id, "general", input, key);
  expect(managed.values).toEqual({ avsNumber: "756.0000.0000.19", occupation: "Enseignante" });
  expect(managed.completion).toBe(11);
  expect((await repository.section(actor.userId, person.id, "general")).values).toEqual(
    managed.values,
  );
  expect((await canonical.get(actor.userId)).fields.avsNumber?.value).toBe("756.0000.0000.02");
  await expect(repository.section(stranger.userId, person.id, "general")).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    repository.saveSection(actor, entity.id, "general", input, randomUUID()),
  ).rejects.toMatchObject({ code: "MANAGED_PROFILE_INVALID_FIELDS" });
  const erased = await repository.saveSection(
    actor,
    person.id,
    "general",
    {
      revision: managed.revision,
      step: "information",
      fields: { avsNumber: null, occupation: null },
    },
    randomUUID(),
  );
  expect(erased.values).toEqual({});
  expect(await repository.saveSection(actor, person.id, "general", input, key)).toEqual(erased);
  expect((await repository.section(actor.userId, person.id, "general")).values).toEqual({});
  await canonical.save(
    actor.userId,
    actor.id,
    {
      revision: self.revision,
      step: "information",
      fields: { avsNumber: null, occupation: null },
    },
    randomUUID(),
  );
  expect((await canonical.get(actor.userId)).fields).toEqual({});
});
