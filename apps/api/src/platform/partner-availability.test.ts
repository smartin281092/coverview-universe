import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  partnerApplicationInputSchema,
  professionalAvailabilityInputSchema,
  leadCreateInputSchema,
  type ProfessionalAvailabilityDossier,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
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
  languages: "Français",
  regions: "Genève",
  qualifications: "Test isolé",
});
const input = (dossier: ProfessionalAvailabilityDossier) =>
  professionalAvailabilityInputSchema.parse({
    revision: dossier.current?.revision ?? 0,
    professionalRevision: dossier.professionalRevision,
    modes: ["video", "phone"],
    timezone: "Europe/Zurich",
    confirmed: true,
    periods: [
      {
        kind: "available",
        startsAt: "2030-06-04T08:00:00+02:00",
        endsAt: "2030-06-04T18:00:00+02:00",
      },
      {
        kind: "absent",
        startsAt: "2030-06-04T12:00:00+02:00",
        endsAt: "2030-06-04T13:00:00+02:00",
      },
    ],
  });
async function declared() {
  const person = await actor();
  await repository.apply(person, application, key());
  return person;
}

it("keeps declarations private and personal, including exact replays after closure and revocation", async () => {
  const person = await declared(),
    other = await declared();
  await database.pool.query(
    "update partner_members set organization_id=(select organization_id from partner_members where user_id=$1) where user_id=$2",
    [person.userId, other.userId],
  );
  const before = await repository.availability(person, person.userId);
  expect(before.current).toBeNull();
  const body = input(before),
    attempt = key();
  const saved = await repository.declareAvailability(person, person.userId, body, attempt);
  expect(saved.current).toMatchObject({
    modes: ["phone", "video"],
    professionalScope: "current",
    revision: 1,
  });
  expect(saved.current!.periods[0]!.startsAt).toBe("2030-06-04T06:00:00.000Z");
  expect((await repository.availability(admin, person.userId)).canDeclare).toBe(false);
  for (const visitor of [other, { ...person, wallet: true }]) {
    await expect(repository.availability(visitor, person.userId)).rejects.toMatchObject({
      code: "PARTNER_ACCESS_DENIED",
    });
    await expect(
      repository.declareAvailability(visitor, person.userId, body, attempt),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  }
  await expect(
    repository.declareAvailability(admin, person.userId, input(saved), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(await repository.declareAvailability(person, person.userId, body, attempt)).toEqual(saved);
  await expect(
    repository.declareAvailability(person, person.userId, { ...body, modes: ["home"] }, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  await review(person, "closed");
  expect((await repository.availability(person, person.userId)).canDeclare).toBe(false);
  await expect(
    repository.declareAvailability(person, person.userId, body, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const expiredAdmin = await actor(true);
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
    [expiredAdmin.id],
  );
  await expect(repository.availability(expiredAdmin, person.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    person.id,
  ]);
  await expect(repository.availability(person, person.userId)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
  await expect(
    repository.declareAvailability(person, person.userId, body, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("validates finite half-open periods, offsets and absence overlap without inferring empty availability", async () => {
  const person = await declared(),
    dossier = await repository.availability(person, person.userId),
    body = input(dossier);
  const period = body.periods[0]!;
  for (const invalid of [
    { modes: ["phone", "phone"] },
    { modes: ["fax"] },
    { confirmed: false },
    { timezone: "UTC" },
    { periods: [{ ...period, endsAt: period.startsAt }] },
    { periods: [{ ...period, endsAt: "2032-01-01T00:00:00Z" }] },
    { periods: [{ ...period, startsAt: "2030-06-04T08:00" }] },
    {
      periods: [
        { ...period, startsAt: "2030-06-04T08:00:00.0006Z", endsAt: "2030-06-04T08:00:00.0014Z" },
      ],
    },
    { periods: [period, { ...period, startsAt: "2030-06-04T10:00:00Z" }] },
    { periods: Array.from({ length: 61 }, () => period) },
  ])
    expect(professionalAvailabilityInputSchema.safeParse({ ...body, ...invalid }).success).toBe(
      false,
    );
  const bounded = Array.from({ length: 61 }, (_, index) => ({
    kind: "available" as const,
    startsAt: new Date(Date.parse("2030-01-01T00:00:00Z") + index * 3600000).toISOString(),
    endsAt: new Date(Date.parse("2030-01-01T00:00:00Z") + (index + 1) * 3600000).toISOString(),
  }));
  expect(
    professionalAvailabilityInputSchema.safeParse({ ...body, periods: bounded.slice(0, 60) })
      .success,
  ).toBe(true);
  expect(professionalAvailabilityInputSchema.safeParse({ ...body, periods: bounded }).success).toBe(
    false,
  );
  await expect(
    repository.declareAvailability(
      person,
      person.userId,
      { ...body, professionalRevision: 100 },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect((await repository.availability(person, person.userId)).current).toBeNull();
  const saved = await repository.declareAvailability(
    person,
    person.userId,
    {
      ...body,
      periods: [
        ...body.periods,
        { ...period, startsAt: period.endsAt, endsAt: "2030-06-04T19:00:00+02:00" },
      ],
    },
    key(),
  );
  expect(saved.current!.periods).toHaveLength(3);
  const cleared = await repository.declareAvailability(
    person,
    person.userId,
    { ...input(saved), modes: [], periods: [] },
    key(),
  );
  expect(cleared.current).toMatchObject({ modes: [], periods: [], revision: 2 });
  expect(cleared.history[1]!.periods).toHaveLength(3);
  // The two autumn occurrences are different explicit instants, never merged by wall-clock text.
  const autumn = await repository.declareAvailability(
    person,
    person.userId,
    {
      ...input(cleared),
      periods: [
        {
          kind: "available",
          startsAt: "2030-10-27T02:15:00+02:00",
          endsAt: "2030-10-27T02:45:00+02:00",
        },
        {
          kind: "available",
          startsAt: "2030-10-27T02:15:00+01:00",
          endsAt: "2030-10-27T02:45:00+01:00",
        },
      ],
    },
    key(),
  );
  expect(autumn.current!.periods.map((p) => p.startsAt)).toEqual([
    "2030-10-27T00:15:00.000Z",
    "2030-10-27T01:15:00.000Z",
  ]);
  for (const sql of [
    "update partner_availability_declarations set modes=array['fax'] where user_id=$1",
    "update partner_availability_declarations set timezone='UTC' where user_id=$1",
    "update partner_availability_periods set ends_at=starts_at where declaration_id in (select id from partner_availability_declarations where user_id=$1)",
    "update partner_availability_periods set position=60 where declaration_id in (select id from partner_availability_declarations where user_id=$1)",
    "update partner_availability_periods set kind='reserved' where declaration_id in (select id from partner_availability_declarations where user_id=$1)",
  ])
    await expect(database.pool.query(sql, [person.userId])).rejects.toMatchObject({
      code: "23514",
    });
});

it("serializes revisions and preserves complete history while exact retries project the current declaration", async () => {
  const person = await declared(),
    body = input(await repository.availability(person, person.userId)),
    attempt = key();
  const same = await Promise.all([
    repository.declareAvailability(person, person.userId, body, attempt),
    repository.declareAvailability(person, person.userId, body, attempt),
  ]);
  expect(same[0]).toEqual(same[1]);
  const race = await Promise.allSettled(
    (["home", "office"] as const).map((mode) =>
      repository.declareAvailability(
        person,
        person.userId,
        { ...input(same[0]), modes: [mode] },
        key(),
      ),
    ),
  );
  expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(race.find((r) => r.status === "rejected")).toMatchObject({
    reason: { code: "PARTNER_CONFLICT" },
  });
  let latest = await repository.availability(person, person.userId);
  for (let i = 0; i < 21; i++)
    latest = await repository.declareAvailability(person, person.userId, input(latest), key());
  expect(latest.current!.revision).toBe(23);
  expect(latest.history).toHaveLength(20);
  const older = await repository.availability(person, person.userId, latest.nextBeforeRevision!);
  expect(older.current).toEqual(latest.current);
  expect(older.history.map((item) => item.revision)).toEqual([3, 2, 1]);
  expect(older.history[2]!.periods).toEqual(same[0].current!.periods);
  expect(await repository.declareAvailability(person, person.userId, body, attempt)).toEqual(
    latest,
  );
  const events = await database.pool.query<{ count: string }>(
    "select count(*) from partner_events where actor_id=$1 and kind='availability.declared.v1'",
    [person.userId],
  );
  expect(Number(events.rows[0]!.count)).toBe(23);
});

it("requires reconfirmation after professional scope changes and round trips without rewriting original parties", async () => {
  const person = await declared(),
    first = await repository.declareAvailability(
      person,
      person.userId,
      input(await repository.availability(person, person.userId)),
      key(),
    );
  await review(person, "needs_information");
  await repository.apply(
    person,
    {
      ...application,
      name: "Nouvelle identité synthétique",
      organization: "Autre organisation synthétique",
    },
    key(),
  );
  let changed = await repository.availability(person, person.userId);
  expect(changed.current).toMatchObject({
    professionalScope: "changed",
    declaredName: application.name,
    declaredOrganization: application.organization,
  });
  await expect(
    repository.declareAvailability(person, person.userId, input(first), key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await review(person, "needs_information");
  await repository.apply(person, application, key());
  changed = await repository.availability(person, person.userId);
  expect(changed.current!.professionalScope).toBe("changed");
  const confirmed = await repository.declareAvailability(
    person,
    person.userId,
    input(changed),
    key(),
  );
  expect(confirmed.current!.professionalScope).toBe("current");
  expect(confirmed.history[1]).toMatchObject({
    professionalScope: "changed",
    professionalRevision: first.professionalRevision,
  });
});

it("does not alter a Lead, accepted appointment, client preference, referent or service clocks", async () => {
  const person = await declared(),
    owner = { ...(await actor()), wallet: true };
  await review(person, "approved");
  let lead = await repository.create(
    admin,
    leadCreateInputSchema.parse({
      clientUserId: owner.userId,
      clientProfileId: null,
      title: "Besoin synthétique",
      clientName: "Client synthétique",
      category: "vehicle",
      object: "Véhicule isolé",
      context: "",
      email: "owner@availability.test",
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
      action: "assign",
      revision: lead.revision,
      responsibleId: person.userId,
      reason: "Attribution synthétique",
    },
    key(),
  );
  lead = await repository.command(
    person,
    lead.id,
    { action: "accept", revision: lead.revision },
    key(),
  );
  lead = await repository.command(
    person,
    lead.id,
    {
      action: "appointment",
      revision: lead.revision,
      appointment: {
        advisorId: person.userId,
        startsAt: "2030-06-04T10:00:00Z",
        durationMinutes: 30,
        mode: "video",
        location: "À convenir",
        timezone: "Europe/Zurich",
      },
    },
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
  const advice = await repository.advicePreferences(owner, lead.id);
  await repository.confirmAdvicePreferences(
    owner,
    lead.id,
    {
      revision: advice.revision,
      profileRevision: advice.profileRevision!,
      scopeRevision: advice.scopeRevision,
      languageCode: "fr",
      mode: "video",
      canton: null,
      confirmed: true,
    },
    key(),
  );
  const snapshot = async () => {
    const values = [];
    for (const table of [
      "partner_leads",
      "partner_appointments",
      "partner_notifications",
      "partner_tasks",
      "partner_referent_selections",
      "partner_advice_preferences",
      "partner_continuity_policies",
      "partner_members",
    ])
      values.push(
        (
          await database.pool.query<Record<string, unknown>>(
            `select to_jsonb(t) value from ${table} t order by to_jsonb(t)::text`,
          )
        ).rows,
      );
    return values;
  };
  const before = await snapshot();
  const body = input(await repository.availability(person, person.userId));
  await repository.declareAvailability(person, person.userId, body, key());
  expect(await snapshot()).toEqual(before);
  const detail = await repository.detail(owner, lead.id);
  expect(detail.appointments[0]!.state).toBe("scheduled");
  expect(detail.referentContinuity?.missingChecks).toEqual(
    expect.arrayContaining(["availability", "conflicts", "preferences"]),
  );
  expect(detail.referentContinuity?.status).toBe("human_review");
  expect(JSON.stringify(detail)).not.toContain("2030-06-04T06:00:00.000Z");
  const audit = await database.pool.query<{
    lead_id: string | null;
    audience: string;
    text: string;
  }>(
    "select lead_id,audience,text from partner_events where actor_id=$1 and kind='availability.declared.v1'",
    [person.userId],
  );
  expect(audit.rows).toEqual([{ lead_id: null, audience: "private", text: "" }]);
});

async function actor(administrator = false): Promise<PartnerActor> {
  const person = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [person.userId, key(), `${key()}@availability.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    person.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated availability test',now()+interval '1 hour',now()-interval '1 second')",
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
    .withDatabase("coverview_availability_test")
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
