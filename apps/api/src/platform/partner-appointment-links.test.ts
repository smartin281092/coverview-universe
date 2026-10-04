import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  appointmentLinksConfirmSchema,
  type AppointmentLinksConfirm,
} from "@coverview/contracts/partner";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";
let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
async function actor(administrator = false): Promise<PartnerActor> {
  const value = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [value.userId, key(), `${key()}@assessment.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated assessment',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), createHash("sha256").update(key()).digest("hex")],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function professional() {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name: "Conseiller isolé",
      organization: "Organisation isolée",
      phone: "",
      roles: ["advisor"],
      categories: ["vehicle"],
      languages: "fr",
      regions: "GE",
      qualifications: "Test",
    }),
    key(),
  );
  const member = (await repository.context(person)).application!;
  await repository.review(
    admin,
    person.userId,
    {
      revision: member.revision,
      state: "approved",
      roles: ["advisor"],
      reason: "Test isolé",
      reviewDueAt: null,
      organizationState: "approved",
    },
    key(),
  );
  return person;
}
async function assigned(
  owner: PartnerActor,
  advisor: PartnerActor,
  profileId: string | null = null,
) {
  let lead = await repository.create(
    owner,
    leadCreateInputSchema.parse({
      title: "Conseil isolé véhicule",
      category: "vehicle",
      object: "Voiture",
      context: "Besoin isolé",
      clientUserId: owner.userId,
      clientProfileId: profileId,
      clientName: "Personne isolée",
      email: "client@assessment.test",
      phone: "",
      language: "fr",
      source: "Test",
      transmissionAuthorized: true,
      priority: "normal",
      draft: false,
      nextAction: "Qualifier",
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
      responsibleId: advisor.userId,
      reason: "Test isolé",
    },
    key(),
  );
  return repository.command(advisor, lead.id, { action: "accept", revision: lead.revision }, key());
}
beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_appointment_links_test")
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

async function preference(owner: PartnerActor, id: string, mode: "video" | "phone" = "video") {
  const previous = await repository.advicePreferences(owner, id);
  await repository.confirmAdvicePreferences(
    owner,
    id,
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
async function setup(withProfile = false) {
  const person = await professional(),
    owner = { ...(await actor()), wallet: true };
  const profileId = withProfile ? `profile_${key()}` : null;
  if (profileId)
    await database.pool.query(
      "insert into managed_profiles(id,user_id,display_name,kind) values($1,$2,'Sujet isolé','person')",
      [profileId, owner.userId],
    );
  let source = await assigned(owner, person, profileId);
  const target = await assigned(owner, person, profileId),
    other = await assigned(owner, person, profileId);
  for (const lead of [source, target, other]) await preference(owner, lead.id);
  const availability = await repository.availability(person, person.userId);
  await repository.declareAvailability(
    person,
    person.userId,
    {
      revision: availability.current?.revision ?? 0,
      professionalRevision: availability.professionalRevision,
      modes: ["video", "phone"],
      periods: [
        { kind: "available", startsAt: "2030-06-04T08:00:00Z", endsAt: "2030-06-04T18:00:00Z" },
      ],
      timezone: "Europe/Zurich",
      confirmed: true,
    },
    key(),
  );
  source = await repository.command(
    person,
    source.id,
    {
      action: "appointment",
      revision: source.revision,
      appointment: {
        advisorId: person.userId,
        startsAt: "2030-06-04T10:00:00Z",
        durationMinutes: 60,
        mode: "video",
        location: "Lien isolé",
        timezone: "Europe/Zurich",
      },
    },
    key(),
  );
  const appt = source.appointments[0]!;
  const assessment = await repository.appointmentAssessment(person, source.id, appt.id);
  await repository.protectAppointmentTime(
    person,
    source.id,
    appt.id,
    {
      basis: assessment.timeProtection!.basis,
      preparationMinutes: 15,
      travelBeforeMinutes: 0,
      travelAfterMinutes: 0,
      confirmed: true,
    },
    key(),
  );
  return { person, owner, source, target, other, appt, profileId };
}
type Scenario = Awaited<ReturnType<typeof setup>>;
it("rolls back the entire batch when the private audit cannot be persisted", async () => {
  const s = await setup(),
    payload = await input(s, [s.target.id, s.other.id]),
    idempotency = key(),
    before = await cycle(s.source.id);
  await database.pool
    .query(`create function isolated_link_audit_failure() returns trigger language plpgsql as $$
    begin raise exception 'isolated link audit failure'; end $$`);
  await database.pool
    .query(`create trigger isolated_link_audit_failure before insert on partner_events
    for each row when (NEW.kind='appointment.linked.v1') execute function isolated_link_audit_failure()`);
  try {
    await expect(
      repository.confirmAppointmentLinks(s.person, s.source.id, s.appt.id, payload, idempotency),
    ).rejects.toThrow("isolated link audit failure");
    expect(await linkedRows(s)).toHaveLength(0);
    expect(
      (
        await database.pool.query("select id from partner_commands where user_id=$1 and key=$2", [
          s.person.userId,
          idempotency,
        ])
      ).rowCount,
    ).toBe(0);
    expect(await cycle(s.source.id)).toEqual(before);
  } finally {
    await database.pool.query("drop trigger isolated_link_audit_failure on partner_events");
    await database.pool.query("drop function isolated_link_audit_failure()");
  }
});
async function input(s: Scenario, leadIds = [s.target.id]): Promise<AppointmentLinksConfirm> {
  const preview = await repository.previewAppointmentLinks(s.person, s.source.id, s.appt.id, {
    leadIds,
  });
  expect(preview.canConfirm).toBe(true);
  return {
    ...{ leadIds },
    basis: preview.basis,
    clientAgreementConfirmed: true,
    sharedTermsConfirmed: true,
  };
}
async function link(s: Scenario, leadIds = [s.target.id]) {
  return repository.confirmAppointmentLinks(
    s.person,
    s.source.id,
    s.appt.id,
    await input(s, leadIds),
    key(),
  );
}
async function linkedRows(s: Scenario) {
  return (
    await database.pool.query<Record<string, unknown>>(
      "select * from partner_appointment_links where appointment_id=$1 order by lead_id,revision",
      [s.appt.id],
    )
  ).rows;
}
async function cycle(id: string) {
  return (
    await database.pool.query<Record<string, unknown>>(
      `select to_jsonb(l) lead,
    (select jsonb_agg(to_jsonb(t) order by t.id) from partner_tasks t where t.lead_id=l.id) tasks,
    (select jsonb_agg(to_jsonb(o) order by o.id) from partner_offers o where o.lead_id=l.id) offers,
    (select jsonb_agg(to_jsonb(n) order by n.id) from partner_notifications n where n.lead_id=l.id) notifications
    from partner_leads l where l.id=$1`,
      [id],
    )
  ).rows[0];
}

it("links two same-category needs atomically with one occupancy and entirely independent cycles", async () => {
  const s = await setup(),
    before = await cycle(s.target.id),
    beforeOther = await cycle(s.other.id),
    beforeSource = await cycle(s.source.id);
  const payload = await input(s, [s.target.id, s.other.id]),
    idempotency = key();
  const saved = await repository.confirmAppointmentLinks(
    s.person,
    s.source.id,
    s.appt.id,
    payload,
    idempotency,
  );
  expect(saved.candidates.filter((r) => r.status === "linked")).toHaveLength(2);
  await repository.confirmAppointmentLinks(s.person, s.source.id, s.appt.id, payload, idempotency);
  expect(await linkedRows(s)).toHaveLength(2);
  expect(await cycle(s.target.id)).toEqual(before);
  expect(await cycle(s.other.id)).toEqual(beforeOther);
  expect(await cycle(s.source.id)).toEqual(beforeSource);
  const work = await repository.work(s.person);
  expect(work.appointments.filter((a) => a.id === s.appt.id)).toHaveLength(1);
  expect((await repository.detail(s.person, s.target.id)).appointments).toHaveLength(0);
  const wallet = await repository.sharedAppointments(s.owner, s.target.id);
  expect(wallet.items).toHaveLength(1);
  expect(wallet.items[0]).toMatchObject({
    status: "linked",
    outcome: "scheduled",
    appointment: { location: "Lien isolé" },
  });
  const serialized = JSON.stringify(wallet);
  for (const privateValue of [
    s.source.id,
    s.other.id,
    s.person.userId,
    "preparationMinutes",
    "sourceBasis",
    "leadIds",
    "occupied_before_minutes",
  ])
    expect(serialized).not.toContain(privateValue);
  expect(await repository.sharedAppointments(s.person, s.target.id)).toEqual(wallet);
  await expect(
    repository.confirmAppointmentLinks(
      s.person,
      s.source.id,
      s.appt.id,
      { ...payload, leadIds: [s.target.id] },
      idempotency,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
});

it("rejects foreign subjects, unauthorized targets, missing attestations and all-or-nothing stale batches", async () => {
  const s = await setup(),
    stranger = { ...(await actor()), wallet: true },
    foreign = await assigned(stranger, s.person);
  await expect(
    repository.previewAppointmentLinks(s.person, s.source.id, s.appt.id, {
      leadIds: [s.target.id, foreign.id],
    }),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_CLIENT" });
  const payload = await input(s, [s.target.id, s.other.id]);
  expect(
    appointmentLinksConfirmSchema.safeParse({ ...payload, sharedTermsConfirmed: false }).success,
  ).toBe(false);
  expect(
    appointmentLinksConfirmSchema.safeParse({ ...payload, leadIds: [s.target.id, s.target.id] })
      .success,
  ).toBe(false);
  await preference(s.owner, s.other.id, "phone");
  await expect(
    repository.confirmAppointmentLinks(s.person, s.source.id, s.appt.id, payload, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(await linkedRows(s)).toHaveLength(0);
  expect(
    (
      await repository.previewAppointmentLinks(s.person, s.source.id, s.appt.id, {
        leadIds: [s.other.id],
      })
    ).canConfirm,
  ).toBe(false);
  await expect(repository.sharedAppointments(stranger, s.target.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.appointmentLinks(admin, s.source.id, s.appt.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(repository.appointmentLinks(s.owner, s.source.id, s.appt.id)).rejects.toMatchObject({
    code: "PARTNER_ACCESS_DENIED",
  });
});

it("unlinks with conserved immutable evidence, then reconfirms as another version", async () => {
  const s = await setup();
  await link(s);
  const before = await cycle(s.target.id),
    first = (await linkedRows(s))[0]!;
  const request = { leadId: s.target.id, revision: 1, confirmed: true as const },
    idempotency = key();
  await repository.unlinkAppointment(s.person, s.source.id, s.appt.id, request, idempotency);
  await repository.unlinkAppointment(s.person, s.source.id, s.appt.id, request, idempotency);
  expect((await repository.sharedAppointments(s.owner, s.target.id)).items[0]?.status).toBe(
    "unlinked",
  );
  await link(s);
  expect((await linkedRows(s)).map((r) => r.action)).toEqual(["linked", "unlinked", "linked"]);
  expect((await linkedRows(s))[0]).toEqual(first);
  expect(await cycle(s.target.id)).toEqual(before);
  await expect(
    database.pool.query("update partner_appointment_links set terms='{}' where id=$1", [first.id]),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    database.pool.query("delete from partner_appointment_links where id=$1", [first.id]),
  ).rejects.toMatchObject({ code: "23514" });
});

it("does not silently carry agreement over a real reschedule or a return to the old terms", async () => {
  const s = await setup();
  await link(s);
  const before = await cycle(s.target.id);
  async function move(startsAt: string) {
    const proposal = {
      appointment: {
        startsAt,
        durationMinutes: 60,
        mode: "video" as const,
        location: "Lien isolé",
        timezone: "Europe/Zurich" as const,
      },
      time: { preparationMinutes: 15, travelBeforeMinutes: 0, travelAfterMinutes: 0 },
    };
    const preview = await repository.previewPersonalRescheduling(
      s.person,
      s.source.id,
      s.appt.id,
      proposal,
    );
    expect(preview.canConfirm).toBe(true);
    await repository.confirmPersonalRescheduling(
      s.person,
      s.source.id,
      s.appt.id,
      {
        ...proposal,
        basis: preview.basis,
        clientAgreementConfirmed: true,
        externalCommitmentsChecked: true,
        capacityConfirmed: true,
        preparationAndTravelChecked: true,
      },
      key(),
    );
  }
  await move("2030-06-04T12:00:00Z");
  expect((await repository.sharedAppointments(s.owner, s.target.id)).items[0]).toMatchObject({
    status: "review_required",
    outcome: null,
    appointment: { startsAt: s.appt.startsAt },
  });
  await move(s.appt.startsAt);
  expect((await repository.sharedAppointments(s.owner, s.target.id)).items[0]?.status).toBe(
    "review_required",
  );
  await link(s);
  expect((await repository.sharedAppointments(s.owner, s.target.id)).items[0]?.status).toBe(
    "linked",
  );
  expect(await cycle(s.target.id)).toEqual(before);
});

it("keeps cancellation an outcome of the single appointment without changing linked follow-up", async () => {
  const s = await setup();
  await link(s);
  const before = await cycle(s.target.id);
  const current = await repository.detail(s.person, s.source.id);
  await repository.command(
    s.person,
    s.source.id,
    {
      action: "appointment_state",
      revision: current.revision,
      appointmentId: s.appt.id,
      state: "cancelled",
      note: "Annulation isolée",
    },
    key(),
  );
  expect((await repository.sharedAppointments(s.owner, s.target.id)).items[0]).toMatchObject({
    status: "linked",
    outcome: "cancelled",
  });
  expect(await cycle(s.target.id)).toEqual(before);
});

it("serializes concurrent confirmations and prevents a lost mandate from reviving", async () => {
  const s = await setup(),
    payload = await input(s);
  const outcomes = await Promise.allSettled(
    [key(), key()].map((k) =>
      repository.confirmAppointmentLinks(s.person, s.source.id, s.appt.id, payload, k),
    ),
  );
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await linkedRows(s)).toHaveLength(1);
  await database.pool.query("update partner_members set state='suspended' where user_id=$1", [
    s.person.userId,
  ]);
  await database.pool.query("update partner_members set state='approved' where user_id=$1", [
    s.person.userId,
  ]);
  expect((await repository.sharedAppointments(s.owner, s.target.id)).items[0]?.status).toBe(
    "review_required",
  );
  await expect(
    database.pool.query(
      "update partner_appointment_links set invalidated_at=null where appointment_id=$1",
      [s.appt.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
});

it("rechecks the canonical subject after a real blocked Lead lock, with no partial write", async () => {
  const s = await setup(),
    payload = await input(s, [s.target.id, s.other.id]),
    outsider = await actor();
  const blocker = await database.pool.connect();
  try {
    await blocker.query("begin");
    await blocker.query("select id from partner_leads where id=$1 for update", [s.target.id]);
    const pending = repository.confirmAppointmentLinks(
      s.person,
      s.source.id,
      s.appt.id,
      payload,
      key(),
    );
    const assertion = expect(pending).rejects.toMatchObject({ code: "PARTNER_INVALID_CLIENT" });
    let waited = false;
    for (let i = 0; i < 100; i++) {
      const result = await database.pool.query(
        "select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'select id from partner_leads where id=any%'",
      );
      if (result.rowCount) {
        waited = true;
        break;
      }
      await setTimeout(10);
    }
    expect(waited).toBe(true);
    await blocker.query("update partner_leads set client_user_id=$2 where id=$1", [
      s.target.id,
      outsider.userId,
    ]);
    await blocker.query("commit");
    await assertion;
    expect(await linkedRows(s)).toHaveLength(0);
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
});

it("reauthorizes even an exact successful replay and preserves the other need after target closure", async () => {
  const s = await setup(),
    payload = await input(s, [s.target.id, s.other.id]),
    idempotency = key();
  await repository.confirmAppointmentLinks(s.person, s.source.id, s.appt.id, payload, idempotency);
  const otherBefore = await cycle(s.other.id),
    sourceBefore = await cycle(s.source.id);
  const target = await repository.detail(s.person, s.target.id);
  await repository.command(
    s.person,
    s.target.id,
    {
      action: "close",
      revision: target.revision,
      result: "abandoned",
      reason: "other",
      comment: "Test isolé",
    },
    key(),
  );
  expect((await repository.sharedAppointments(s.owner, s.target.id)).items[0]?.status).toBe(
    "review_required",
  );
  expect((await repository.sharedAppointments(s.owner, s.other.id)).items[0]?.status).toBe(
    "linked",
  );
  expect(await cycle(s.other.id)).toEqual(otherBefore);
  expect(await cycle(s.source.id)).toEqual(sourceBefore);
  await expect(
    repository.confirmAppointmentLinks(s.person, s.source.id, s.appt.id, payload, idempotency),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  expect(await linkedRows(s)).toHaveLength(2);
});

it("does not expose another canonical profile under the same Wallet owner", async () => {
  const s = await setup(),
    profileId = `profile_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,display_name,kind) values($1,$2,'Autre profil','person')",
    [profileId, s.owner.userId],
  );
  const child = await assigned(s.owner, s.person, profileId);
  await expect(
    repository.previewAppointmentLinks(s.person, s.source.id, s.appt.id, { leadIds: [child.id] }),
  ).rejects.toMatchObject({ code: "PARTNER_INVALID_CLIENT" });
  await link(s);
  expect((await repository.sharedAppointments(s.owner, child.id)).items).toHaveLength(0);
  const original = s.owner.userId,
    next = await actor();
  await database.pool.query("update partner_leads set client_user_id=$2 where id=$1", [
    s.target.id,
    next.userId,
  ]);
  expect(
    (await repository.sharedAppointments({ ...next, wallet: true }, s.target.id)).items,
  ).toHaveLength(0);
  await expect(repository.sharedAppointments(s.owner, s.target.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await database.pool.query("update partner_leads set client_user_id=$2 where id=$1", [
    s.target.id,
    original,
  ]);
  expect((await repository.sharedAppointments(s.owner, s.target.id)).items[0]?.status).toBe(
    "review_required",
  );
});

