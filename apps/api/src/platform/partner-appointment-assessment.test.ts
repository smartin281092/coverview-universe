import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  type ProfessionalAvailabilityInput,
  type AppointmentTimeInput,
  personalAppointmentConfirmSchema,
  personalAppointmentProposalSchema,
  type PersonalAppointmentProposal,
  type PersonalAppointmentConfirm,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
import { createManagedProfileRepository } from "../modules/profiles/profiles.repository.js";
import { createAdminProfileTransferRepository } from "./admin-profile-transfer.repository.js";

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
const period = (start: string, end: string, kind: "available" | "absent" = "available") => ({
  kind,
  startsAt: `2030-06-04T${start}:00Z`,
  endsAt: `2030-06-04T${end}:00Z`,
});
async function declare(
  person: PartnerActor,
  periods = [period("10:00", "11:00")],
  modes: ProfessionalAvailabilityInput["modes"] = ["video"],
) {
  const previous = await repository.availability(person, person.userId);
  return repository.declareAvailability(
    person,
    person.userId,
    {
      revision: previous.current?.revision ?? 0,
      professionalRevision: previous.professionalRevision,
      modes,
      periods,
      timezone: "Europe/Zurich",
      confirmed: true,
    },
    key(),
  );
}
async function preference(
  owner: PartnerActor,
  leadId: string,
  mode: "video" | "phone" | "home" | "office" | null,
) {
  const previous = await repository.advicePreferences(owner, leadId);
  return repository.confirmAdvicePreferences(
    owner,
    leadId,
    {
      revision: previous.revision,
      scopeRevision: previous.scopeRevision,
      profileRevision: previous.profileRevision!,
      mode,
      languageCode: null,
      canton: null,
      confirmed: true,
    },
    key(),
  );
}
async function scenario(
  person?: PartnerActor,
  owner?: PartnerActor,
  profileId: string | null = null,
  withAppointment = true,
) {
  person ??= await professional();
  owner ??= { ...(await actor()), wallet: true };
  let lead = await repository.create(
    admin,
    leadCreateInputSchema.parse({
      clientUserId: owner.userId,
      clientProfileId: profileId,
      clientName: "Client synthétique",
      title: "Besoin synthétique",
      category: "vehicle",
      object: "Véhicule isolé",
      context: "",
      email: "owner@assessment.test",
      phone: "",
      language: "fr",
      source: "Test isolé",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Contacter",
      dueAt: "2030-06-04T09:00:00Z",
    }),
    key(),
  );
  lead = await repository.command(
    person.administrator ? person : admin,
    lead.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: person.userId,
      reason: "Attribution synthétique",
    },
    key(),
  );
  if (withAppointment)
    lead = await repository.command(
      person,
      lead.id,
      {
        action: "appointment",
        revision: lead.revision,
        appointment: {
          advisorId: person.userId,
          startsAt: "2030-06-04T10:00:00Z",
          durationMinutes: 60,
          mode: "video",
          location: "À convenir",
          timezone: "Europe/Zurich",
        },
      },
      key(),
    );
  return {
    person,
    owner,
    lead,
    appt: lead.appointments[0]!,
    assess: () => repository.appointmentAssessment(person, lead.id, lead.appointments[0]!.id),
  };
}

it("covers the entire half-open duration across adjacent declarations, with absences taking priority", async () => {
  const s = await scenario();
  await preference(s.owner, s.lead.id, "video");
  await declare(s.person, [
    period("10:00", "10:30"),
    period("10:30", "11:00"),
    period("09:00", "10:00", "absent"),
    period("11:00", "12:00", "absent"),
  ]);
  expect(await s.assess()).toMatchObject({
    status: "consistent",
    startsAt: "2030-06-04T10:00:00.000Z",
    endsAt: "2030-06-04T11:00:00.000Z",
    declaration: { scope: "current", period: "covered", mode: "offered" },
    overlappingCommitment: false,
    client: { mode: "matches" },
    responsibility: "current",
  });
  await declare(s.person, [period("10:00", "10:30"), period("10:31", "11:00")]);
  expect(await s.assess()).toMatchObject({
    status: "incomplete",
    declaration: { period: "unreported" },
  });
  await declare(s.person, [period("10:00", "11:00"), period("10:59", "12:00", "absent")]);
  expect(await s.assess()).toMatchObject({
    status: "attention",
    declaration: { period: "absence" },
  });
  await declare(s.person, [period("10:00", "11:00"), period("09:00", "10:01", "absent")]);
  expect((await s.assess()).declaration.period).toBe("absence");
  await declare(s.person, [], []);
  expect(await s.assess()).toMatchObject({
    status: "incomplete",
    declaration: { mode: "unspecified", period: "unreported" },
  });
});

it("never infers availability from approval or legacy text and invalidates professional round trips", async () => {
  const s = await scenario();
  expect(await s.assess()).toMatchObject({
    status: "incomplete",
    declaration: { scope: "missing", mode: "unknown", period: "unknown", revision: null },
  });
  await declare(s.person, [period("10:00", "11:00")], ["phone"]);
  expect(await s.assess()).toMatchObject({
    status: "attention",
    declaration: { mode: "not_offered" },
  });
  await declare(s.person);
  for (const name of ["Nouvelle identité synthétique", application.name]) {
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,'{name}',to_jsonb($2::text)) where user_id=$1",
      [s.person.userId, name],
    );
    expect(await s.assess()).toMatchObject({
      status: "incomplete",
      declaration: { scope: "changed", mode: "unknown", period: "unknown" },
    });
  }
  await declare(s.person);
  expect((await s.assess()).declaration.scope).toBe("current");
  await database.pool.query(
    "update partner_members set application=jsonb_set(application,'{categories}','[\"health\"]'::jsonb) where user_id=$1",
    [s.person.userId],
  );
  expect(await s.assess()).toMatchObject({
    status: "attention",
    responsibility: "review_required",
  });
});

it("compares only current client wishes and keeps the unresolved change request prioritary", async () => {
  const s = await scenario();
  await declare(s.person);
  expect((await s.assess()).client).toMatchObject({ mode: "unspecified", requestedMode: null });
  await preference(s.owner, s.lead.id, "phone");
  expect(await s.assess()).toMatchObject({
    status: "attention",
    client: { mode: "differs", requestedMode: "phone" },
  });
  for (const title of ["Autre besoin synthétique", s.lead.title]) {
    await database.pool.query("update partner_leads set title=$2 where id=$1", [s.lead.id, title]);
    expect((await s.assess()).client).toMatchObject({
      mode: "confirmation_required",
      requestedMode: null,
    });
  }
  await preference(s.owner, s.lead.id, "video");
  const lead = await repository.detail(s.owner, s.lead.id);
  await repository.command(
    s.owner,
    lead.id,
    {
      action: "client_interlocutor",
      revision: lead.revision,
      reason: "Demande synthétique de changement",
    },
    key(),
  );
  expect(await s.assess()).toMatchObject({
    status: "attention",
    client: { mode: "matches", changeRequested: true },
  });
  await database.pool.query("update partner_leads set client_user_id=null where id=$1", [
    s.lead.id,
  ]);
  expect((await s.assess()).client).toMatchObject({ mode: "unlinked", requestedMode: null });
});

