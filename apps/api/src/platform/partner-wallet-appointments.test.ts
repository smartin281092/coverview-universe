import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  walletAppointmentCancellationSchema,
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
    .withDatabase("coverview_wallet_cancellation_test")
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
async function input(s: Scenario) {
  const current = await repository.walletAppointment(s.owner, s.source.id, s.appt.id);
  return { basis: current.basis, reason: "Indisponible à cette date", confirmed: true as const };
}
async function snapshot(id: string) {
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
async function appointment(s: Scenario) {
  return (
    await database.pool.query<Record<string, unknown>>(
      "select * from partner_appointments where id=$1",
      [s.appt.id],
    )
  ).rows[0]!;
}
async function cancel(s: Scenario) {
  return repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, await input(s), key());
}
async function waitForLock(query: string) {
  for (let i = 0; i < 200; i++) {
    if (
      (
        await database.pool.query(
          "select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like $1",
          [query],
        )
      ).rowCount
    )
      return;
    await setTimeout(10);
  }
  throw new Error("The expected real PostgreSQL lock was not observed");
}

it("cancels atomically, preserves evidence and linked needs, frees occupancy and creates an unresolved response", async () => {
  const s = await setup(true);
  const preview = await repository.previewAppointmentLinks(s.person, s.source.id, s.appt.id, {
    leadIds: [s.target.id, s.other.id],
  });
  await repository.confirmAppointmentLinks(
    s.person,
    s.source.id,
    s.appt.id,
    {
      leadIds: [s.target.id, s.other.id],
      basis: preview.basis,
      clientAgreementConfirmed: true,
      sharedTermsConfirmed: true,
    },
    key(),
  );
  const target = await snapshot(s.target.id),
    other = await snapshot(s.other.id),
    before = await appointment(s);
  const history = await database.pool.query(
    "select * from partner_appointment_time_plans where appointment_id=$1 order by revision",
    [s.appt.id],
  );
  const links = await database.pool.query(
    "select * from partner_appointment_links where appointment_id=$1 order by id",
    [s.appt.id],
  );
  const leadBefore = await repository.detail(s.person, s.source.id);
  const payload = await input(s),
    idempotency = key();
  const saved = await repository.cancelWalletAppointment(
    s.owner,
    s.source.id,
    s.appt.id,
    payload,
    idempotency,
  );
  expect(saved).toMatchObject({
    state: "cancelled",
    canCancel: false,
    appointment: { startsAt: s.appt.startsAt },
  });
  expect(await appointment(s)).toEqual({ ...before, state: "cancelled" });
  expect(
    (
      await database.pool.query(
        "select * from partner_appointment_time_plans where appointment_id=$1 order by revision",
        [s.appt.id],
      )
    ).rows,
  ).toEqual(history.rows);
  expect(
    (
      await database.pool.query(
        "select * from partner_appointment_links where appointment_id=$1 order by id",
        [s.appt.id],
      )
    ).rows,
  ).toEqual(links.rows);
  expect(await snapshot(s.target.id)).toEqual(target);
  expect(await snapshot(s.other.id)).toEqual(other);
  expect((await repository.sharedAppointments(s.owner, s.target.id)).items[0]).toMatchObject({
    status: "linked",
    outcome: "cancelled",
  });
  const after = await repository.detail(s.person, s.source.id);
  expect(after.stage).toBe("appointment_needed");
  expect(after.firstUsefulAt).toBe(leadBefore.firstUsefulAt);
  expect(after.nextAction).toBe("Recontacter le client pour convenir de la suite");
  expect(Date.parse(after.dueAt!)).toBeLessThanOrEqual(Date.now());
  expect((await repository.work(s.person)).appointments.some((a) => a.id === s.appt.id)).toBe(
    false,
  );
  const events = (
    await database.pool.query<{ id: string; text: string }>(
      "select id,text from partner_events where lead_id=$1 and kind='client.appointment_cancelled.v1'",
      [s.source.id],
    )
  ).rows;
  expect(events).toHaveLength(1);
  expect(events[0]!.text).toBe(payload.reason);
  const notification = (
    await database.pool.query<{ id: string; resolved_at: Date | null }>(
      "select id,resolved_at from partner_notifications where dedupe_key=$1",
      [events[0]!.id + ":response"],
    )
  ).rows[0]!;
  expect(notification.resolved_at).toBeNull();
  await repository.readNotification(s.person, notification.id, key());
  expect(
    (
      await database.pool.query<{ resolved_at: Date | null }>(
        "select resolved_at from partner_notifications where id=$1",
        [notification.id],
      )
    ).rows[0]!.resolved_at,
  ).toBeNull();
  expect(
    await repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, idempotency),
  ).toEqual(saved);
  expect(
    (
      await database.pool.query(
        "select id from partner_events where lead_id=$1 and kind='client.appointment_cancelled.v1'",
        [s.source.id],
      )
    ).rowCount,
  ).toBe(1);
  // The old protected interval can now accommodate another commitment for this advisor.
  await database.pool.query(
    `insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone)
    values($1,$2,$3,$4,60,'video','Autre lien','Europe/Zurich')`,
    [key(), s.target.id, s.person.userId, s.appt.startsAt],
  );
  const wallet = JSON.stringify(
    await repository.walletAppointment(s.owner, s.source.id, s.appt.id),
  );
  for (const secret of [
    s.person.userId,
    s.target.id,
    "occupied_before_minutes",
    "profileRevision",
    "termsRevision",
  ])
    expect(wallet).not.toContain(secret);
  await repository.command(
    s.person,
    s.source.id,
    {
      action: "contact",
      revision: after.revision,
      outcome: "reached",
      note: "Suite convenue avec le client",
      nextAction: "Convenir d'une nouvelle date",
      dueAt: "2030-06-05T10:00:00Z",
    },
    key(),
  );
  expect(
    (
      await database.pool.query<{ resolved_at: Date | null }>(
        "select resolved_at from partner_notifications where id=$1",
        [notification.id],
      )
    ).rows[0]!.resolved_at,
  ).not.toBeNull();
});

