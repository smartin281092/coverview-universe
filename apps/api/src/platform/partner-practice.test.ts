import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  partnerApplicationInputSchema,
  professionalPracticeInputSchema,
  leadCreateInputSchema,
  type ProfessionalPracticeDossier,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import { readPracticeSummary } from "../modules/partner-workspace/partner.practice.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const application = partnerApplicationInputSchema.parse({
  name: "Conseiller synthétique",
  organization: "Organisation synthétique",
  phone: "",
  roles: ["advisor"],
  categories: ["vehicle"],
  languages: "fr, Deutsch, italien",
  regions: "Genève, Suisse romande et alentours",
  qualifications: "Données isolées",
});
const input = (dossier: ProfessionalPracticeDossier) =>
  professionalPracticeInputSchema.parse({
    revision: dossier.current?.revision ?? 0,
    professionalRevision: dossier.professionalRevision,
    languageCodes: ["fr", "de"],
    cantons: ["VD", "GE"],
    confirmed: true,
  });

it("keeps legacy text separate, supports personal declarations and restricts reads and writes to current authority", async () => {
  const person = await actor(),
    other = await actor();
  await repository.apply(person, application, key());
  const original = await repository.practice(person, person.userId);
  expect(original.current).toBeNull();
  expect(original.legacy).toEqual({
    languages: application.languages,
    regions: application.regions,
  });
  expect(await readPracticeSummary(database.pool, person.userId)).toEqual({
    status: "unset",
    languageCodes: [],
    cantons: [],
    declaredAt: null,
  });
  const body = input(original),
    attempt = key();
  const result = await repository.declarePractice(person, person.userId, body, attempt);
  expect(result.current).toMatchObject({
    languageCodes: ["de", "fr"],
    cantons: ["GE", "VD"],
    revision: 1,
    professionalScope: "current",
  });
  expect((await repository.practice(admin, person.userId)).canDeclare).toBe(false);
  for (const visitor of [other, { ...person, wallet: true }]) {
    await expect(repository.practice(visitor, person.userId)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await expect(
      repository.declarePractice(visitor, person.userId, body, attempt),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  }
  await expect(
    repository.declarePractice(admin, person.userId, input(result), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(await repository.declarePractice(person, person.userId, body, attempt)).toEqual(result);
  await expect(
    repository.declarePractice(person, person.userId, { ...body, languageCodes: ["it"] }, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  await review(person, "closed");
  expect((await repository.practice(person, person.userId)).canDeclare).toBe(false);
  await expect(
    repository.declarePractice(person, person.userId, body, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const temporaryAdmin = await actor(true);
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
    [temporaryAdmin.id],
  );
  await expect(repository.practice(temporaryAdmin, person.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    person.id,
  ]);
  await expect(repository.practice(person, person.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("rejects unrecognized or duplicate values, missing confirmation and stale revisions without writing", async () => {
  const person = await actor();
  await repository.apply(person, application, key());
  const dossier = await repository.practice(person, person.userId),
    valid = input(dossier);
  for (const invalid of [
    { languageCodes: ["Français"] },
    { languageCodes: ["zz"] },
    { languageCodes: ["fr", "fr"] },
    { cantons: ["Suisse"] },
    { cantons: ["GE", "GE"] },
    { confirmed: false },
  ]) {
    expect(professionalPracticeInputSchema.safeParse({ ...valid, ...invalid }).success).toBe(false);
  }
  expect(
    professionalPracticeInputSchema.safeParse({ ...valid, professionalRevision: null }).success,
  ).toBe(false);
  await expect(
    repository.declarePractice(
      person,
      person.userId,
      { ...valid, professionalRevision: 99 },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect((await repository.practice(person, person.userId)).current).toBeNull();
  const saved = await repository.declarePractice(
    person,
    person.userId,
    { ...valid, languageCodes: [], cantons: [] },
    key(),
  );
  expect((await readPracticeSummary(database.pool, person.userId)).status).toBe("declared");
  expect(saved.current).toMatchObject({ languageCodes: [], cantons: [] });
  for (const [column, values] of [
    ["language_codes", ["zz"]],
    ["cantons", ["ZZ"]],
    ["cantons", [null]],
  ] as const) {
    await expect(
      database.pool.query(
        `update partner_practice_declarations set ${column}=$2 where user_id=$1`,
        [person.userId, values],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  }
  expect((await repository.practice(person, person.userId)).current).toEqual(saved.current);
});

it("serializes concurrent commands, reprojects replays and pages the immutable history independently of current values", async () => {
  const person = await actor();
  await repository.apply(person, application, key());
  const body = input(await repository.practice(person, person.userId)),
    attempt = key();
  const same = await Promise.all([
    repository.declarePractice(person, person.userId, body, attempt),
    repository.declarePractice(person, person.userId, body, attempt),
  ]);
  expect(same[0]).toEqual(same[1]);
  expect(same[0].history).toHaveLength(1);
  const concurrent = await Promise.allSettled(
    (["fr", "it"] as const).map((language) =>
      repository.declarePractice(
        person,
        person.userId,
        { ...input(same[0]), languageCodes: [language] },
        key(),
      ),
    ),
  );
  expect(concurrent.filter((item) => item.status === "fulfilled")).toHaveLength(1);
  expect(concurrent.filter((item) => item.status === "rejected")[0]).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  for (let index = 0; index < 21; index++) {
    const previous = await repository.practice(person, person.userId);
    await repository.declarePractice(
      person,
      person.userId,
      { ...input(previous), languageCodes: index % 2 ? ["it"] : ["rm"] },
      key(),
    );
  }
  const latest = await repository.practice(person, person.userId);
  expect(latest.current?.revision).toBe(23);
  expect(latest.history).toHaveLength(20);
  const older = await repository.practice(person, person.userId, latest.nextBeforeRevision!);
  expect(older.history).toHaveLength(3);
  expect(older.history.at(-1)).toEqual(same[0].current);
  expect(older.current).toEqual(latest.current);
  expect(older.nextBeforeRevision).toBeNull();
  expect(await repository.declarePractice(person, person.userId, body, attempt)).toEqual(latest);
  expect(
    (
      await database.pool.query(
        "select id from partner_events where actor_id=$1 and kind='practice.declared.v1'",
        [person.userId],
      )
    ).rowCount,
  ).toBe(23);
});

it("requires reconfirmation after professional identity round trips and preserves the original declaration on replay", async () => {
  const person = await actor();
  await repository.apply(person, application, key());
  const original = await repository.practice(person, person.userId),
    body = input(original),
    attempt = key();
  const first = await repository.declarePractice(person, person.userId, body, attempt);
  for (const name of ["Autre nom déclaré", application.name]) {
    await review(person, "needs_information");
    await repository.apply(person, { ...application, name }, key());
    expect(await readPracticeSummary(database.pool, person.userId)).toMatchObject({
      status: "scope_changed",
      languageCodes: [],
      cantons: [],
    });
    const replay = await repository.declarePractice(person, person.userId, body, attempt);
    expect(replay.current).toEqual({ ...first.current, professionalScope: "changed" });
    await expect(
      repository.declarePractice(person, person.userId, { ...body, revision: 1 }, key()),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  }
  const current = await repository.practice(person, person.userId);
  expect(current.professionalRevision).toBe(original.professionalRevision + 2);
  const next = await repository.declarePractice(person, person.userId, input(current), key());
  expect(next.current?.professionalScope).toBe("current");
  expect(next.history.at(-1)?.declaredName).toBe(application.name);
  expect(next.history.at(-1)?.professionalScope).toBe("changed");
});

it("projects declarations on an authorized Lead without matching, changing references or restarting any clock", async () => {
  const person = await actor(),
    owner = { ...(await actor()), wallet: true };
  await repository.apply(person, application, key());
  await review(person, "approved");
  let lead = await repository.create(
    admin,
    leadCreateInputSchema.parse({
      title: "Besoin isolé",
      category: "vehicle",
      object: "Véhicule",
      context: "",
      clientUserId: owner.userId,
      clientProfileId: null,
      clientName: "Client synthétique",
      email: "owner@practice.test",
      phone: "",
      language: "Français",
      source: "Test isolé",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Contacter",
      dueAt: new Date(Date.now() + 86400000).toISOString(),
    }),
    key(),
  );
  lead = await repository.command(
    admin,
    lead.id,
    {
      revision: lead.revision,
      action: "assign",
      responsibleId: person.userId,
      reason: "Attribution isolée",
    },
    key(),
  );
  lead = await repository.command(
    person,
    lead.id,
    { revision: lead.revision, action: "accept" },
    key(),
  );
  const referent = await repository.referentProfile(owner, "self", "vehicle");
  await repository.updateReferent(
    owner,
    "self",
    "vehicle",
    {
      revision: referent.current.revision,
      profileRevision: referent.profileRevision,
      advisorId: person.userId,
      confirmed: true,
    },
    key(),
  );
  const beforeLead = (
    await database.pool.query("select * from partner_leads where id=$1", [lead.id])
  ).rows;
  const notifications = (
    await database.pool.query("select * from partner_notifications where lead_id=$1 order by id", [
      lead.id,
    ])
  ).rows;
  const membership = (await repository.context(person)).application;
  const previous = await repository.practice(person, person.userId);
  await repository.declarePractice(person, person.userId, input(previous), key());
  const current = await repository.detail(owner, lead.id);
  expect(current.referentContinuity?.practice).toMatchObject({
    status: "declared",
    languageCodes: ["de", "fr"],
    cantons: ["GE", "VD"],
  });
  expect(current.referentContinuity?.missingChecks).toContain("language");
  expect(current.referentContinuity?.missingChecks).toContain("region");
  expect(current.referentContinuity?.status).toBe("human_review");
  expect((await repository.referentProfile(owner, "self", "vehicle")).current.revision).toBe(1);
  expect((await repository.context(person)).application).toEqual(membership);
  expect(
    (await database.pool.query("select * from partner_leads where id=$1", [lead.id])).rows,
  ).toEqual(beforeLead);
  expect(
    (
      await database.pool.query(
        "select * from partner_notifications where lead_id=$1 order by id",
        [lead.id],
      )
    ).rows,
  ).toEqual(notifications);
  expect(Object.keys(current.referentContinuity!.practice!).sort()).toEqual([
    "cantons",
    "declaredAt",
    "languageCodes",
    "status",
  ]);
  await expect(repository.detail(await actor(), lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
});

async function actor(administrator = false): Promise<PartnerActor> {
  const person = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [person.userId, key(), `${key()}@practice.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    person.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated practice test',now()+interval '1 hour',now()-interval '1 second')",
    [person.id, person.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated Testcontainers permission')",
      [key(), person.userId],
    );
  return person;
}
async function review(person: PartnerActor, state: "approved" | "closed" | "needs_information") {
  const member = (await repository.context(person)).application!;
  return repository.review(
    admin,
    person.userId,
    {
      revision: member.revision,
      state,
      roles: state === "approved" ? ["advisor"] : [],
      reason: "Décision synthétique",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_practice_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  const migrationsFolder = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  await migrate(database.db, { migrationsFolder });
  await migrate(database.db, { migrationsFolder });
  repository = createPartnerRepository(database.pool);
  admin = await actor(true);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});