it("requires new client confirmation after a canonical managed-profile transfer", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true };
  const profile = await createManagedProfileRepository(database.db).create(
    owner,
    { kind: "person", displayName: "Personne isolée" },
    key(),
  );
  const s = await scenario(undefined, owner, profile.id);
  await preference(owner, s.lead.id, "video");
  expect((await s.assess()).client.mode).toBe("matches");
  await createAdminProfileTransferRepository(database.db).transfer(
    { id: admin.id, userId: owner.userId, administratorUserId: admin.userId },
    profile.id,
    { destinationUserId: destination.userId, revision: profile.revision },
    key(),
  );
  expect((await s.assess()).client).toMatchObject({
    mode: "confirmation_required",
    requestedMode: null,
  });
  await preference(destination, s.lead.id, "phone");
  expect((await s.assess()).client).toMatchObject({ mode: "differs", requestedMode: "phone" });
});

it("does not expose a colleague's declaration to Admin, manager, other advisors, progress viewers or Wallet", async () => {
  const s = await scenario(),
    colleague = await professional();
  await database.pool.query(
    'update partner_members set organization_id=(select organization_id from partner_members where user_id=$1),roles=\'["advisor","manager"]\' where user_id=$2',
    [s.person.userId, colleague.userId],
  );
  for (const reader of [admin, colleague, s.owner, await professional(), await actor()])
    await expect(repository.appointmentAssessment(reader, s.lead.id, s.appt.id)).rejects.toThrow(
      /^PARTNER_(NOT_FOUND|ACCESS_DENIED)$/u,
    );
  await expect(repository.appointmentAssessment(s.person, s.lead.id, key())).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  // The member can still read their professional declaration, but not an operational appointment after suspension.
  const progress = await professional();
  await database.pool.query("update partner_members set roles='[\"referrer\"]' where user_id=$1", [
    progress.userId,
  ]);
  await database.pool.query("update partner_leads set creator_id=$2 where id=$1", [
    s.lead.id,
    progress.userId,
  ]);
  expect((await repository.detail(progress, s.lead.id)).access).toBe("progress");
  await expect(
    repository.appointmentAssessment(progress, s.lead.id, s.appt.id),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await database.pool.query("update partner_members set state='suspended' where user_id=$1", [
    s.person.userId,
  ]);
  await expect(s.assess()).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await database.pool.query("update partner_members set state='approved' where user_id=$1", [
    s.person.userId,
  ]);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    s.person.id,
  ]);
  await expect(s.assess()).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const personalAdmin = await actor(true),
    a = await scenario(personalAdmin);
  expect((await a.assess()).responsibility).toBe("current");
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
    [personalAdmin.id],
  );
  await expect(a.assess()).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("does not treat managerial visibility as a personal appointment mandate, or an inactive Lead as schedulable", async () => {
  const s = await scenario(),
    successor = await professional();
  await database.pool.query(
    "update partner_members set organization_id=(select organization_id from partner_members where user_id=$1) where user_id=$2",
    [s.person.userId, successor.userId],
  );
  await database.pool.query(
    'update partner_members set roles=\'["advisor","manager"]\' where user_id=$1',
    [s.person.userId],
  );
  await database.pool.query("update partner_leads set responsible_id=$2 where id=$1", [
    s.lead.id,
    successor.userId,
  ]);
  expect((await s.assess()).responsibility).toBe("review_required");
  await database.pool.query(
    "update partner_leads set responsible_id=$2,stage='draft' where id=$1",
    [s.lead.id, s.person.userId],
  );
  expect((await s.assess()).responsibility).toBe("review_required");
  await database.pool.query("update partner_leads set stage='appointment_scheduled' where id=$1", [
    s.lead.id,
  ]);
  await database.pool.query(
    "update partner_appointments set starts_at=now()-interval '2 days' where id=$1",
    [s.appt.id],
  );
  const current = await repository.detail(s.person, s.lead.id);
  await repository.command(
    s.person,
    s.lead.id,
    {
      action: "close",
      revision: current.revision,
      result: "resolved_without_contract",
      reason: "current_suitable",
      comment: "Clôture synthétique, engagement passé conservé",
    },
    key(),
  );
  expect((await s.assess()).responsibility).toBe("review_required");
});

it("reports a collision without leaking another Lead and excludes adjacent or cancelled commitments", async () => {
  const s = await scenario(),
    hidden = await scenario();
  // Explicit inconsistent historical data in the disposable database, never a real appointment.
  const otherId = key();
  await database.pool.query(
    "insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone) values($1,$2,$3,'2030-06-04T10:30:00Z',60,'phone','Secret test location','Europe/Zurich')",
    [otherId, hidden.lead.id, s.person.userId],
  );
  const result = await s.assess();
  expect(result).toMatchObject({ status: "attention", overlappingCommitment: true });
  for (const privateValue of [
    otherId,
    hidden.lead.id,
    hidden.person.userId,
    "Secret test location",
  ])
    expect(JSON.stringify(result)).not.toContain(privateValue);
  for (const starts of ["2030-06-04T09:00:00Z", "2030-06-04T11:00:00Z"]) {
    await database.pool.query("update partner_appointments set starts_at=$2 where id=$1", [
      otherId,
      starts,
    ]);
    expect((await s.assess()).overlappingCommitment).toBe(false);
  }
  await database.pool.query(
    "update partner_appointments set starts_at='2030-06-04T10:30:00Z',state='cancelled' where id=$1",
    [otherId],
  );
  expect((await s.assess()).overlappingCommitment).toBe(false);
  await database.pool.query("update partner_appointments set state='cancelled' where id=$1", [
    s.appt.id,
  ]);
  await expect(s.assess()).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
});

it("rechecks after a concurrent professional update, and reading never mutates business state", async () => {
  const s = await scenario();
  await declare(s.person);
  const tx = await database.pool.connect();
  let pending: ReturnType<typeof s.assess> | undefined;
  try {
    await tx.query("begin");
    await tx.query(
      "update partner_members set application=jsonb_set(application,'{name}','\"Concurrent identity\"'::jsonb) where user_id=$1",
      [s.person.userId],
    );
    pending = s.assess();
    // Read must wait for the locked member; it cannot use an earlier compatible declaration.
    let blocked = false;
    for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
      blocked = !!(
        await database.pool.query(
          "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%partner_members%' limit 1",
        )
      ).rowCount;
      if (!blocked) await setTimeout(10);
    }
    expect(blocked).toBe(true);
    await tx.query("commit");
    expect(await pending).toMatchObject({ declaration: { scope: "changed", period: "unknown" } });
  } finally {
    await tx.query("rollback");
    tx.release();
    await pending;
  }
  const snapshot = async () => {
    const result = [];
    for (const table of [
      "partner_leads",
      "partner_appointments",
      "partner_tasks",
      "partner_members",
      "partner_notifications",
      "partner_notification_reads",
      "partner_events",
      "partner_commands",
      "partner_availability_declarations",
      "partner_availability_periods",
      "partner_advice_preferences",
      "partner_referent_selections",
      "partner_continuity_policies",
    ])
      result.push(
        (
          await database.pool.query(
            `select to_jsonb(t) value from ${table} t order by to_jsonb(t)::text`,
          )
        ).rows,
      );
    return result;
  };
  const before = await snapshot();
  const result = await s.assess();
  expect(result.unverifiedChecks).toEqual([
    "preparation",
    "external_commitments",
    "capacity",
    "client_agreement",
    "eligibility",
  ]);
  expect(await snapshot()).toEqual(before);
  expect((await repository.detail(s.owner, s.lead.id)).referentContinuity?.missingChecks).toEqual(
    expect.arrayContaining(["availability", "conflicts", "preferences"]),
  );
  await database.pool.query("update partner_appointments set mode='home' where id=$1", [s.appt.id]);
  expect((await s.assess()).unverifiedChecks).toContain("travel");
});