it("rejects missing confirmations, excess fields, blank and oversized reasons", () => {
  const valid = { basis: "a".repeat(64), reason: "Motif valable", confirmed: true };
  for (const value of [
    { ...valid, confirmed: false },
    { ...valid, reason: " " },
    { ...valid, reason: "x".repeat(1001) },
    { ...valid, advisorId: "injected" },
  ])
    expect(walletAppointmentCancellationSchema.safeParse(value).success).toBe(false);
});

it("restricts cancellation to the current originating Wallet owner, including exact replays", async () => {
  const s = await setup(true),
    stranger = { ...(await actor()), wallet: true },
    payload = await input(s),
    idempotency = key();
  for (const unauthorized of [s.person, admin, stranger]) {
    await expect(
      repository.walletAppointment(unauthorized, s.source.id, s.appt.id),
    ).rejects.toMatchObject({
      code: unauthorized.wallet ? "PARTNER_NOT_FOUND" : "PARTNER_ACCESS_DENIED",
    });
    await expect(
      repository.cancelWalletAppointment(unauthorized, s.source.id, s.appt.id, payload, key()),
    ).rejects.toBeDefined();
  }
  await expect(repository.walletAppointment(s.owner, s.target.id, s.appt.id)).rejects.toMatchObject(
    { code: "PARTNER_NOT_FOUND" },
  );
  await repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, idempotency);
  await expect(
    repository.cancelWalletAppointment(
      s.owner,
      s.source.id,
      s.appt.id,
      { ...payload, reason: "Autre motif" },
      idempotency,
    ),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  await database.pool.query(
    "update managed_profiles set user_id=$2,revision=revision+1 where id=$1",
    [s.profileId, stranger.userId],
  );
  await expect(
    repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, idempotency),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  expect((await repository.walletAppointment(stranger, s.source.id, s.appt.id)).state).toBe(
    "cancelled",
  );
});

