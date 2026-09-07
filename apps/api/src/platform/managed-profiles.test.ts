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
import { profileSectionSaveInputSchema } from "@coverview/contracts";

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
    { revision: 0, step: "details", fields: { firstName: "Autre", lastName: "Personne" } },
    randomUUID(),
  );
  expect(saved.completion).toBe(20);
  expect(saved.step).toBe("details");
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
    completion: 10,
    step: "details",
  });
  expect((await repository.section(actor.userId, person.id, "general")).values.firstName).toBe(
    "Autre",
  );
});

it("persists independent sections, counts zero amounts, rejects stale/cross-profile replays and never turns empty review into complete data", async () => {
  const actor = await owner();
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
    completion: 25,
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
  expect((await repository.section(actor.userId, person.id, "general")).step).toBe("information");
  const healthKey = randomUUID();
  const healthInput = profileSectionSaveInputSchema.parse({
    revision: 0,
    step: "review",
    fields: { allergies: "Aucune connue", accidentCoverage: "unknown" },
    confirm: true,
  });
  const health = await repository.saveSection(actor, person.id, "health", healthInput, healthKey);
  expect(health.completion).toBe(22);
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
    { revision: health.revision, step: "information", fields: { allergies: null } },
    randomUUID(),
  );
  expect(edited.completion).toBe(11);
  expect(edited.confirmedAt).toBeNull();
  const oldRetry = await repository.saveSection(actor, person.id, "health", healthInput, healthKey);
  expect(oldRetry).toEqual(edited);
  expect(oldRetry.values.allergies).toBeUndefined();
  expect(
    (await repository.section(actor.userId, person.id, "health")).values.allergies,
  ).toBeUndefined();
  const retained = await database.db
    .select({ response: managedProfileCommands.response })
    .from(managedProfileCommands)
    .where(eq(managedProfileCommands.userId, actor.userId));
  expect(JSON.stringify(retained)).not.toContain("Aucune connue");
  const emptyReview = await repository.saveSection(
    actor,
    "self",
    "health",
    { revision: 0, step: "review", fields: {}, confirm: true },
    randomUUID(),
  );
  expect(emptyReview.completion).toBe(0);
  const profile = await repository.get(actor.userId, person.id);
  expect(profile.completion).toEqual({ general: 0, finances: 25, health: 11 });
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