async function timeInput(
  s: Awaited<ReturnType<typeof scenario>>,
  preparationMinutes = 30,
): Promise<AppointmentTimeInput> {
  return {
    basis: (await s.assess()).timeProtection!.basis,
    preparationMinutes,
    travelBeforeMinutes: 0,
    travelAfterMinutes: 0,
    confirmed: true,
  };
}
async function readyTime() {
  const s = await scenario();
  await preference(s.owner, s.lead.id, "video");
  await declare(s.person, [period("08:00", "14:00")]);
  return s;
}
it("protects personal preparation atomically, retaining history without changing client commitments or clocks", async () => {
  const s = await readyTime(),
    input = await timeInput(s),
    attempt = key();
  const unchanged = async () =>
    (
      await database.pool.query<Record<string, unknown>>(
        `select to_jsonb(l) lead,
    (select jsonb_agg(n order by id) from partner_notifications n where n.lead_id=l.id) notifications,
    (select jsonb_agg(e order by id) from partner_events e where e.lead_id=l.id) events
    from partner_leads l where id=$1`,
        [s.lead.id],
      )
    ).rows;
  const before = await unchanged();
  const result = await repository.protectAppointmentTime(
    s.person,
    s.lead.id,
    s.appt.id,
    input,
    attempt,
  );
  expect(result.timeProtection).toMatchObject({
    startsAt: "2030-06-04T09:30:00.000Z",
    endsAt: "2030-06-04T11:00:00.000Z",
    current: { revision: 1, preparationMinutes: 30 },
  });
  expect(result.startsAt).toBe(s.appt.startsAt);
  expect(await unchanged()).toEqual(before);
  expect(
    (await repository.protectAppointmentTime(s.person, s.lead.id, s.appt.id, input, attempt))
      .timeProtection?.history,
  ).toHaveLength(1);
  await expect(
    repository.protectAppointmentTime(
      s.person,
      s.lead.id,
      s.appt.id,
      { ...input, preparationMinutes: 31 },
      attempt,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  for (const reader of [s.owner, admin]) {
    const detail = await repository.detail(reader, s.lead.id);
    expect(JSON.stringify(detail)).not.toContain("preparationMinutes");
    expect(JSON.stringify(detail)).not.toContain("occupiedBeforeMinutes");
    expect(detail.appointments[0]).toEqual(s.appt);
  }
  await declare(s.person, [period("08:00", "14:00"), period("09:30", "10:00", "absent")]);
  const reread = await repository.protectAppointmentTime(
    s.person,
    s.lead.id,
    s.appt.id,
    input,
    attempt,
  );
  expect(reread.declaration.period).toBe("absence");
  expect(reread.timeProtection?.current?.revision).toBe(1);
  expect(await unchanged()).toEqual(before);
  expect(reread.unverifiedChecks).toContain("capacity");
  expect(reread.unverifiedChecks).toContain("client_agreement");
});

it("requires complete extended coverage, current sources and explicit zero travel for remote meetings", async () => {
  const s = await readyTime(),
    stale = await timeInput(s);
  await declare(s.person, [period("10:00", "11:00")]);
  await expect(
    repository.protectAppointmentTime(s.person, s.lead.id, s.appt.id, stale, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await expect(
    repository.protectAppointmentTime(s.person, s.lead.id, s.appt.id, await timeInput(s), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await declare(s.person, [period("09:30", "10:00"), period("10:00", "11:00")]);
  await expect(
    repository.protectAppointmentTime(
      s.person,
      s.lead.id,
      s.appt.id,
      { ...(await timeInput(s)), travelBeforeMinutes: 1 },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  const oldPreference = await timeInput(s);
  await preference(s.owner, s.lead.id, "phone");
  await expect(
    repository.protectAppointmentTime(s.person, s.lead.id, s.appt.id, oldPreference, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await expect(
    repository.protectAppointmentTime(s.person, s.lead.id, s.appt.id, await timeInput(s), key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await preference(s.owner, s.lead.id, "video");
  expect(
    (
      await repository.protectAppointmentTime(
        s.person,
        s.lead.id,
        s.appt.id,
        await timeInput(s),
        key(),
      )
    ).declaration.period,
  ).toBe("covered");
});

it("preserves private versions when reducing buffers and rejects SQL modification of history", async () => {
  const s = await readyTime();
  await repository.protectAppointmentTime(
    s.person,
    s.lead.id,
    s.appt.id,
    await timeInput(s),
    key(),
  );
  const result = await repository.protectAppointmentTime(
    s.person,
    s.lead.id,
    s.appt.id,
    await timeInput(s, 0),
    key(),
  );
  expect(result.timeProtection?.history.map((p) => p.preparationMinutes)).toEqual([0, 30]);
  expect(result.timeProtection?.startsAt).toBe(s.appt.startsAt);
  await expect(
    database.pool.query(
      "update partner_appointment_time_plans set preparation_minutes=0 where appointment_id=$1",
      [s.appt.id],
    ),
  ).rejects.toMatchObject({ code: "23514", constraint: "partner_time_plan_immutable" });
  await expect(
    database.pool.query("update partner_appointments set occupied_before_minutes=-1 where id=$1", [
      s.appt.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
});

it("denies other actors and rechecks authorization on a successful command replay", async () => {
  const s = await readyTime(),
    colleague = await professional(),
    input = await timeInput(s),
    attempt = key();
  await repository.protectAppointmentTime(s.person, s.lead.id, s.appt.id, input, attempt);
  for (const reader of [s.owner, admin, colleague])
    await expect(
      repository.protectAppointmentTime(reader, s.lead.id, s.appt.id, input, key()),
    ).rejects.toThrow();
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    s.person.id,
  ]);
  await expect(
    repository.protectAppointmentTime(s.person, s.lead.id, s.appt.id, input, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("serializes competing confirmations and prevents both old commands and SQL writers from taking protected time", async () => {
  const s = await readyTime(),
    input = await timeInput(s);
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      repository.protectAppointmentTime(s.person, s.lead.id, s.appt.id, input, key()),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const current = await repository.detail(s.person, s.lead.id);
  await expect(
    repository.command(
      s.person,
      s.lead.id,
      {
        action: "appointment",
        revision: current.revision,
        appointment: {
          advisorId: s.person.userId,
          mode: "video",
          location: "Test",
          timezone: "Europe/Zurich",
          startsAt: "2030-06-04T09:30:00Z",
          durationMinutes: 30,
        },
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_APPOINTMENT_CONFLICT" });
  const raw = (date: string) =>
    database.pool.query(
      "insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone) values($1,$2,$3,$4,30,'video','SQL N-1','Europe/Zurich')",
      [key(), s.lead.id, s.person.userId, date],
    );
  await expect(raw("2030-06-04T09:00:00Z")).resolves.toBeDefined(); // exact boundary
  await expect(raw("2030-06-04T09:01:00Z")).rejects.toMatchObject({
    code: "23P01",
    constraint: "partner_protected_time_conflict",
  });
});

it("rechecks the full interval after actually waiting on the advisor schedule lock", async () => {
  const other = await scenario();
  const s = await readyTime(),
    input = await timeInput(s),
    blocker = await database.pool.connect();
  await repository.command(
    admin,
    other.lead.id,
    {
      action: "assign",
      revision: other.lead.revision,
      responsibleId: s.person.userId,
      reason: "Test cross-Lead",
    },
    key(),
  );
  let pending: Promise<unknown> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [s.person.userId]);
    pending = repository.protectAppointmentTime(s.person, s.lead.id, s.appt.id, input, key()).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      waiting = !!(
        await database.pool.query(
          "select 1 from pg_locks where locktype='advisory' and not granted",
        )
      ).rowCount;
      if (waiting) break;
      await setTimeout(10);
    }
    expect(waiting).toBe(true);
    await blocker.query(
      "insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone) values($1,$2,$3,'2030-06-04T09:30:00Z',30,'video','N-1 competing commitment','Europe/Zurich')",
      [key(), other.lead.id, s.person.userId],
    );
    await blocker.query("commit");
    expect(await pending).toMatchObject({ error: { code: "PARTNER_APPOINTMENT_CONFLICT" } });
    expect((await s.assess()).timeProtection?.current).toBeNull();
  } finally {
    await blocker.query("rollback");
    blocker.release();
    await pending;
  }
});

it("protects preparation and both physical journeys, never using a gap or absence as free time", async () => {
  const s = await scenario();
  await database.pool.query("update partner_appointments set mode='home' where id=$1", [s.appt.id]);
  await preference(s.owner, s.lead.id, "home");
  await declare(s.person, [period("09:00", "11:30")], ["home"]);
  const input = { ...(await timeInput(s, 20)), travelBeforeMinutes: 40, travelAfterMinutes: 30 };
  const result = await repository.protectAppointmentTime(
    s.person,
    s.lead.id,
    s.appt.id,
    input,
    key(),
  );
  expect(result.timeProtection).toMatchObject({
    startsAt: "2030-06-04T09:00:00.000Z",
    endsAt: "2030-06-04T11:30:00.000Z",
  });
  expect(result.endsAt).toBe("2030-06-04T11:00:00.000Z");
  for (const periods of [
    [period("09:00", "09:59"), period("10:00", "11:30")],
    [period("09:00", "11:30"), period("11:29", "12:00", "absent")],
  ]) {
    await declare(s.person, periods, ["home"]);
    await expect(
      repository.protectAppointmentTime(
        s.person,
        s.lead.id,
        s.appt.id,
        { ...input, basis: (await s.assess()).timeProtection!.basis },
        key(),
      ),
    ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
    expect((await s.assess()).timeProtection?.history).toHaveLength(1);
  }
});

it("makes a waiting N-1 SQL writer see newly committed protected time on another Lead", async () => {
  const s = await readyTime(),
    other = await scenario();
  const blocker = await database.pool.connect(),
    writer = await database.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    const pid = (await writer.query<{ pid: number }>("select pg_backend_pid() pid")).rows[0]!.pid;
    await blocker.query("begin");
    await blocker.query("update partner_appointments set occupied_before_minutes=30 where id=$1", [
      s.appt.id,
    ]);
    pending = writer
      .query(
        "insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone) values($1,$2,$3,'2030-06-04T09:30:00Z',30,'video','Concurrent SQL','Europe/Zurich')",
        [key(), other.lead.id, s.person.userId],
      )
      .then(
        () => ({ accepted: true }),
        (error: unknown) => ({ error }),
      );
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      waiting = !!(
        await database.pool.query(
          "select 1 from pg_locks where pid=$1 and locktype='advisory' and not granted",
          [pid],
        )
      ).rowCount;
      if (waiting) break;
      await setTimeout(10);
    }
    expect(waiting).toBe(true);
    await blocker.query("commit");
    expect(await pending).toMatchObject({
      error: { code: "23P01", constraint: "partner_protected_time_conflict" },
    });
  } finally {
    await blocker.query("rollback");
    await pending;
    blocker.release();
    writer.release();
  }
});

const proposal: PersonalAppointmentProposal = {
  appointment: {
    startsAt: "2030-06-04T10:00:00Z",
    durationMinutes: 60,
    mode: "video",
    location: "Connexion convenue",
    timezone: "Europe/Zurich",
  },
  time: { preparationMinutes: 30, travelBeforeMinutes: 0, travelAfterMinutes: 0 },
};
async function readyCreation(person?: PartnerActor) {
  const s = await scenario(person, undefined, null, false);
  await declare(s.person, [period("08:00", "14:00")], ["phone", "video", "home", "office"]);
  await preference(s.owner, s.lead.id, "video");
  return s;
}
async function creationInput(
  s: Awaited<ReturnType<typeof scenario>>,
  input = proposal,
): Promise<PersonalAppointmentConfirm> {
  const preview = await repository.previewPersonalAppointment(s.person, s.lead.id, input);
  return {
    ...input,
    basis: preview.basis,
    clientAgreementConfirmed: true,
    externalCommitmentsChecked: true,
    capacityConfirmed: true,
    preparationAndTravelChecked: true,
  };
}
async function creationState(s: Awaited<ReturnType<typeof scenario>>) {
  return (
    await database.pool.query<Record<string, unknown>>(
      `select to_jsonb(l) lead,
    (select jsonb_agg(a order by id) from partner_appointments a where a.lead_id=l.id) appointments,
    (select jsonb_agg(e order by id) from partner_events e where e.lead_id=l.id or (e.lead_id is null and e.actor_id=$2)) events,
    (select jsonb_agg(n order by id) from partner_notifications n where n.lead_id=l.id) notifications,
    (select jsonb_agg(p order by id) from partner_appointment_time_plans p where p.advisor_id=$2) plans,
    (select jsonb_agg(c order by id) from partner_commands c where c.user_id=$2) commands
    from partner_leads l where id=$1`,
      [s.lead.id, s.person.userId],
    )
  ).rows;
}
it("previews without effects, then creates commitment, time and private attestations exactly once", async () => {
  const s = await readyCreation(),
    before = await creationState(s);
  const preview = await repository.previewPersonalAppointment(s.person, s.lead.id, proposal);
  expect(preview).toMatchObject({
    canConfirm: true,
    occupiedStartsAt: "2030-06-04T09:30:00.000Z",
    occupiedEndsAt: "2030-06-04T11:00:00.000Z",
  });
  expect(await creationState(s)).toEqual(before);
  const input = await creationInput(s),
    attempt = key();
  const result = await repository.confirmPersonalAppointment(s.person, s.lead.id, input, attempt);
  expect(result).toMatchObject({
    stage: "appointment_scheduled",
    revision: s.lead.revision + 1,
    dueAt: "2030-06-04T10:00:00.000Z",
  });
  expect(result.firstUsefulAt).not.toBeNull();
  expect(result.appointments).toHaveLength(1);
  expect(result.events.filter((e) => e.kind === "appointment.scheduled")).toHaveLength(1);
  const appt = result.appointments[0]!;
  expect(appt).toMatchObject({
    advisorId: s.person.userId,
    durationMinutes: 60,
    mode: "video",
    state: "scheduled",
  });
  const proof = (
    await database.pool.query(
      "select * from partner_appointment_time_plans where appointment_id=$1",
      [appt.id],
    )
  ).rows;
  expect(proof).toHaveLength(1);
  expect(proof[0]).toMatchObject({
    revision: 1,
    preparation_minutes: 30,
    evidence: {
      personalConfirmation: { version: 1, capacityConfirmed: true, clientAgreementConfirmed: true },
    },
  });
  const after = await creationState(s);
  expect(
    (await repository.confirmPersonalAppointment(s.person, s.lead.id, input, attempt)).appointments,
  ).toEqual(result.appointments);
  expect(await creationState(s)).toEqual(after);
  await expect(
    repository.confirmPersonalAppointment(
      s.person,
      s.lead.id,
      { ...input, time: { ...input.time, preparationMinutes: 31 } },
      attempt,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  for (const reader of [admin, s.owner]) {
    const visible = JSON.stringify(await repository.detail(reader, s.lead.id));
    for (const privateField of [
      "preparationMinutes",
      "occupiedBeforeMinutes",
      "personalConfirmation",
      "capacityConfirmed",
      "time_protected",
    ])
      expect(visible).not.toContain(privateField);
    await expect(
      repository.appointmentAssessment(reader, s.lead.id, appt.id),
    ).rejects.toMatchObject({
      code: reader.wallet ? "PARTNER_ACCESS_DENIED" : "PARTNER_NOT_FOUND",
    });
  }
  expect(
    (await repository.appointmentAssessment(s.person, s.lead.id, appt.id)).timeProtection?.current,
  ).toMatchObject({ revision: 1, preparationMinutes: 30 });
});

it("rejects incomplete declarations, absence, incompatible modes, missing wishes and remote travel without partial writes", async () => {
  const s = await readyCreation();
  for (const periods of [
    [period("10:00", "11:00")],
    [period("09:30", "09:59"), period("10:00", "11:00")],
    [period("08:00", "14:00"), period("09:45", "10:00", "absent")],
  ]) {
    await declare(s.person, periods);
    const before = await creationState(s),
      input = await creationInput(s);
    expect(
      (await repository.previewPersonalAppointment(s.person, s.lead.id, proposal)).canConfirm,
    ).toBe(false);
    await expect(
      repository.confirmPersonalAppointment(s.person, s.lead.id, input, key()),
    ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
    expect(await creationState(s)).toEqual(before);
  }
  await declare(s.person, [
    period("09:30", "10:00"),
    period("10:00", "11:00"),
    period("11:00", "12:00", "absent"),
  ]);
  expect(
    (await repository.previewPersonalAppointment(s.person, s.lead.id, proposal)).canConfirm,
  ).toBe(true);
  for (const input of [
    { ...proposal, time: { ...proposal.time, travelBeforeMinutes: 1 } },
    { ...proposal, appointment: { ...proposal.appointment, startsAt: "2020-06-04T10:00:00Z" } },
    { ...proposal, appointment: { ...proposal.appointment, mode: "home" as const } },
  ]) {
    const before = await creationState(s);
    await expect(
      repository.confirmPersonalAppointment(
        s.person,
        s.lead.id,
        await creationInput(s, input),
        key(),
      ),
    ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
    expect(await creationState(s)).toEqual(before);
  }
  await preference(s.owner, s.lead.id, null);
  expect(
    (await repository.previewPersonalAppointment(s.person, s.lead.id, proposal)).canConfirm,
  ).toBe(false);
  expect(
    personalAppointmentProposalSchema.safeParse({
      ...proposal,
      appointment: { ...proposal.appointment, advisorId: s.person.userId },
    }).success,
  ).toBe(false);
  const noPreparation = { travelBeforeMinutes: 0, travelAfterMinutes: 0 };
  expect(
    personalAppointmentProposalSchema.safeParse({ ...proposal, time: noPreparation }).success,
  ).toBe(false);
  expect(
    personalAppointmentConfirmSchema.safeParse({
      ...(await creationInput(s)),
      clientAgreementConfirmed: false,
    }).success,
  ).toBe(false);
});

it("binds confirmation to exact proposal and changing professional, client and Lead sources", async () => {
  const s = await readyCreation();
  let input = await creationInput(s);
  await expect(
    repository.confirmPersonalAppointment(
      s.person,
      s.lead.id,
      { ...input, appointment: { ...input.appointment, location: "Autre lieu" } },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await declare(s.person, [period("08:00", "14:00")]);
  await expect(
    repository.confirmPersonalAppointment(s.person, s.lead.id, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  input = await creationInput(s);
  await preference(s.owner, s.lead.id, "phone");
  await preference(s.owner, s.lead.id, "video");
  await expect(
    repository.confirmPersonalAppointment(s.person, s.lead.id, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  input = await creationInput(s);
  await database.pool.query("update partner_leads set title='Autre besoin' where id=$1", [
    s.lead.id,
  ]);
  await expect(
    repository.confirmPersonalAppointment(s.person, s.lead.id, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(
    (await repository.previewPersonalAppointment(s.person, s.lead.id, proposal)).assessment.client
      .mode,
  ).toBe("confirmation_required");
  await preference(s.owner, s.lead.id, "video");
  input = await creationInput(s);
  const lead = await repository.detail(s.owner, s.lead.id);
  await repository.command(
    s.owner,
    lead.id,
    { action: "client_interlocutor", revision: lead.revision, reason: "Changement synthétique" },
    key(),
  );
  await expect(
    repository.confirmPersonalAppointment(s.person, s.lead.id, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(
    (await repository.previewPersonalAppointment(s.person, s.lead.id, proposal)).assessment.client
      .changeRequested,
  ).toBe(true);
  expect((await repository.detail(s.person, s.lead.id)).appointments).toHaveLength(0);
});

it("requires personal mandate and current session even at replay, while preserving Admin's personal exception", async () => {
  const s = await readyCreation(),
    colleague = await professional();
  await database.pool.query(
    'update partner_members set organization_id=(select organization_id from partner_members where user_id=$1),roles=\'["advisor","manager"]\' where user_id=$2',
    [s.person.userId, colleague.userId],
  );
  for (const reader of [s.owner, colleague, await professional(), await actor()])
    await expect(
      repository.previewPersonalAppointment(reader, s.lead.id, proposal),
    ).rejects.toThrow(/^PARTNER_(NOT_FOUND|ACCESS_DENIED)$/u);
  const input = await creationInput(s),
    attempt = key();
  await repository.confirmPersonalAppointment(s.person, s.lead.id, input, attempt);
  await database.pool.query("update partner_members set state='suspended' where user_id=$1", [
    s.person.userId,
  ]);
  await expect(
    repository.confirmPersonalAppointment(s.person, s.lead.id, input, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await database.pool.query("update partner_members set state='approved' where user_id=$1", [
    s.person.userId,
  ]);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    s.person.id,
  ]);
  await expect(
    repository.confirmPersonalAppointment(s.person, s.lead.id, input, attempt),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  const selfAdmin = await actor(true);
  await repository.apply(selfAdmin, application, key());
  const a = await readyCreation(selfAdmin);
  expect(
    (
      await repository.confirmPersonalAppointment(
        selfAdmin,
        a.lead.id,
        await creationInput(a),
        key(),
      )
    ).appointments[0]?.advisorId,
  ).toBe(selfAdmin.userId);
  await database.pool.query(
    "update identity_sessions set mfa_verified_at=now()-interval '25 hours' where id=$1",
    [selfAdmin.id],
  );
  await expect(
    repository.previewPersonalAppointment(selfAdmin, a.lead.id, proposal),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("requires reconfirmation after profile transfer and never treats professional round trips as fresh", async () => {
  const owner = { ...(await actor()), wallet: true },
    destination = { ...(await actor()), wallet: true };
  const profile = await createManagedProfileRepository(database.db).create(
    owner,
    { kind: "person", displayName: "Création isolée" },
    key(),
  );
  const s = await scenario(undefined, owner, profile.id, false);
  await declare(s.person, [period("08:00", "14:00")]);
  await preference(owner, s.lead.id, "video");
  const input = await creationInput(s);
  await createAdminProfileTransferRepository(database.db).transfer(
    { id: admin.id, userId: owner.userId, administratorUserId: admin.userId },
    profile.id,
    { destinationUserId: destination.userId, revision: profile.revision },
    key(),
  );
  await expect(
    repository.confirmPersonalAppointment(s.person, s.lead.id, input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(
    (await repository.previewPersonalAppointment(s.person, s.lead.id, proposal)).canConfirm,
  ).toBe(false);
  await preference(destination, s.lead.id, "video");
  const beforeChange = await creationInput(s);
  for (const name of ["Nom temporaire", application.name])
    await database.pool.query(
      "update partner_members set application=jsonb_set(application,'{name}',to_jsonb($2::text)) where user_id=$1",
      [s.person.userId, name],
    );
  await expect(
    repository.confirmPersonalAppointment(s.person, s.lead.id, beforeChange, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(
    (await repository.previewPersonalAppointment(s.person, s.lead.id, proposal)).assessment
      .declaration.scope,
  ).toBe("changed");
});

it("serializes confirmations across two Leads and makes legacy creators respect the entire protected period", async () => {
  const s = await readyCreation(),
    other = await readyCreation(s.person);
  const a = await creationInput(s),
    b = await creationInput(other);
  const results = await Promise.allSettled([
    repository.confirmPersonalAppointment(s.person, s.lead.id, a, key()),
    repository.confirmPersonalAppointment(s.person, other.lead.id, b, key()),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toMatchObject([
    { reason: { code: "PARTNER_APPOINTMENT_CONFLICT" } },
  ]);
  const loser = results[0].status === "rejected" ? s : other;
  const current = await repository.detail(s.person, loser.lead.id);
  expect(current.appointments).toHaveLength(0);
  await expect(
    repository.command(
      s.person,
      loser.lead.id,
      {
        action: "appointment",
        revision: current.revision,
        appointment: {
          ...proposal.appointment,
          advisorId: s.person.userId,
          startsAt: "2030-06-04T09:15:00Z",
          durationMinutes: 30,
        },
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_APPOINTMENT_CONFLICT" });
  const adjacent = {
    ...proposal,
    appointment: { ...proposal.appointment, startsAt: "2030-06-04T11:00:00Z" },
    time: { preparationMinutes: 0, travelBeforeMinutes: 0, travelAfterMinutes: 0 },
  };
  expect(
    (
      await repository.confirmPersonalAppointment(
        s.person,
        loser.lead.id,
        await creationInput(loser, adjacent),
        key(),
      )
    ).appointments,
  ).toHaveLength(1);
});

it("captures both on-site journeys and rolls back all effects if the private proof cannot be persisted", async () => {
  const s = await readyCreation();
  await preference(s.owner, s.lead.id, "home");
  const onsite = {
    ...proposal,
    appointment: { ...proposal.appointment, mode: "home" as const },
    time: { preparationMinutes: 15, travelBeforeMinutes: 30, travelAfterMinutes: 45 },
  };
  const input = await creationInput(s, onsite);
  expect(await repository.previewPersonalAppointment(s.person, s.lead.id, onsite)).toMatchObject({
    canConfirm: true,
    occupiedStartsAt: "2030-06-04T09:15:00.000Z",
    occupiedEndsAt: "2030-06-04T11:45:00.000Z",
  });
  // A genuine database failure after appointment/event insertion must roll the entire transaction back.
  await database.pool.query(
    `create function reject_creation_proof() returns trigger language plpgsql as $$ begin if new.advisor_id='${s.person.userId}' then raise exception 'isolated proof failure'; end if; return new; end $$`,
  );
  await database.pool.query(
    "create trigger reject_creation_proof before insert on partner_appointment_time_plans for each row execute function reject_creation_proof()",
  );
  const before = await creationState(s);
  await expect(
    repository.confirmPersonalAppointment(s.person, s.lead.id, input, key()),
  ).rejects.toThrow("isolated proof failure");
  expect(await creationState(s)).toEqual(before);
  await database.pool.query("drop trigger reject_creation_proof on partner_appointment_time_plans");
  const result = await repository.confirmPersonalAppointment(s.person, s.lead.id, input, key());
  expect(
    (await repository.appointmentAssessment(s.person, s.lead.id, result.appointments[0]!.id))
      .timeProtection?.current,
  ).toMatchObject(onsite.time);
});

const movedProposal: PersonalAppointmentProposal = {
  appointment: { ...proposal.appointment, startsAt: "2030-06-04T10:30:00Z", durationMinutes: 30 },
  time: { preparationMinutes: 15, travelBeforeMinutes: 0, travelAfterMinutes: 0 },
};
async function readyRescheduling() {
  const s = await scenario();
  await declare(s.person, [period("08:00", "16:00")], ["video", "phone", "home", "office"]);
  await preference(s.owner, s.lead.id, "video");
  return s;
}
async function reschedulingInput(
  s: Awaited<ReturnType<typeof scenario>>,
  proposed = movedProposal,
) {
  const preview = await repository.previewPersonalRescheduling(
    s.person,
    s.lead.id,
    s.appt.id,
    proposed,
  );
  return personalAppointmentConfirmSchema.parse({
    ...proposed,
    basis: preview.basis,
    clientAgreementConfirmed: true,
    externalCommitmentsChecked: true,
    capacityConfirmed: true,
    preparationAndTravelChecked: true,
  });
}
it("reschedules the same commitment once, preserves responsibility and clocks, and exposes only the authorized history", async () => {
  const s = await readyRescheduling(),
    before = await creationState(s);
  const preview = await repository.previewPersonalRescheduling(
    s.person,
    s.lead.id,
    s.appt.id,
    movedProposal,
  );
  expect(preview).toMatchObject({
    canConfirm: true,
    previous: s.appt,
    occupiedStartsAt: "2030-06-04T10:15:00.000Z",
  });
  expect(await creationState(s)).toEqual(before);
  const input = await reschedulingInput(s),
    attempt = key();
  const result = await repository.confirmPersonalRescheduling(
    s.person,
    s.lead.id,
    s.appt.id,
    input,
    attempt,
  );
  expect(result.appointments).toHaveLength(1);
  expect(result.appointments[0]).toMatchObject({
    id: s.appt.id,
    advisorId: s.person.userId,
    state: "scheduled",
    startsAt: "2030-06-04T10:30:00.000Z",
    durationMinutes: 30,
  });
  expect(result).toMatchObject({
    stage: s.lead.stage,
    assignment: s.lead.assignment,
    responsibleId: s.lead.responsibleId,
    firstUsefulAt: s.lead.firstUsefulAt,
    notifiedAt: s.lead.notifiedAt,
    firstActionDueAt: s.lead.firstActionDueAt,
    acceptanceDueAt: s.lead.acceptanceDueAt,
    dueAt: "2030-06-04T10:30:00.000Z",
    revision: s.lead.revision + 1,
  });
  expect(result.events.filter((e) => e.kind === "appointment.scheduled")).toHaveLength(1);
  expect(result.events.filter((e) => e.kind === "appointment.rescheduled.v1")).toHaveLength(1);
  expect(result.events.filter((e) => e.kind === "appointment.cancelled")).toHaveLength(0);
  const after = await creationState(s);
  expect(
    await repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, input, attempt),
  ).toEqual(result);
  expect(await creationState(s)).toEqual(after);
  await expect(
    repository.confirmPersonalRescheduling(
      s.person,
      s.lead.id,
      s.appt.id,
      { ...input, time: { ...input.time, preparationMinutes: 16 } },
      attempt,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  const proof = (
    await database.pool.query<Record<string, unknown>>(
      "select * from partner_appointment_time_plans where appointment_id=$1",
      [s.appt.id],
    )
  ).rows[0];
  expect(proof).toMatchObject({
    revision: 1,
    advisor_id: s.person.userId,
    evidence: {
      previousProtection: { versionId: null },
      leadRevision: s.lead.revision,
      personalConfirmation: { version: 1, clientAgreementConfirmed: true },
      rescheduling: { previous: { location: s.appt.location }, next: movedProposal.appointment },
    },
  });
  expect((await s.assess()).timeProtection?.current).toMatchObject({
    revision: 1,
    rescheduling: { previous: { startsAt: s.appt.startsAt }, next: movedProposal.appointment },
  });
  const notices = (
    await database.pool.query(
      "select recipient_id,audience from partner_notifications where lead_id=$1 and kind='appointment.rescheduled.v1'",
      [s.lead.id],
    )
  ).rows;
  expect(notices).toHaveLength(2);
  expect(notices).toEqual(
    expect.arrayContaining([
      { recipient_id: s.owner.userId, audience: "wallet" },
      { recipient_id: s.person.userId, audience: "partner" },
    ]),
  );
  for (const reader of [admin, s.owner]) {
    const visible = JSON.stringify(await repository.detail(reader, s.lead.id));
    for (const name of ["rescheduling", "personalConfirmation", "preparationMinutes", "versionId"])
      expect(visible).not.toContain(`"${name}"`);
    await expect(repository.appointmentAssessment(reader, s.lead.id, s.appt.id)).rejects.toThrow();
  }
  await expect(
    repository.command(
      s.person,
      s.lead.id,
      {
        action: "appointment_state",
        appointmentId: s.appt.id,
        state: "cancelled",
        note: "Ancienne commande",
        revision: s.lead.revision,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});

it("preserves unrelated next actions and waiting periods during a report", async () => {
  const s = await readyRescheduling();
  await database.pool.query(
    "update partner_leads set next_action='Obtenir le document',due_at='2030-06-04T09:00:00Z',waiting=$2 where id=$1",
    [s.lead.id, JSON.stringify({ reason: "Attente documentée", until: "2030-06-04T09:30:00Z" })],
  );
  const before = await repository.detail(s.person, s.lead.id);
  const result = await repository.confirmPersonalRescheduling(
    s.person,
    s.lead.id,
    s.appt.id,
    await reschedulingInput(s),
    key(),
  );
  expect(result).toMatchObject({
    nextAction: before.nextAction,
    dueAt: before.dueAt,
    waiting: before.waiting,
    stage: before.stage,
    firstUsefulAt: before.firstUsefulAt,
  });
});

it("moves terms and reduced buffers together, keeps old versions and frees only the former occupation", async () => {
  const s = await readyRescheduling();
  await repository.protectAppointmentTime(
    s.person,
    s.lead.id,
    s.appt.id,
    { ...(await timeInput(s)), preparationMinutes: 60 },
    key(),
  );
  const original = (
    await database.pool.query<{ id: string }>(
      "select * from partner_appointment_time_plans where appointment_id=$1",
      [s.appt.id],
    )
  ).rows;
  const other = await scenario(s.person, undefined, null, false);
  await repository.command(
    s.person,
    other.lead.id,
    {
      action: "appointment",
      revision: other.lead.revision,
      appointment: {
        ...proposal.appointment,
        advisorId: s.person.userId,
        startsAt: "2030-06-04T12:00:00Z",
      },
    },
    key(),
  );
  const next = {
    ...movedProposal,
    appointment: { ...movedProposal.appointment, startsAt: "2030-06-04T15:00:00+02:00" },
    time: { preparationMinutes: 0, travelBeforeMinutes: 0, travelAfterMinutes: 0 },
  };
  await repository.confirmPersonalRescheduling(
    s.person,
    s.lead.id,
    s.appt.id,
    await reschedulingInput(s, next),
    key(),
  );
  const history = (
    await database.pool.query<{ evidence: { previousProtection: unknown } }>(
      "select * from partner_appointment_time_plans where appointment_id=$1 order by revision",
      [s.appt.id],
    )
  ).rows;
  expect(history).toHaveLength(2);
  expect(history[0]).toEqual(original[0]);
  expect(history[1]!.evidence.previousProtection).toMatchObject({
    versionId: original[0]!.id,
    occupiedBeforeMinutes: 60,
  });
  const current = await repository.detail(s.person, s.lead.id);
  await expect(
    repository.command(
      s.person,
      s.lead.id,
      {
        action: "appointment",
        revision: current.revision,
        appointment: {
          ...proposal.appointment,
          advisorId: s.person.userId,
          startsAt: "2030-06-04T09:00:00Z",
        },
      },
      key(),
    ),
  ).resolves.toBeDefined();
});

it("requires current personal authority for report and replay, including Admin and suspended sessions", async () => {
  const s = await readyRescheduling(),
    colleague = await professional(),
    input = await reschedulingInput(s);
  for (const reader of [admin, s.owner, colleague]) {
    await expect(
      repository.previewPersonalRescheduling(reader, s.lead.id, s.appt.id, movedProposal),
    ).rejects.toThrow();
    await expect(
      repository.confirmPersonalRescheduling(reader, s.lead.id, s.appt.id, input, key()),
    ).rejects.toThrow();
  }
  const attempt = key();
  await repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, input, attempt);
  await repository.command(
    admin,
    s.lead.id,
    {
      action: "assign",
      revision: s.lead.revision + 1,
      responsibleId: colleague.userId,
      reason: "Transfert réel isolé",
    },
    key(),
  );
  await expect(
    repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, input, attempt),
  ).rejects.toThrow();
  const revoked = await readyRescheduling(),
    pending = await reschedulingInput(revoked);
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    revoked.person.id,
  ]);
  await expect(
    repository.confirmPersonalRescheduling(
      revoked.person,
      revoked.lead.id,
      revoked.appt.id,
      pending,
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});

it("rejects changed sources, old private versions, mismatched terms, elapsed and cancelled commitments", async () => {
  const s = await readyRescheduling(),
    initial = await reschedulingInput(s);
  await declare(s.person, [period("08:00", "16:00")]);
  await expect(
    repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, initial, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const next = await reschedulingInput(s);
  await repository.protectAppointmentTime(
    s.person,
    s.lead.id,
    s.appt.id,
    await timeInput(s),
    key(),
  );
  await expect(
    repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, next, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const current = await reschedulingInput(s);
  await expect(
    repository.confirmPersonalRescheduling(
      s.person,
      s.lead.id,
      s.appt.id,
      { ...current, appointment: { ...current.appointment, location: "Autre connexion" } },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await database.pool.query(
    "update partner_appointments set starts_at=now()-interval '1 hour' where id=$1",
    [s.appt.id],
  );
  expect(
    (await repository.previewPersonalRescheduling(s.person, s.lead.id, s.appt.id, movedProposal))
      .canConfirm,
  ).toBe(false);
  await database.pool.query("update partner_appointments set state='cancelled' where id=$1", [
    s.appt.id,
  ]);
  await expect(
    repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, current, key()),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_TRANSITION" });
});

it("requires new date, full coverage, compatible client wishes and explicit attestations without changing the old commitment", async () => {
  const s = await readyRescheduling();
  for (const proposed of [
    proposal,
    { ...movedProposal, time: { ...movedProposal.time, travelAfterMinutes: 15 } },
  ]) {
    const input = await reschedulingInput(s, proposed),
      before = await creationState(s);
    await expect(
      repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, input, key()),
    ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
    expect(await creationState(s)).toEqual(before);
  }
  await declare(s.person, [period("08:00", "16:00"), period("10:15", "10:30", "absent")]);
  expect(
    (await repository.previewPersonalRescheduling(s.person, s.lead.id, s.appt.id, movedProposal))
      .canConfirm,
  ).toBe(false);
  await declare(s.person, [period("08:00", "10:14"), period("10:16", "16:00")]);
  expect(
    (await repository.previewPersonalRescheduling(s.person, s.lead.id, s.appt.id, movedProposal))
      .assessment.declaration.period,
  ).toBe("unreported");
  await declare(s.person, [period("08:00", "16:00")]);
  await preference(s.owner, s.lead.id, "phone");
  expect(
    (await repository.previewPersonalRescheduling(s.person, s.lead.id, s.appt.id, movedProposal))
      .canConfirm,
  ).toBe(false);
  const input = await reschedulingInput(s);
  expect(() =>
    repository.confirmPersonalRescheduling(
      s.person,
      s.lead.id,
      s.appt.id,
      { ...input, clientAgreementConfirmed: false } as unknown as PersonalAppointmentConfirm,
      key(),
    ),
  ).toThrow();
});

it("serializes two reports on one commitment and two Leads competing for the same protected interval", async () => {
  const s = await readyRescheduling(),
    input = await reschedulingInput(s);
  const same = await Promise.allSettled(
    [1, 2].map(() =>
      repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, input, key()),
    ),
  );
  expect(same.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(same.filter((r) => r.status === "rejected")).toMatchObject([
    { reason: { code: "PARTNER_CONFLICT" } },
  ]);
  const other = await scenario(s.person, undefined, null, false);
  const second = await repository.command(
    s.person,
    other.lead.id,
    {
      action: "appointment",
      revision: other.lead.revision,
      appointment: {
        ...proposal.appointment,
        advisorId: s.person.userId,
        startsAt: "2030-06-04T12:00:00Z",
      },
    },
    key(),
  );
  await preference(other.owner, other.lead.id, "video");
  const otherScenario = { ...other, appt: second.appointments[0]! };
  const target = {
    ...movedProposal,
    appointment: { ...movedProposal.appointment, startsAt: "2030-06-04T14:00:00Z" },
  };
  const a = await reschedulingInput(s, target),
    b = await reschedulingInput(otherScenario, target);
  const race = await Promise.allSettled([
    repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, a, key()),
    repository.confirmPersonalRescheduling(
      s.person,
      other.lead.id,
      otherScenario.appt.id,
      b,
      key(),
    ),
  ]);
  expect(race.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(race.filter((r) => r.status === "rejected")).toMatchObject([
    { reason: { code: "PARTNER_APPOINTMENT_CONFLICT" } },
  ]);
});

it("rolls back the changed commitment, occupation and all side effects if the report proof fails", async () => {
  const s = await readyRescheduling(),
    input = await reschedulingInput(s);
  await database.pool.query(
    `create function reject_report_proof() returns trigger language plpgsql as $$ begin if new.advisor_id='${s.person.userId}' then raise exception 'isolated report proof failure'; end if; return new; end $$`,
  );
  await database.pool.query(
    "create trigger reject_report_proof before insert on partner_appointment_time_plans for each row execute function reject_report_proof()",
  );
  const before = await creationState(s);
  await expect(
    repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, input, key()),
  ).rejects.toThrow("isolated report proof failure");
  expect(await creationState(s)).toEqual(before);
  await database.pool.query("drop trigger reject_report_proof on partner_appointment_time_plans");
  await expect(
    repository.confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, input, key()),
  ).resolves.toBeDefined();
});

it("revalidates a report after a real schedule-lock wait and makes N-1 writers respect its new buffers", async () => {
  const s = await readyRescheduling(),
    other = await scenario(s.person, undefined, null, false);
  const target = {
    ...movedProposal,
    appointment: { ...movedProposal.appointment, startsAt: "2030-06-04T14:00:00Z" },
  };
  const input = await reschedulingInput(s, target),
    blocker = await database.pool.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await blocker.query("begin");
    await blocker.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [s.person.userId]);
    pending = repository
      .confirmPersonalRescheduling(s.person, s.lead.id, s.appt.id, input, key())
      .then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
    let waiting = false;
    for (let i = 0; i < 100; i++) {
      waiting = !!(
        await database.pool.query(
          "select 1 from pg_locks where locktype='advisory' and not granted",
        )
      ).rowCount;
      if (waiting) break;
      await setTimeout(10);
    }
    expect(waiting).toBe(true);
    await blocker.query(
      "insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone) values($1,$2,$3,'2030-06-04T13:30:00Z',30,'video','N-1 isolated','Europe/Zurich')",
      [key(), other.lead.id, s.person.userId],
    );
    await blocker.query("commit");
    expect(await pending).toMatchObject({ error: { code: "PARTNER_APPOINTMENT_CONFLICT" } });
    expect((await repository.detail(s.person, s.lead.id)).appointments[0]).toEqual(s.appt);
  } finally {
    await blocker.query("rollback");
    await pending;
    blocker.release();
  }
  const result = await repository.confirmPersonalRescheduling(
    s.person,
    s.lead.id,
    s.appt.id,
    await reschedulingInput(s),
    key(),
  );
  await expect(
    database.pool.query(
      "insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone) values($1,$2,$3,'2030-06-04T10:00:00Z',30,'video','N-1 isolated','Europe/Zurich')",
      [key(), other.lead.id, s.person.userId],
    ),
  ).rejects.toMatchObject({ code: "23P01", constraint: "partner_protected_time_conflict" });
  expect(result.appointments[0]!.id).toBe(s.appt.id);
});

async function actor(administrator = false): Promise<PartnerActor> {
  const person = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [person.userId, key(), `${key()}@assessment.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    person.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated assessment test',now()+interval '1 hour',now()-interval '1 second')",
    [person.id, person.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated Testcontainers permission')",
      [key(), person.userId],
    );
  return person;
}
async function professional() {
  const person = await actor();
  await repository.apply(person, application, key());
  const member = (await repository.context(person)).application!;
  await repository.review(
    admin,
    person.userId,
    {
      revision: member.revision,
      state: "approved",
      roles: ["advisor"],
      reason: "Décision synthétique",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_assessment_test")
    .start();
  database = createDatabase({
    DATABASE_URL: container.getConnectionUri(),
    DEPENDENCY_TIMEOUT_MS: 10000,
  });
  await migrate(database.db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
  repository = createPartnerRepository(database.pool);
  admin = await actor(true);
});
afterAll(async () => {
  if (database) await database.pool.end();
  if (container) await container.stop();
});