it("serializes competing cancellations and keeps one event and one command", async () => {
  const s = await setup(),
    payload = await input(s);
  const results = await Promise.allSettled(
    [1, 2].map(() =>
      repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, key()),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(
    (
      await database.pool.query(
        "select id from partner_commands where target_id=$1 and operation='wallet.appointment.cancel'",
        [s.appt.id],
      )
    ).rowCount,
  ).toBe(1);
});

it("preserves custom follow-up, waiting, useful action and stage while another future appointment exists", async () => {
  const s = await setup();
  const due = new Date("2030-06-03T10:00:00Z");
  await database.pool.query(
    "update partner_leads set next_action='Action personnalisée',due_at=$2,waiting=$3 where id=$1",
    [
      s.source.id,
      due,
      JSON.stringify({ reason: "Attente conservée", until: "2030-06-02T10:00:00Z" }),
    ],
  );
  await database.pool.query(
    `insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone)
    values($1,$2,$3,'2030-06-04T13:00:00Z',60,'video','Second lien','Europe/Zurich')`,
    [key(), s.source.id, s.person.userId],
  );
  const before = await repository.detail(s.person, s.source.id);
  await cancel(s);
  const after = await repository.detail(s.person, s.source.id);
  expect(after).toMatchObject({
    stage: before.stage,
    nextAction: before.nextAction,
    dueAt: before.dueAt,
    waiting: before.waiting,
    firstUsefulAt: before.firstUsefulAt,
    tasks: before.tasks,
  });
});

it("invalidates a preview after a report and return to identical terms, or a subject relink", async () => {
  const s = await setup(),
    payload = await input(s);
  await database.pool.query(
    "update partner_appointments set starts_at=starts_at+interval '2 hours' where id=$1",
    [s.appt.id],
  );
  await database.pool.query(
    "update partner_appointments set starts_at=starts_at-interval '2 hours' where id=$1",
    [s.appt.id],
  );
  await expect(
    repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const fresh = await input(s),
    other = await actor();
  await database.pool.query("update partner_leads set client_user_id=$2 where id=$1", [
    s.source.id,
    other.userId,
  ]);
  await database.pool.query("update partner_leads set client_user_id=$2 where id=$1", [
    s.source.id,
    s.owner.userId,
  ]);
  await expect(
    repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, fresh, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect((await appointment(s)).state).toBe("scheduled");
});

it("rereads ownership after waiting on the canonical profile row", async () => {
  const s = await setup(true),
    payload = await input(s),
    other = await actor(),
    blocker = await database.pool.connect();
  try {
    await blocker.query("begin");
    await blocker.query("select id from managed_profiles where id=$1 for update", [s.profileId]);
    const assertion = expect(
      repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, key()),
    ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
    await waitForLock("select id from managed_profiles where id=%");
    await blocker.query("update managed_profiles set user_id=$2,revision=revision+1 where id=$1", [
      s.profileId,
      other.userId,
    ]);
    await blocker.query("commit");
    await assertion;
    expect((await appointment(s)).state).toBe("scheduled");
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
});

it("checks session expiration after a real Lead lock wait", async () => {
  const s = await setup(),
    payload = await input(s),
    blocker = await database.pool.connect();
  await database.pool.query(
    "update identity_sessions set expires_at=clock_timestamp()+interval '1200 milliseconds' where id=$1",
    [s.owner.id],
  );
  try {
    await blocker.query("begin");
    await blocker.query("select id from partner_leads where id=$1 for update", [s.source.id]);
    const assertion = expect(
      repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, key()),
    ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
    await waitForLock("select id from partner_leads where id=%");
    await setTimeout(1300);
    await blocker.query("commit");
    await assertion;
    expect((await appointment(s)).state).toBe("scheduled");
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
});

it("rejects cancellation when appointment start elapses during the planning lock wait", async () => {
  const s = await setup(),
    blocker = await database.pool.connect();
  await database.pool.query(
    "update partner_appointments set starts_at=clock_timestamp()+interval '1500 milliseconds' where id=$1",
    [s.appt.id],
  );
  const payload = await input(s);
  try {
    await blocker.query("begin");
    await blocker.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [s.person.userId]);
    const assertion = expect(
      repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, key()),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
    await waitForLock("select pg_advisory_xact_lock%");
    await setTimeout(1600);
    await blocker.query("commit");
    await assertion;
    expect((await appointment(s)).state).toBe("scheduled");
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
});

it("rejects a stale preview after rescheduling wins a real row lock race", async () => {
  const s = await setup(),
    payload = await input(s),
    blocker = await database.pool.connect();
  try {
    await blocker.query("begin");
    await blocker.query("select id from partner_leads where id=$1 for update", [s.source.id]);
    const assertion = expect(
      repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, key()),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
    await waitForLock("select id from partner_leads where id=%");
    await blocker.query(
      "update partner_appointments set starts_at=starts_at+interval '2 hours' where id=$1",
      [s.appt.id],
    );
    await blocker.query("commit");
    await assertion;
    expect((await appointment(s)).state).toBe("scheduled");
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
});

it.each(["appointment.wallet_cancellation_recorded.v1", "client.appointment_cancelled.v1"])(
  "rolls back cancellation, follow-up and command if %s cannot be written",
  async (kind) => {
    const s = await setup(),
      payload = await input(s),
      before = await snapshot(s.source.id),
      appt = await appointment(s),
      idempotency = key();
    await database.pool.query(
      `create function isolated_cancel_failure() returns trigger language plpgsql as $$ begin raise exception 'isolated cancellation audit failure'; end $$`,
    );
    await database.pool.query(
      `create trigger isolated_cancel_failure before insert on partner_events for each row when (NEW.kind='${kind}') execute function isolated_cancel_failure()`,
    );
    try {
      await expect(
        repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, idempotency),
      ).rejects.toThrow("isolated cancellation audit failure");
      expect(await snapshot(s.source.id)).toEqual(before);
      expect(await appointment(s)).toEqual(appt);
      expect(
        (
          await database.pool.query("select id from partner_commands where user_id=$1 and key=$2", [
            s.owner.userId,
            idempotency,
          ])
        ).rowCount,
      ).toBe(0);
    } finally {
      await database.pool.query("drop trigger isolated_cancel_failure on partner_events");
      await database.pool.query("drop function isolated_cancel_failure()");
    }
  },
);

it("blocks closed needs and past or already settled appointments", async () => {
  const s = await setup(),
    payload = await input(s);
  await database.pool.query(
    "update partner_leads set stage='completed',result='abandoned',reason='other',next_action='',due_at=null where id=$1",
    [s.source.id],
  );
  expect((await repository.walletAppointment(s.owner, s.source.id, s.appt.id)).canCancel).toBe(
    false,
  );
  await expect(
    repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await database.pool.query(
    "update partner_leads set stage='appointment_scheduled',result=null,reason=null where id=$1",
    [s.source.id],
  );
  for (const state of ["completed", "cancelled", "client_absent", "advisor_absent"]) {
    await database.pool.query("update partner_appointments set state=$2 where id=$1", [
      s.appt.id,
      state,
    ]);
    expect((await repository.walletAppointment(s.owner, s.source.id, s.appt.id)).canCancel).toBe(
      false,
    );
  }
  await database.pool.query(
    "update partner_appointments set state='scheduled',starts_at=clock_timestamp()-interval '1 second' where id=$1",
    [s.appt.id],
  );
  expect((await repository.walletAppointment(s.owner, s.source.id, s.appt.id)).canCancel).toBe(
    false,
  );
  await expect(cancel(s)).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});

it("notifies the distinct authorized advisor, and routes an unassigned response to CoverView", async () => {
  const s = await setup(),
    responsible = await professional();
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,can_edit,can_contact) values($1,$2,$3,true,true)",
    [key(), s.source.id, s.person.userId],
  );
  await database.pool.query("update partner_leads set responsible_id=$2 where id=$1", [
    s.source.id,
    responsible.userId,
  ]);
  await cancel(s);
  const notifications = (
    await database.pool.query<{ recipient_id: string; kind: string; action: string | null }>(
      "select recipient_id,kind,action from partner_notifications where lead_id=$1 and (kind='client_response' or kind='client.appointment_cancelled.v1')",
      [s.source.id],
    )
  ).rows;
  expect(notifications).toContainEqual({
    recipient_id: responsible.userId,
    kind: "client_response",
    action: "review_response",
  });
  expect(notifications).toContainEqual({
    recipient_id: s.person.userId,
    kind: "client.appointment_cancelled.v1",
    action: null,
  });
  const free = await setup();
  await database.pool.query(
    "update partner_leads set responsible_id=null,assignment='coverview' where id=$1",
    [free.source.id],
  );
  await cancel(free);
  expect(
    (
      await database.pool.query(
        "select audience,recipient_id from partner_notifications where lead_id=$1 and kind='client_response'",
        [free.source.id],
      )
    ).rows,
  ).toEqual([{ audience: "coverview", recipient_id: null }]);
});

it("rolls back all writes if notification persistence fails", async () => {
  const s = await setup(),
    payload = await input(s),
    before = await snapshot(s.source.id),
    appt = await appointment(s),
    idempotency = key();
  await database.pool.query(
    "create function isolated_notification_failure() returns trigger language plpgsql as $$ begin raise exception 'isolated notification failure'; end $$",
  );
  await database.pool.query(
    "create trigger isolated_notification_failure before insert on partner_notifications for each row when (NEW.kind='client_response') execute function isolated_notification_failure()",
  );
  try {
    await expect(
      repository.cancelWalletAppointment(s.owner, s.source.id, s.appt.id, payload, idempotency),
    ).rejects.toThrow("isolated notification failure");
    expect(await snapshot(s.source.id)).toEqual(before);
    expect(await appointment(s)).toEqual(appt);
    expect(
      (
        await database.pool.query(
          "select id from partner_events where subject_id=$1 and kind in ('appointment.wallet_cancellation_recorded.v1','client.appointment_cancelled.v1')",
          [s.appt.id],
        )
      ).rowCount,
    ).toBe(0);
    expect(
      (await database.pool.query("select id from partner_commands where key=$1", [idempotency]))
        .rowCount,
    ).toBe(0);
  } finally {
    await database.pool.query(
      "drop trigger isolated_notification_failure on partner_notifications",
    );
    await database.pool.query("drop function isolated_notification_failure()");
  }
});
