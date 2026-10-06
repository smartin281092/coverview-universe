import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  personalAppointmentConfirmSchema,
  leadCategorySchema,
} from "@coverview/contracts/partner";
import type { z } from "zod";
import { createDatabase } from "./db/database.js";
import { createPartnerRepository } from "../modules/partner-workspace/partner.repository.js";
import type { PartnerActor } from "../modules/partner-workspace/partner.policy.js";

let container: StartedPostgreSqlContainer;
let database: ReturnType<typeof createDatabase>;
let repository: ReturnType<typeof createPartnerRepository>;
let admin: PartnerActor;
const key = () => randomUUID();
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
type LeadCategory = z.infer<typeof leadCategorySchema>;
const day = "2030-06-04";
const at = (time: string) => `${day}T${time}:00.000Z`;

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18-alpine")
    .withDatabase("coverview_joint_appointments_test")
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

async function actor(administrator = false): Promise<PartnerActor> {
  const value = { userId: `user_${key()}`, id: `session_${key()}`, administrator };
  await database.pool.query(
    "insert into identity_users(id,workos_user_id,email) values($1,$2,$3)",
    [value.userId, key(), `${key()}@joint.test`],
  );
  await database.pool.query("insert into identity_profiles(id,user_id) values($1,$2)", [
    key(),
    value.userId,
  ]);
  await database.pool.query(
    "insert into identity_sessions(id,user_id,workos_session_id,token_hash,device,expires_at,mfa_verified_at) values($1,$2,$3,$4,'Isolated joint',now()+interval '1 hour',now()-interval '1 second')",
    [value.id, value.userId, key(), sha256(key())],
  );
  if (administrator)
    await database.pool.query(
      "insert into identity_admin_permissions(id,user_id,permission,evidence) values($1,$2,'administration.access','Isolated test')",
      [key(), value.userId],
    );
  return value;
}
async function professional(name: string, category: LeadCategory, available = true) {
  const person = await actor();
  await repository.apply(
    person,
    partnerApplicationInputSchema.parse({
      name,
      organization: `Cabinet ${name}`,
      phone: "",
      roles: ["advisor"],
      categories: [category],
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
  if (available) {
    const current = await repository.availability(person, person.userId);
    await repository.declareAvailability(
      person,
      person.userId,
      {
        revision: current.current?.revision ?? 0,
        professionalRevision: current.professionalRevision,
        modes: ["video", "phone"],
        periods: [{ kind: "available", startsAt: at("08:00"), endsAt: at("18:00") }],
        timezone: "Europe/Zurich",
        confirmed: true,
      },
      key(),
    );
  }
  return person;
}
async function owner() {
  return { ...(await actor()), wallet: true };
}
// One of the owner's requests, accepted by its advisor.
async function request(
  client: PartnerActor,
  advisor: PartnerActor,
  category: LeadCategory,
  title: string,
  profileId: string | null = null,
) {
  const lead = await repository.create(
    client,
    leadCreateInputSchema.parse({
      title,
      category,
      object: "Objet isolé",
      context: "Besoin isolé",
      clientUserId: client.userId,
      clientProfileId: profileId,
      clientName: "Personne isolée",
      email: "client@joint.test",
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
  const routed = await repository.command(
    admin,
    lead.id,
    { action: "assign", revision: lead.revision, responsibleId: advisor.userId, reason: "Test" },
    key(),
  );
  return repository.command(
    advisor,
    lead.id,
    { action: "accept", revision: routed.revision },
    key(),
  );
}
// The hosting appointment, at 10:00 for an hour, by video.
async function host(advisor: PartnerActor, leadId: string, startsAt = at("10:00")) {
  const lead = await repository.detail(advisor, leadId);
  const result = await repository.command(
    advisor,
    leadId,
    {
      action: "appointment",
      revision: lead.revision,
      appointment: {
        advisorId: advisor.userId,
        startsAt,
        durationMinutes: 60,
        mode: "video",
        location: "Lien convenu isolé",
        timezone: "Europe/Zurich",
      },
    },
    key(),
  );
  return result.appointments.find((item) => item.startsAt === startsAt)!.id;
}
async function scenario() {
  const client = await owner(),
    hostAdvisor = await professional("Hélène Hôte", "vehicle"),
    invited = await professional("Ivan Invité", "health");
  const hosting = await request(client, hostAdvisor, "vehicle", "Véhicule");
  const joining = await request(client, invited, "health", "Santé");
  const appointmentId = await host(hostAdvisor, hosting.id);
  return { client, hostAdvisor, invited, hosting, joining, appointmentId };
}
type Scenario = Awaited<ReturnType<typeof scenario>>;
async function invite(s: Scenario) {
  const view = await repository.walletJointAppointment(s.client, s.hosting.id, s.appointmentId);
  return repository.inviteJointParticipant(
    s.client,
    s.hosting.id,
    s.appointmentId,
    { leadId: s.joining.id, basis: view.basis, confirmed: true },
    key(),
  );
}
async function decide(
  s: Scenario,
  action:
    | { action: "confirm"; preparationMinutes?: number }
    | { action: "decline" }
    | { action: "withdraw"; reason: string }
    | { action: "outcome"; outcome: "completed" | "client_absent" | "advisor_absent" },
) {
  const item = (await repository.jointParticipations(s.invited, s.joining.id)).items[0]!;
  const input =
    action.action === "confirm"
      ? {
          action: "confirm" as const,
          basis: item.basis,
          preparationMinutes: action.preparationMinutes ?? 15,
          travelBeforeMinutes: 0,
          travelAfterMinutes: 0,
          externalCommitmentsChecked: true as const,
          capacityConfirmed: true as const,
        }
      : { ...action, basis: item.basis };
  return repository.decideJointParticipation(s.invited, s.joining.id, item.id, input, key());
}
const open = async (userId: string, kind: string) =>
  (
    await database.pool.query<{ action: string | null }>(
      "select action from partner_notifications where recipient_id=$1 and kind=$2 and resolved_at is null",
      [userId, kind],
    )
  ).rows;
// Informational notices are delivered already settled; only questions stay open.
const sent = async (userId: string, kind: string) =>
  (
    await database.pool.query<{ id: string }>(
      "select id from partner_notifications where recipient_id=$1 and kind=$2",
      [userId, kind],
    )
  ).rows;
const leadState = async (id: string) =>
  (
    await database.pool.query<{ stage: string; next_action: string; due_at: Date | null }>(
      "select stage,next_action,due_at from partner_leads where id=$1",
      [id],
    )
  ).rows[0]!;

it("lets the owner invite an advisor of another of their requests who appears free, and nobody else", async () => {
  const s = await scenario();
  const busy = await professional("Bruno Indisponible", "health", false);
  const unavailable = await request(s.client, busy, "health", "Santé complémentaire");
  // A request of another subject (a managed profile) and another owner's request never appear.
  const profileId = `profile_${key()}`;
  await database.pool.query(
    "insert into managed_profiles(id,user_id,display_name,kind) values($1,$2,'Enfant isolé','person')",
    [profileId, s.client.userId],
  );
  await request(
    s.client,
    await professional("Paula Profil", "health"),
    "health",
    "Profil",
    profileId,
  );
  const stranger = await owner();
  await request(stranger, await professional("Sven Tiers", "health"), "health", "Tiers");

  const view = await repository.walletJointAppointment(s.client, s.hosting.id, s.appointmentId);
  expect(view.canInvite).toBe(true);
  expect(
    view.candidates
      .map((item) => [item.leadTitle, item.name, item.status])
      .sort((a, b) => a[0]!.localeCompare(b[0]!)),
  ).toEqual([
    ["Santé", "Ivan Invité", "available"],
    ["Santé complémentaire", "Bruno Indisponible", "unavailable"],
  ]);
  // Only the owner reads or invites; professionals and other owners are refused.
  await expect(
    repository.walletJointAppointment(s.hostAdvisor, s.hosting.id, s.appointmentId),
  ).rejects.toMatchObject({ statusCode: 403 });
  await expect(
    repository.walletJointAppointment(stranger, s.hosting.id, s.appointmentId),
  ).rejects.toMatchObject({ statusCode: 404 });
  await expect(
    repository.inviteJointParticipant(
      s.client,
      s.hosting.id,
      s.appointmentId,
      { leadId: unavailable.id, basis: view.basis, confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  await expect(
    repository.inviteJointParticipant(
      s.client,
      s.hosting.id,
      s.appointmentId,
      { leadId: s.joining.id, basis: "0".repeat(64), confirmed: true },
      key(),
    ),
  ).rejects.toMatchObject({ statusCode: 409 });

  const invited = await invite(s);
  expect(invited.participants).toMatchObject([
    {
      leadTitle: "Santé",
      name: "Ivan Invité",
      organization: "Cabinet Ivan Invité",
      state: "invited",
    },
  ]);
  expect(invited.candidates.map((item) => item.leadTitle)).toEqual(["Santé complémentaire"]);
  // The invited professional is asked to decide; the host learns of the invitation.
  expect(await open(s.invited.userId, "appointment.joint_invited.v1")).toEqual([
    { action: "review_participation" },
  ]);
  // The notification centre of the invited professional serves that question.
  const centre = await repository.notifications(s.invited, { status: "open" });
  expect(centre.items.find((item) => item.kind === "appointment.joint_invited.v1")).toMatchObject({
    action: "review_participation",
    leadId: s.joining.id,
  });
  expect(await sent(s.hostAdvisor.userId, "appointment.joint_invited.v1")).toHaveLength(1);
  expect(await open(s.hostAdvisor.userId, "appointment.joint_invited.v1")).toEqual([]);
  // Nothing is planned for the invited request before its professional confirms.
  expect((await leadState(s.joining.id)).stage).not.toBe("appointment_scheduled");
});

it("protects the time the invited professional confirms, in the application and in the database", async () => {
  const s = await scenario();
  await invite(s);
  const before = (await repository.jointParticipations(s.invited, s.joining.id)).items[0]!;
  expect(before).toMatchObject({
    state: "invited",
    termsCurrent: true,
    host: { name: "Hélène Hôte", organization: "Cabinet Hélène Hôte" },
    check: { scope: "current", mode: "offered", period: "covered", conflict: false },
    canConfirm: true,
    canDecline: true,
  });
  // The Admin reads without acting; the host has no access to the joining request at all.
  expect((await repository.jointParticipations(admin, s.joining.id)).items[0]).toMatchObject({
    check: null,
    canConfirm: false,
  });
  await expect(repository.jointParticipations(s.hostAdvisor, s.joining.id)).rejects.toMatchObject({
    statusCode: 404,
  });
  // Travel is meaningless for a video call.
  await expect(
    repository.decideJointParticipation(
      s.invited,
      s.joining.id,
      before.id,
      {
        action: "confirm",
        basis: before.basis,
        preparationMinutes: 15,
        travelBeforeMinutes: 10,
        travelAfterMinutes: 0,
        externalCommitmentsChecked: true,
        capacityConfirmed: true,
      },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });

  const confirmed = await decide(s, { action: "confirm" });
  expect(confirmed.items[0]).toMatchObject({ state: "confirmed", canWithdraw: true });
  expect(await leadState(s.joining.id)).toMatchObject({
    stage: "appointment_scheduled",
    next_action: "Tenir le rendez-vous conjoint",
    due_at: new Date(at("10:00")),
  });
  expect(await open(s.invited.userId, "appointment.joint_invited.v1")).toEqual([]);
  expect(await sent(s.hostAdvisor.userId, "appointment.joint_confirmed.v1")).toHaveLength(1);
  expect(await sent(s.client.userId, "appointment.joint_confirmed.v1")).toHaveLength(1);

  // The hosting appointment shows who joins to its professional and its owner.
  for (const reader of [s.hostAdvisor, s.client, admin])
    expect((await repository.detail(reader, s.hosting.id)).appointments[0]!.participants).toEqual([
      expect.objectContaining({ name: "Ivan Invité", state: "confirmed", termsCurrent: true }),
    ]);
  // The invited professional's agenda shows it through their own request.
  const work = await repository.work(s.invited);
  expect(work.appointments).toEqual([
    expect.objectContaining({
      id: s.appointmentId,
      leadId: s.joining.id,
      leadTitle: "Santé",
    }),
  ]);
  expect(work.appointments[0]!.participation).toMatchObject({
    state: "confirmed",
    termsCurrent: true,
  });

  // Their own commitment cannot overlap the joint appointment with its preparation...
  await expect(host(s.invited, s.joining.id, at("09:50"))).rejects.toMatchObject({
    code: "PARTNER_APPOINTMENT_CONFLICT",
  });
  // ...and the database guard refuses it even from a writer that skips the check.
  await expect(
    database.pool.query(
      `insert into partner_appointments(id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone)
      values($1,$2,$3,$4,30,'video','Lien isolé','Europe/Zurich')`,
      [`appt_${key()}`, s.joining.id, s.invited.userId, at("10:30")],
    ),
  ).rejects.toMatchObject({ code: "23P01" });
  // Outside the protected period it is free again.
  await host(s.invited, s.joining.id, at("14:00"));
});

it("asks to reconfirm after a reschedule and ends participations when the appointment is cancelled", async () => {
  const s = await scenario();
  // The host's own rescheduling path needs a confirmed client mode for the hosting request.
  const preference = await repository.advicePreferences(s.client, s.hosting.id);
  await repository.confirmAdvicePreferences(
    s.client,
    s.hosting.id,
    {
      revision: preference.revision,
      scopeRevision: preference.scopeRevision,
      profileRevision: preference.profileRevision!,
      mode: "video",
      languageCode: null,
      canton: null,
      confirmed: true,
    },
    key(),
  );
  await invite(s);
  await decide(s, { action: "confirm" });

  const moved = {
    appointment: {
      startsAt: at("15:00"),
      durationMinutes: 60,
      mode: "video" as const,
      location: "Lien convenu isolé",
      timezone: "Europe/Zurich" as const,
    },
    time: { preparationMinutes: 0, travelBeforeMinutes: 0, travelAfterMinutes: 0 },
  };
  const preview = await repository.previewPersonalRescheduling(
    s.hostAdvisor,
    s.hosting.id,
    s.appointmentId,
    moved,
  );
  await repository.confirmPersonalRescheduling(
    s.hostAdvisor,
    s.hosting.id,
    s.appointmentId,
    personalAppointmentConfirmSchema.parse({
      ...moved,
      basis: preview.basis,
      clientAgreementConfirmed: true,
      externalCommitmentsChecked: true,
      capacityConfirmed: true,
      preparationAndTravelChecked: true,
    }),
    key(),
  );
  const reconfirm = (await repository.jointParticipations(s.invited, s.joining.id)).items[0]!;
  expect(reconfirm).toMatchObject({
    state: "invited",
    termsCurrent: true,
    appointment: { startsAt: at("15:00") },
    canConfirm: true,
  });
  expect(await leadState(s.joining.id)).toMatchObject({
    next_action: "Reconfirmer le rendez-vous conjoint",
    due_at: new Date(at("15:00")),
  });
  expect(await open(s.invited.userId, "appointment.joint_reconfirm.v1")).toEqual([
    { action: "review_participation" },
  ]);
  // The old confirmation no longer holds any time: 10:00 is free for the invited professional.
  await host(s.invited, s.joining.id, at("10:00"));

  await decide(s, { action: "confirm" });
  const appointment = await repository.walletAppointment(s.client, s.hosting.id, s.appointmentId);
  await repository.cancelWalletAppointment(
    s.client,
    s.hosting.id,
    s.appointmentId,
    { reason: "Empêchement", basis: appointment.basis, confirmed: true },
    key(),
  );
  expect((await repository.jointParticipations(s.invited, s.joining.id)).items[0]).toMatchObject({
    state: "ended",
    canConfirm: false,
  });
  // The invited request keeps its own cycle: back to planning, with its other commitment kept.
  expect((await leadState(s.joining.id)).stage).toBe("appointment_scheduled");
  expect(await sent(s.invited.userId, "appointment.joint_ended.v1")).toHaveLength(1);
  expect(await open(s.invited.userId, "appointment.joint_reconfirm.v1")).toEqual([]);
});

it("lets the participant withdraw or record their own outcome, and ends a participation on loss of access", async () => {
  const s = await scenario();
  await invite(s);
  await decide(s, { action: "confirm" });
  await decide(s, { action: "withdraw", reason: "Dossier traité par écrit" });
  expect(await leadState(s.joining.id)).toMatchObject({
    stage: "appointment_needed",
    next_action: "Recontacter le client pour convenir de la suite",
  });
  expect(await sent(s.hostAdvisor.userId, "appointment.joint_withdrawn.v1")).toHaveLength(1);
  expect(await sent(s.client.userId, "appointment.joint_withdrawn.v1")).toHaveLength(1);
  // No new solicitation of a professional who withdrew from this appointment.
  const after = await repository.walletJointAppointment(s.client, s.hosting.id, s.appointmentId);
  expect(after.candidates).toEqual([
    expect.objectContaining({ leadId: s.joining.id, status: "declined" }),
  ]);
  await expect(invite(s)).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });

  const u = await scenario();
  await invite(u);
  await decide(u, { action: "confirm" });
  // The meeting took place: move it into the past together with the confirmed terms.
  await database.pool.query(
    "update partner_appointments set starts_at=now()-interval '2 hours' where id=$1",
    [u.appointmentId],
  );
  await database.pool.query(
    `update partner_appointment_participants p set terms_revision=a.link_terms_revision
    from partner_appointments a where a.id=p.appointment_id and p.appointment_id=$1 and p.state='confirmed'`,
    [u.appointmentId],
  );
  const done = await decide(u, { action: "outcome", outcome: "completed" });
  expect(done.items[0]).toMatchObject({ outcome: "completed", canRecordOutcome: false });
  expect((await leadState(u.joining.id)).stage).toBe("appointment_completed");
  // The hosting request keeps its own stage: the host records its own outcome.
  expect((await leadState(u.hosting.id)).stage).toBe("appointment_scheduled");

  const t = await scenario();
  await invite(t);
  await decide(t, { action: "confirm" });
  const replacement = await professional("Rita Relève", "health");
  const lead = await repository.detail(admin, t.joining.id);
  await repository.command(
    admin,
    t.joining.id,
    {
      action: "assign",
      revision: lead.revision,
      responsibleId: replacement.userId,
      reason: "Relève",
    },
    key(),
  );
  expect((await repository.jointParticipations(admin, t.joining.id)).items[0]!.state).toBe("ended");
  expect(await sent(t.hostAdvisor.userId, "appointment.joint_withdrawn.v1")).toHaveLength(1);
  // The former participant no longer reads the request's participations at all.
  await expect(repository.jointParticipations(t.invited, t.joining.id)).rejects.toMatchObject({
    statusCode: 404,
  });
});
