import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { beforeAll, afterAll, expect, it } from "vitest";
import {
  leadCreateInputSchema,
  partnerApplicationInputSchema,
  bookingProposalInputSchema,
  bookingChoiceSchema,
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
    .withDatabase("coverview_booking_proposals_test")
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
  const lead = await assigned(owner, person, profileId);
  await preference(owner, lead.id);
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
  return { person, owner, lead, profileId };
}
type Scenario = Awaited<ReturnType<typeof setup>>;
async function offer(
  s: Scenario,
  starts = ["2030-06-04T10:00:00Z", "2030-06-04T12:00:00Z"],
  expiresAt = new Date(Date.now() + 3600000).toISOString(),
) {
  const slots = [];
  for (const startsAt of starts) {
    const proposal = {
      appointment: {
        startsAt,
        durationMinutes: 60,
        mode: "video" as const,
        location: "Lien convenu isolé",
        timezone: "Europe/Zurich" as const,
      },
      time: { preparationMinutes: 15, travelBeforeMinutes: 0, travelAfterMinutes: 0 },
    };
    const preview = await repository.previewPersonalAppointment(s.person, s.lead.id, proposal);
    expect(preview.canConfirm).toBe(true);
    slots.push({ ...proposal, basis: preview.basis });
  }
  const input = bookingProposalInputSchema.parse({
    slots,
    expiresAt,
    offeredConfirmed: true,
    externalCommitmentsChecked: true,
    capacityConfirmed: true,
    preparationAndTravelChecked: true,
  });
  const commandKey = key();
  const result = await repository.proposeBooking(s.person, s.lead.id, input, commandKey);
  return { input, commandKey, result, id: result.proposals[0]!.id };
}
async function choice(s: Scenario, slot = 0) {
  const view = await repository.bookingProposals(s.owner, s.lead.id),
    proposal = view.proposals[0]!;
  return {
    proposal,
    input: { slot, basis: proposal.slots[slot]!.basis, confirmed: true as const },
  };
}
async function reserve(s: Scenario, slot = 0) {
  const selected = await choice(s, slot);
  return repository.reserveBooking(s.owner, s.lead.id, selected.proposal.id, selected.input, key());
}
async function count(leadId: string) {
  return (
    await database.pool.query<{ appointments: number; times: number }>(
      `select
    (select count(*)::int from partner_appointments where lead_id=$1) appointments,
    (select count(*)::int from partner_appointment_time_plans t join partner_appointments a on a.id=t.appointment_id where a.lead_id=$1) times`,
      [leadId],
    )
  ).rows[0];
}