it("requires an editable contactable advice contribution and cannot revive it after revocation", async () => {
  const s = await setup(),
    colleague = await professional();
  const target = await assigned(s.owner, colleague);
  await preference(s.owner, target.id);
  const contribution = key();
  await database.pool.query(
    `insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact)
    values($1,$2,$3,'advice',true,false)`,
    [contribution, target.id, s.person.userId],
  );
  await expect(
    repository.previewAppointmentLinks(s.person, s.source.id, s.appt.id, { leadIds: [target.id] }),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await database.pool.query("update partner_contributors set can_contact=true where id=$1", [
    contribution,
  ]);
  await link(s, [target.id]);
  await database.pool.query("update partner_contributors set revoked_at=now() where id=$1", [
    contribution,
  ]);
  await database.pool.query("update partner_contributors set revoked_at=null where id=$1", [
    contribution,
  ]);
  expect((await repository.sharedAppointments(s.owner, target.id)).items[0]?.status).toBe(
    "review_required",
  );
  await link(s, [target.id]);
  const dossier = await repository.sharedAppointments(s.owner, target.id);
  expect(dossier.items[0]?.status).toBe("linked");
  expect(dossier.history.map((r) => r.status)).toEqual(["linked", "superseded"]);
});

it("checks actual session expiration after a Lead lock wait before writing evidence", async () => {
  const s = await setup(),
    payload = await input(s),
    blocker = await database.pool.connect();
  try {
    await blocker.query("begin");
    await blocker.query("select id from partner_leads where id=$1 for update", [s.target.id]);
    await database.pool.query(
      "update identity_sessions set expires_at=clock_timestamp()+interval '600 milliseconds' where id=$1",
      [s.person.id],
    );
    const assertion = expect(
      repository.confirmAppointmentLinks(s.person, s.source.id, s.appt.id, payload, key()),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
    let waited = false;
    for (let i = 0; i < 100; i++) {
      const result = await database.pool.query(
        "select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'select id from partner_leads where id=any%'",
      );
      if (result.rowCount) {
        waited = true;
        break;
      }
      await setTimeout(10);
    }
    expect(waited).toBe(true);
    await setTimeout(650);
    await blocker.query("commit");
    await assertion;
    expect(await linkedRows(s)).toHaveLength(0);
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
});

it("caps current links at nine, frees an inapplicable link and retains the SQL occupancy exclusion", async () => {
  const s = await setup(),
    targets = [s.target, s.other];
  for (let i = 0; i < 7; i++) {
    const next = await assigned(s.owner, s.person);
    await preference(s.owner, next.id);
    targets.push(next);
  }
  await link(
    s,
    targets.map((t) => t.id),
  );
  const extra = await assigned(s.owner, s.person);
  await preference(s.owner, extra.id);
  let preview = await repository.previewAppointmentLinks(s.person, s.source.id, s.appt.id, {
    leadIds: [extra.id],
  });
  expect(preview.canConfirm).toBe(false);
  const current = await repository.detail(s.person, s.target.id);
  await repository.command(
    s.person,
    s.target.id,
    {
      action: "close",
      revision: current.revision,
      result: "abandoned",
      reason: "other",
      comment: "Test isolé",
    },
    key(),
  );
  preview = await repository.previewAppointmentLinks(s.person, s.source.id, s.appt.id, {
    leadIds: [extra.id],
  });
  expect(preview.canConfirm).toBe(true);
  await link(s, [extra.id]);
  await expect(
    database.pool.query(
      `insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone)
    values($1,$2,$3,'2030-06-04T09:50:00Z',15,'video','Collision isolée','Europe/Zurich')`,
      [key(), extra.id, s.person.userId],
    ),
  ).rejects.toMatchObject({ code: "23P01", constraint: "partner_protected_time_conflict" });
  expect(
    (await repository.work(s.person)).appointments.filter((a) => a.id === s.appt.id),
  ).toHaveLength(1);
});

it("never returns the former owner's terms after waiting for a canonical profile transfer", async () => {
  const s = await setup(true);
  await link(s);
  const next = await actor(),
    blocker = await database.pool.connect();
  try {
    await blocker.query("begin");
    await blocker.query("select id from managed_profiles where id=$1 for update", [s.profileId]);
    const assertion = expect(
      repository.sharedAppointments(s.owner, s.target.id),
    ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
    let waited = false;
    for (let i = 0; i < 100; i++) {
      const result = await database.pool.query(
        "select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'select id from managed_profiles where id=%'",
      );
      if (result.rowCount) {
        waited = true;
        break;
      }
      await setTimeout(10);
    }
    expect(waited).toBe(true);
    await blocker.query("update managed_profiles set user_id=$2,revision=revision+1 where id=$1", [
      s.profileId,
      next.userId,
    ]);
    await blocker.query("commit");
    await assertion;
    expect(
      (await repository.sharedAppointments({ ...next, wallet: true }, s.target.id)).items,
    ).toHaveLength(0);
    expect(await linkedRows(s)).toHaveLength(1);
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
});

it.each(["professional", "mfa"] as const)(
  "rechecks %s wall-clock validity after a real wait even for a personally assigned administrator",
  async (kind) => {
    const s = await setup();
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), s.person.userId],
    );
    s.person = { ...s.person, administrator: true };
    const payload = await input(s),
      blocker = await database.pool.connect();
    try {
      await blocker.query("begin");
      await blocker.query("select id from partner_leads where id=$1 for update", [s.target.id]);
      if (kind === "professional")
        await database.pool.query(
          "update partner_members set review_due_at=clock_timestamp()+interval '600 milliseconds' where user_id=$1",
          [s.person.userId],
        );
      else
        await database.pool.query(
          "update identity_sessions set mfa_verified_at=clock_timestamp()-interval '24 hours'+interval '600 milliseconds' where id=$1",
          [s.person.id],
        );
      const assertion = expect(
        repository.confirmAppointmentLinks(s.person, s.source.id, s.appt.id, payload, key()),
      ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
      let waited = false;
      for (let i = 0; i < 100; i++) {
        const result = await database.pool.query(
          "select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like 'select id from partner_leads where id=any%'",
        );
        if (result.rowCount) {
          waited = true;
          break;
        }
        await setTimeout(10);
      }
      expect(waited).toBe(true);
      await setTimeout(650);
      await blocker.query("commit");
      await assertion;
      expect(await linkedRows(s)).toHaveLength(0);
    } finally {
      await blocker.query("rollback");
      blocker.release();
    }
  },
);