it("strict contracts refuse forged advisor, missing consent, duplicate times and excessive alternatives", async () => {
  const s = await setup(),
    o = await offer(s);
  expect(
    bookingProposalInputSchema.safeParse({ ...o.input, advisorId: s.person.userId }).success,
  ).toBe(false);
  expect(
    bookingProposalInputSchema.safeParse({ ...o.input, offeredConfirmed: false }).success,
  ).toBe(false);
  expect(
    bookingProposalInputSchema.safeParse({
      ...o.input,
      slots: [o.input.slots[0], o.input.slots[0]],
    }).success,
  ).toBe(false);
  expect(
    bookingProposalInputSchema.safeParse({
      ...o.input,
      slots: Array.from({ length: 6 }, () => o.input.slots[0]),
    }).success,
  ).toBe(false);
  expect(
    bookingChoiceSchema.safeParse({
      slot: 0,
      basis: "a".repeat(64),
      confirmed: true,
      advisorId: s.person.userId,
    }).success,
  ).toBe(false);
});
it("offers consume no time, publish once and give Wallet shared terms without buffers or source evidence", async () => {
  const s = await setup(),
    before = await database.pool.query("select * from partner_leads where id=$1", [s.lead.id]),
    o = await offer(s);
  expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
  expect(
    (await database.pool.query("select * from partner_leads where id=$1", [s.lead.id])).rows,
  ).toEqual(before.rows);
  const replay = await repository.proposeBooking(s.person, s.lead.id, o.input, o.commandKey);
  expect(replay.proposals).toHaveLength(1);
  await expect(
    repository.proposeBooking(s.person, s.lead.id, o.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  const view = await repository.bookingProposals(s.owner, s.lead.id);
  expect(view.proposals[0]?.slots.map((slot) => slot.canBook)).toEqual([true, true]);
  for (const secret of [
    "preparationMinutes",
    "travelBeforeMinutes",
    "externalCommitmentsChecked",
    "fingerprint",
    "advisorId",
    "professionalRevision",
    s.person.userId,
  ])
    expect(JSON.stringify(view)).not.toContain(secret);
  expect(
    (
      await database.pool.query(
        "select * from partner_notifications where lead_id=$1 and kind='appointment.slots_offered.v1' and audience='wallet'",
        [s.lead.id],
      )
    ).rowCount,
  ).toBe(1);
});
it("records a single chosen appointment, protected time and two consents; preserves custom action and other demand", async () => {
  const s = await setup(true),
    other = await assigned(s.owner, s.person, s.profileId);
  const before = (await database.pool.query("select * from partner_leads where id=$1", [other.id]))
    .rows;
  const waiting = { reason: "Pièce attendue", until: "2030-06-04T08:00:00Z" };
  await database.pool.query(
    "update partner_leads set next_action='Attendre une pièce',waiting=$2 where id=$1",
    [s.lead.id, JSON.stringify(waiting)],
  );
  await offer(s);
  const result = await reserve(s, 1),
    row = result.proposals[0]!;
  expect(row.state).toBe("booked");
  expect(row.selectedSlot).toBe(1);
  expect(await count(s.lead.id)).toEqual({ appointments: 1, times: 1 });
  const appt = (
    await database.pool.query<{ advisor_id: string; occupied_before_minutes: number }>(
      "select * from partner_appointments where id=$1",
      [row.appointmentId],
    )
  ).rows[0]!;
  expect(appt.advisor_id).toBe(s.person.userId);
  expect(appt.occupied_before_minutes).toBe(15);
  const plan = (
    await database.pool.query<{
      advisor_id: string;
      evidence: {
        booking: {
          choice: { confirmed: boolean };
          input: { offeredConfirmed: boolean };
          clientUserId: string;
        };
      };
    }>("select * from partner_appointment_time_plans where appointment_id=$1", [row.appointmentId])
  ).rows[0]!;
  expect(plan.advisor_id).toBe(s.person.userId);
  expect(plan.evidence.booking.choice.confirmed).toBe(true);
  expect(plan.evidence.booking.input.offeredConfirmed).toBe(true);
  expect(plan.evidence.booking.clientUserId).toBe(s.owner.userId);
  const current = (
    await database.pool.query<Record<string, unknown>>("select * from partner_leads where id=$1", [
      s.lead.id,
    ])
  ).rows[0]!;
  expect(current.next_action).toBe("Attendre une pièce");
  expect(current.waiting).toEqual(waiting);
  expect(current.first_useful_at).not.toBeNull();
  expect(
    (await database.pool.query("select * from partner_leads where id=$1", [other.id])).rows,
  ).toEqual(before);
  const cancellation = await repository.walletAppointment(s.owner, s.lead.id, row.appointmentId!);
  expect(cancellation.canCancel).toBe(true);
  await repository.cancelWalletAppointment(
    s.owner,
    s.lead.id,
    row.appointmentId!,
    { basis: cancellation.basis, reason: "Client indisponible", confirmed: true },
    key(),
  );
  expect((await repository.bookingProposals(s.owner, s.lead.id)).proposals[0]?.state).toBe(
    "booked",
  );
});
it("only current owner can choose, only personal qualified advisor can publish or withdraw", async () => {
  const s = await setup(),
    o = await offer(s),
    c = await choice(s),
    outsider = { ...(await actor()), wallet: true },
    colleague = await professional();
  await expect(repository.bookingProposals(outsider, s.lead.id)).rejects.toMatchObject({
    code: "PARTNER_NOT_FOUND",
  });
  await expect(
    repository.reserveBooking(outsider, s.lead.id, o.id, c.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await expect(async () =>
    repository.reserveBooking(s.person, s.lead.id, o.id, c.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(async () =>
    repository.proposeBooking(s.owner, s.lead.id, o.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
  await expect(
    repository.proposeBooking(colleague, s.lead.id, o.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  await expect(
    repository.withdrawBooking(admin, s.lead.id, o.id, { confirmed: true }, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
});
it("a real editable/contactable contributor may personally offer and is notified of the reservation", async () => {
  const s = await setup(),
    responsible = await professional();
  await database.pool.query("update partner_leads set responsible_id=$2 where id=$1", [
    s.lead.id,
    responsible.userId,
  ]);
  await database.pool.query(
    "insert into partner_contributors(id,lead_id,user_id,access_scope,can_edit,can_contact) values($1,$2,$3,'advice',true,true)",
    [key(), s.lead.id, s.person.userId],
  );
  await offer(s);
  await reserve(s);
  expect(
    (
      await database.pool.query(
        "select * from partner_notifications where lead_id=$1 and kind='client.appointment_reserved.v1' and recipient_id=$2",
        [s.lead.id, s.person.userId],
      )
    ).rowCount,
  ).toBe(1);
});
it("withdrawal is final and idempotent; a new proposal is distinct", async () => {
  const s = await setup(),
    o = await offer(s),
    c = await choice(s),
    k = key();
  await repository.withdrawBooking(s.person, s.lead.id, o.id, { confirmed: true }, k);
  await repository.withdrawBooking(s.person, s.lead.id, o.id, { confirmed: true }, k);
  await expect(
    repository.reserveBooking(s.owner, s.lead.id, o.id, c.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect((await offer(s)).id).not.toBe(o.id);
});
it("exact reservation replay is safe and reauthorized; changed input or second choice cannot create another appointment", async () => {
  const s = await setup(),
    o = await offer(s),
    c = await choice(s),
    k = key();
  await repository.reserveBooking(s.owner, s.lead.id, o.id, c.input, k);
  await repository.reserveBooking(s.owner, s.lead.id, o.id, c.input, k);
  await expect(
    repository.reserveBooking(s.owner, s.lead.id, o.id, { ...c.input, slot: 1 }, k),
  ).rejects.toMatchObject({ code: "PARTNER_IDEMPOTENCY_REUSED" });
  await expect(
    repository.reserveBooking(s.owner, s.lead.id, o.id, c.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(await count(s.lead.id)).toEqual({ appointments: 1, times: 1 });
  await database.pool.query("update identity_sessions set revoked_at=now() where id=$1", [
    s.owner.id,
  ]);
  await expect(
    repository.reserveBooking(s.owner, s.lead.id, o.id, c.input, k),
  ).rejects.toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});
it("simultaneous choices on one proposal produce one durable reservation", async () => {
  const s = await setup();
  await offer(s);
  const c = await choice(s),
    d = await choice(s, 1);
  const results = await Promise.allSettled([
    repository.reserveBooking(s.owner, s.lead.id, c.proposal.id, c.input, key()),
    repository.reserveBooking(s.owner, s.lead.id, d.proposal.id, d.input, key()),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await count(s.lead.id)).toEqual({ appointments: 1, times: 1 });
});
it("simultaneous bookings on different demands cannot overlap the advisor's protected time", async () => {
  const s = await setup(),
    owner2 = { ...(await actor()), wallet: true },
    lead2 = await assigned(owner2, s.person);
  await preference(owner2, lead2.id);
  const other = { ...s, owner: owner2, lead: lead2 };
  await offer(s);
  await offer(other, ["2030-06-04T11:10:00Z"]);
  const c = await choice(s),
    d = await choice(other);
  const results = await Promise.allSettled([
    repository.reserveBooking(s.owner, s.lead.id, c.proposal.id, c.input, key()),
    repository.reserveBooking(other.owner, other.lead.id, d.proposal.id, d.input, key()),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await count(s.lead.id))!.appointments + (await count(other.lead.id))!.appointments).toBe(
    1,
  );
});
it("current preference, source revision and open interlocutor request are revalidated", async () => {
  for (const change of ["preference", "availability", "interlocutor"] as const) {
    const s = await setup();
    await offer(s);
    const c = await choice(s);
    if (change === "preference") {
      await preference(s.owner, s.lead.id, "phone");
      await preference(s.owner, s.lead.id);
    }
    if (change === "availability")
      await database.pool.query(
        "update partner_availability_declarations set revision=revision+1 where user_id=$1",
        [s.person.userId],
      );
    if (change === "interlocutor")
      await database.pool.query(
        "insert into partner_notifications(id,lead_id,audience,kind,dedupe_key,action,priority) values($1,$2,'coverview','interlocutor_request',$1,'assign','high')",
        [key(), s.lead.id],
      );
    await expect(
      repository.reserveBooking(s.owner, s.lead.id, c.proposal.id, c.input, key()),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
    expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
  }
});
it("mandate, member and organization round trips never resurrect consent", async () => {
  for (const change of ["assignment", "member", "organization"] as const) {
    const s = await setup();
    await offer(s);
    const c = await choice(s);
    if (change === "assignment") {
      await database.pool.query("update partner_leads set assignment='proposed' where id=$1", [
        s.lead.id,
      ]);
      await database.pool.query("update partner_leads set assignment='accepted' where id=$1", [
        s.lead.id,
      ]);
    }
    if (change === "member") {
      await database.pool.query("update partner_members set state='suspended' where user_id=$1", [
        s.person.userId,
      ]);
      await database.pool.query("update partner_members set state='approved' where user_id=$1", [
        s.person.userId,
      ]);
    }
    if (change === "organization") {
      await database.pool.query(
        "update partner_organizations set state='suspended' where id=(select organization_id from partner_members where user_id=$1)",
        [s.person.userId],
      );
      await database.pool.query(
        "update partner_organizations set state='approved' where id=(select organization_id from partner_members where user_id=$1)",
        [s.person.userId],
      );
    }
    await expect(
      repository.reserveBooking(s.owner, s.lead.id, c.proposal.id, c.input, key()),
    ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
    expect((await repository.bookingProposals(s.owner, s.lead.id)).proposals[0]?.state).toBe(
      "invalidated",
    );
  }
});
it("managed subject relink and ownership changes hide old proposals and reject cached choices", async () => {
  const s = await setup(true);
  await offer(s);
  const c = await choice(s),
    other = await actor();
  await database.pool.query(
    "update managed_profiles set user_id=$2,revision=revision+1 where id=$1",
    [s.profileId, other.userId],
  );
  await expect(
    repository.reserveBooking(s.owner, s.lead.id, c.proposal.id, c.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_NOT_FOUND" });
  expect(
    (await repository.bookingProposals({ ...other, wallet: true }, s.lead.id)).proposals,
  ).toHaveLength(0);
  await database.pool.query(
    "update managed_profiles set user_id=$2,revision=revision+1 where id=$1",
    [s.profileId, s.owner.userId],
  );
  await expect(
    repository.reserveBooking(s.owner, s.lead.id, c.proposal.id, c.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
});
it("expired offers cannot reserve, and publication rejects expiry after preparation or beyond seven days", async () => {
  const s = await setup(),
    o = await offer(s, undefined, new Date(Date.now() + 800).toISOString()),
    c = await choice(s);
  await setTimeout(900);
  expect((await repository.bookingProposals(s.owner, s.lead.id)).proposals[0]?.state).toBe(
    "expired",
  );
  await expect(
    repository.reserveBooking(s.owner, s.lead.id, o.id, c.input, key()),
  ).rejects.toMatchObject({ code: "PARTNER_CONFLICT" });
  await expect(
    repository.proposeBooking(
      s.person,
      s.lead.id,
      { ...o.input, expiresAt: "2030-06-04T11:00:00Z" },
      key(),
    ),
  ).rejects.toMatchObject({ code: "PARTNER_ACTION_REQUIRED" });
  expect((await offer(s)).id).not.toBe(o.id);
});
async function waitForLock() {
  for (let i = 0; i < 100; i++) {
    if (
      (
        await database.pool.query(
          "select pid from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and pid<>pg_backend_pid()",
          [],
        )
      ).rowCount
    )
      return;
    await setTimeout(20);
  }
  throw new Error("Expected a real database lock wait");
}
it("rechecks canonical profile ownership after an actual blocking lock", async () => {
  const s = await setup(true);
  await offer(s);
  const c = await choice(s),
    other = await actor(),
    blocker = await database.pool.connect();
  await blocker.query("begin");
  await blocker.query("select id from managed_profiles where id=$1 for update", [s.profileId]);
  const result = repository.reserveBooking(s.owner, s.lead.id, c.proposal.id, c.input, key()).then(
    () => null,
    (e: unknown) => e,
  );
  try {
    await waitForLock();
    await blocker.query("update managed_profiles set user_id=$2,revision=revision+1 where id=$1", [
      s.profileId,
      other.userId,
    ]);
    await blocker.query("commit");
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
  expect(await result).toMatchObject({ code: "PARTNER_NOT_FOUND" });
  expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
});
it("rechecks expiry after waiting on the canonical profile", async () => {
  const s = await setup(true);
  await offer(s, undefined, new Date(Date.now() + 2000).toISOString());
  const c = await choice(s),
    blocker = await database.pool.connect();
  await blocker.query("begin");
  await blocker.query("select id from managed_profiles where id=$1 for update", [s.profileId]);
  const result = repository.reserveBooking(s.owner, s.lead.id, c.proposal.id, c.input, key()).then(
    () => null,
    (e: unknown) => e,
  );
  try {
    await waitForLock();
    await setTimeout(2100);
    await blocker.query("commit");
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
  expect(await result).toMatchObject({ code: "PARTNER_CONFLICT" });
  expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
});
it("session expiry while waiting for its row forbids reservation", async () => {
  const s = await setup();
  await offer(s);
  const c = await choice(s),
    blocker = await database.pool.connect();
  await blocker.query("begin");
  await blocker.query("select id from identity_sessions where id=$1 for update", [s.owner.id]);
  const result = repository.reserveBooking(s.owner, s.lead.id, c.proposal.id, c.input, key()).then(
    () => null,
    (e: unknown) => e,
  );
  try {
    await waitForLock();
    await blocker.query(
      "update identity_sessions set expires_at=clock_timestamp()+interval '1 second' where id=$1",
      [s.owner.id],
    );
    await setTimeout(1100);
    await blocker.query("commit");
  } finally {
    await blocker.query("rollback");
    blocker.release();
  }
  expect(await result).toMatchObject({ code: "PARTNER_ACCESS_DENIED" });
});
it("proposal terms and booked receipts cannot be rewritten or deleted", async () => {
  const s = await setup(),
    o = await offer(s);
  await expect(
    database.pool.query("update partner_booking_proposals set advisor_name='Changed' where id=$1", [
      o.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  await reserve(s);
  await expect(
    database.pool.query(
      "update partner_booking_proposals set state='withdrawn',appointment_id=null,selected_slot=null where id=$1",
      [o.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    database.pool.query("delete from partner_booking_proposals where id=$1", [o.id]),
  ).rejects.toMatchObject({ code: "23514" });
});
it("an audit/notification failure rolls back the booking, occupied time, receipt and idempotency command", async () => {
  const s = await setup(),
    o = await offer(s),
    c = await choice(s),
    k = key();
  await database.pool.query(
    `create function booking_test_failure() returns trigger language plpgsql as $$ begin if NEW.kind='client.appointment_reserved.v1' then raise exception 'isolated rollback oracle'; end if; return NEW; end $$; create trigger booking_test_failure before insert on partner_events for each row execute function booking_test_failure()`,
  );
  try {
    await expect(repository.reserveBooking(s.owner, s.lead.id, o.id, c.input, k)).rejects.toThrow(
      "isolated rollback oracle",
    );
  } finally {
    await database.pool.query(
      "drop trigger booking_test_failure on partner_events; drop function booking_test_failure()",
    );
  }
  expect(await count(s.lead.id)).toEqual({ appointments: 0, times: 0 });
  expect(
    (
      await database.pool.query<{ state: string }>(
        "select state from partner_booking_proposals where id=$1",
        [o.id],
      )
    ).rows[0]?.state,
  ).toBe("offered");
  expect(
    (await database.pool.query("select id from partner_commands where key=$1", [k])).rowCount,
  ).toBe(0);
  expect(
    (
      await database.pool.query(
        "select id from partner_events where lead_id=$1 and kind='appointment.scheduled'",
        [s.lead.id],
      )
    ).rowCount,
  ).toBe(0);
  await repository.reserveBooking(s.owner, s.lead.id, o.id, c.input, k);
});
