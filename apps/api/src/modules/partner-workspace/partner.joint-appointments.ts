import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { appointmentTermsSchema, type PartnerApplication } from "@coverview/contracts/partner";
import {
  jointInvitationInputSchema,
  jointParticipationActionSchema,
  jointParticipationsSchema,
  walletJointAppointmentSchema,
  type JointInvitationInput,
  type JointParticipationAction,
} from "@coverview/contracts/partner-joint";
import { availabilityPeriod, overlappingAppointment } from "./partner.appointment-assessment.js";
import { readCurrentAvailability } from "./partner.availability.js";
import { event, newId, type PartnerAuditActor } from "./partner.audit.js";
import {
  authorityCurrent,
  fail,
  failOnConcurrentAbort,
  lockActor,
  membership,
  ownedClient,
  visible,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";

type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type Appointment = {
  id: string;
  lead_id: string;
  advisor_id: string;
  starts_at: Date;
  duration_minutes: number;
  mode: string;
  location: string;
  timezone: string;
  state: string;
  link_terms_revision: number;
};
type Participation = {
  id: string;
  appointment_id: string;
  lead_id: string;
  user_id: string;
  state: "invited" | "confirmed" | "declined" | "withdrawn" | "ended";
  terms_revision: number;
  preparation_minutes: number;
  travel_before_minutes: number;
  travel_after_minutes: number;
  outcome: "completed" | "client_absent" | "advisor_absent" | null;
  revision: number;
};
type Request = {
  id: string;
  title: string;
  category: string;
  stage: string;
  revision: number;
  responsible_id: string | null;
  client_profile_id: string | null;
  client_user_id: string | null;
};
// No automatic solicitation (brief I.12): one invitation per gesture of the owner, three at most.
const invitationLimit = 3;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const terms = (a: Appointment) =>
  appointmentTermsSchema.parse({
    startsAt: a.starts_at.toISOString(),
    durationMinutes: a.duration_minutes,
    mode: a.mode,
    location: a.location,
    timezone: a.timezone,
  });
const termsCurrent = (p: Participation, a: Appointment) =>
  p.terms_revision === a.link_terms_revision;
const ends = (a: Appointment) => a.starts_at.getTime() + a.duration_minutes * 60000;
const advisorFor = (member: PartnerApplication | null, category: string) =>
  !!member &&
  member.state === "approved" &&
  member.organizationState === "approved" &&
  member.grantedRoles.includes("advisor") &&
  member.categories.some((item) => item === category) &&
  (!member.reviewDueAt || Date.parse(member.reviewDueAt) > Date.now());
// The personal right that booking already requires: accepted responsible, or advice contributor.
const personal = `((l.responsible_id=$1 and l.assignment='accepted' and ${authorityCurrent("l")}) or exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=$1 and c.revoked_at is null and ${authorityCurrent("c")} and c.access_scope='advice' and c.can_edit and c.can_contact))`;
const request =
  "l.id,l.title,l.category,l.stage,l.revision,l.responsible_id,l.client_profile_id,l.client_user_id";

async function professional(db: Executor, userId: string) {
  const member = await membership(db, userId);
  return { name: member?.name ?? null, organization: member?.organization ?? null };
}
async function owned(db: Executor, actor: PartnerActor, leadId: string) {
  const row = (
    await db.query<Request>(
      `select ${request} from partner_leads l where l.id=$2 and ${ownedClient}`,
      [actor.userId, leadId],
    )
  ).rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  return row;
}
async function appointment(db: Executor, id: string, leadId?: string) {
  const row = (
    await db.query<Appointment>(
      `select * from partner_appointments where id=$1${leadId ? " and lead_id=$2" : ""}`,
      leadId ? [id, leadId] : [id],
    )
  ).rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  return row;
}
async function personalOn(db: Executor, userId: string, leadId: string) {
  return !!(
    await db.query(`select 1 from partner_leads l where l.id=$2 and ${personal}`, [userId, leadId])
  ).rowCount;
}
async function lockPlanning(db: Executor, users: (string | null)[]) {
  for (const user of [...new Set(users.filter((item): item is string => !!item))].sort())
    await db.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [user]);
}
async function lockSubject(db: Executor, lead: Request) {
  if (lead.client_profile_id)
    await db.query("select id from managed_profiles where id=$1 for share", [
      lead.client_profile_id,
    ]);
  else if (lead.client_user_id)
    await db.query("select user_id from identity_profiles where user_id=$1 for share", [
      lead.client_user_id,
    ]);
}
// The professional's own declaration and the bare collision fact for one occupied period.
async function availability(
  db: Executor,
  member: PartnerApplication | null,
  userId: string,
  appt: Appointment,
  start: number,
  end: number,
) {
  const declared = await readCurrentAvailability(db, member);
  const scope = declared?.professionalScope ?? "missing";
  const known = !!declared && scope === "current";
  return {
    scope,
    mode: !known
      ? ("unknown" as const)
      : !declared.modes.length
        ? ("unspecified" as const)
        : declared.modes.some((mode) => mode === appt.mode)
          ? ("offered" as const)
          : ("not_offered" as const),
    period: known ? availabilityPeriod(declared.periods, start, end) : ("unknown" as const),
    conflict: await overlappingAppointment(db, userId, appt.id, new Date(start), new Date(end)),
  };
}
const usable = (check: Awaited<ReturnType<typeof availability>>) =>
  check.scope === "current" &&
  check.mode === "offered" &&
  check.period === "covered" &&
  !check.conflict;

// A participation that ends returns its request to planning, unless another commitment remains.
async function release(db: Executor, leadId: string) {
  const free = `stage='appointment_scheduled' and not exists(select 1 from partner_appointments a
    where a.lead_id=l.id and a.state='scheduled' and a.starts_at>clock_timestamp()) and not exists(
    select 1 from partner_appointment_participants p join partner_appointments j on j.id=p.appointment_id
    where p.lead_id=l.id and p.state='confirmed' and p.terms_revision=j.link_terms_revision
    and j.state='scheduled' and j.starts_at>clock_timestamp())`;
  const planned = `next_action in ('Tenir le rendez-vous conjoint','Reconfirmer le rendez-vous conjoint') and waiting is null`;
  await db.query(
    `update partner_leads l set stage=case when ${free} then 'appointment_needed' else stage end,
      stage_changed_at=case when ${free} then clock_timestamp() else stage_changed_at end,
      next_action=case when ${planned} then 'Recontacter le client pour convenir de la suite' else next_action end,
      due_at=case when ${planned} then least(due_at,clock_timestamp()) else due_at end,
      revision=revision+1,updated_at=clock_timestamp() where id=$1`,
    [leadId],
  );
}

// Called by every path that cancels or reschedules a hosting appointment, after its update.
// A cancelled appointment ends its participations; new terms ask each participant to reconfirm,
// and a confirmation given for the old terms no longer protects any time.
export async function settleJointAppointments(
  tx: PoolClient,
  actor: PartnerAuditActor,
  appointmentIds: string[],
) {
  for (const id of [...new Set(appointmentIds)].sort()) {
    const appt = (
      await tx.query<Appointment>("select * from partner_appointments where id=$1", [id])
    ).rows[0];
    if (!appt) continue;
    const rows = (
      await tx.query<Participation>(
        "select * from partner_appointment_participants where appointment_id=$1 and state in ('invited','confirmed') order by id for update",
        [id],
      )
    ).rows;
    for (const row of rows) {
      if (appt.state === "cancelled") {
        await tx.query(
          "update partner_appointment_participants set state='ended',revision=revision+1,decided_at=now() where id=$1",
          [row.id],
        );
        if (row.state === "confirmed") await release(tx, row.lead_id);
        await event(tx, actor, row.lead_id, "appointment.joint_ended.v1", "", "client", row.id);
      } else if (appt.state === "scheduled" && !termsCurrent(row, appt)) {
        await tx.query(
          `update partner_appointment_participants set state='invited',terms_revision=$2,preparation_minutes=0,
          travel_before_minutes=0,travel_after_minutes=0,revision=revision+1,decided_at=null where id=$1`,
          [row.id, appt.link_terms_revision],
        );
        if (row.state === "confirmed")
          await tx.query(
            `update partner_leads set next_action='Reconfirmer le rendez-vous conjoint',due_at=$2,
            revision=revision+1,updated_at=now() where id=$1 and next_action='Tenir le rendez-vous conjoint'`,
            [row.lead_id, appt.starts_at],
          );
        await event(
          tx,
          actor,
          row.lead_id,
          "appointment.joint_reconfirm.v1",
          appt.starts_at.toISOString(),
          "assigned",
          row.id,
        );
      }
    }
  }
}

// A request that closes, or whose professional loses the personal right on it, leaves the
// appointments it joined. The hosting request, its professional and the owner are told.
export async function leaveJointAppointments(
  tx: PoolClient,
  actor: PartnerAuditActor,
  leadId: string,
  closing: boolean,
) {
  const rows = (
    await tx.query<Participation>(
      "select * from partner_appointment_participants where lead_id=$1 and state in ('invited','confirmed') order by id for update",
      [leadId],
    )
  ).rows;
  for (const row of rows) {
    if (!closing && (await personalOn(tx, row.user_id, leadId))) continue;
    await tx.query(
      "update partner_appointment_participants set state='ended',revision=revision+1,decided_at=now() where id=$1",
      [row.id],
    );
    if (row.state === "confirmed" && !closing) await release(tx, leadId);
    const appt = await appointment(tx, row.appointment_id);
    await event(tx, actor, appt.lead_id, "appointment.joint_withdrawn.v1", "", "client", row.id);
  }
}

// Shown with the hosting appointment to its professionals, its owner and the Admin only.
export async function appointmentParticipants(
  db: Executor,
  actor: PartnerActor,
  appointments: { id: string; advisorId: string }[],
) {
  const result = new Map<string, unknown[]>();
  if (!appointments.length) return result;
  const rows = (
    await db.query<Participation & { link_terms_revision: number }>(
      `select p.*,a.link_terms_revision from partner_appointment_participants p
      join partner_appointments a on a.id=p.appointment_id where p.appointment_id=any($1::text[])
      order by p.created_at,p.id limit 1000`,
      [appointments.map((item) => item.id)],
    )
  ).rows;
  const names = new Map<string, { name: string | null; organization: string | null }>();
  for (const appt of appointments) {
    const own = rows.filter((row) => row.appointment_id === appt.id).slice(-10);
    const allowed =
      !!actor.wallet ||
      actor.administrator ||
      appt.advisorId === actor.userId ||
      own.some(
        (row) => row.user_id === actor.userId && ["invited", "confirmed"].includes(row.state),
      );
    if (!allowed || !own.length) continue;
    const items = [];
    for (const row of own) {
      if (!names.has(row.user_id)) names.set(row.user_id, await professional(db, row.user_id));
      items.push({
        id: row.id,
        ...names.get(row.user_id)!,
        state: row.state,
        termsCurrent: row.terms_revision === row.link_terms_revision,
        outcome: row.outcome,
      });
    }
    result.set(appt.id, items);
  }
  return result;
}

export function createJointAppointmentOperations(pool: Pool, transaction: Mutation) {
  async function reading<T>(actor: PartnerActor, action: (tx: PoolClient) => Promise<T>) {
    const tx = await pool.connect();
    try {
      await tx.query("begin");
      await lockActor(tx, actor);
      const result = await action(tx);
      await tx.query("commit");
      return result;
    } catch (cause) {
      await tx.query("rollback");
      failOnConcurrentAbort(cause);
      throw cause;
    } finally {
      tx.release();
    }
  }
  // The owner's view: participants, and their other open requests of the same subject whose
  // accepted professional is a current advisor and appears free at that time.
  async function walletView(
    tx: PoolClient,
    actor: PartnerActor,
    leadId: string,
    appointmentId: string,
  ) {
    if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const lead = await owned(tx, actor, leadId);
    const appt = await appointment(tx, appointmentId, leadId);
    const rows = (
      await tx.query<Participation & { title: string }>(
        `select p.*,l.title from partner_appointment_participants p join partner_leads l on l.id=p.lead_id
        where p.appointment_id=$1 order by p.created_at,p.id limit 50`,
        [appointmentId],
      )
    ).rows;
    const participants = [];
    for (const row of rows.slice(-10))
      participants.push({
        id: row.id,
        leadId: row.lead_id,
        leadTitle: row.title,
        ...(await professional(tx, row.user_id)),
        state: row.state,
        termsCurrent: termsCurrent(row, appt),
        outcome: row.outcome,
      });
    const engaged = rows.filter((row) => ["invited", "confirmed"].includes(row.state));
    const open =
      appt.state === "scheduled" &&
      appt.starts_at.getTime() > Date.now() &&
      !["draft", "completed"].includes(lead.stage);
    const requests = (
      await tx.query<Request>(
        `select ${request} from partner_leads l where ${ownedClient} and l.id<>$2
        and l.client_profile_id is not distinct from $3::text and l.stage not in ('draft','completed')
        and l.responsible_id is not null and l.assignment='accepted' and l.responsible_id<>$4
        and ${authorityCurrent("l")} order by l.created_at desc,l.id limit 20`,
        [actor.userId, leadId, lead.client_profile_id, appt.advisor_id],
      )
    ).rows;
    const candidates = [];
    for (const row of requests) {
      const userId = row.responsible_id!;
      if (engaged.some((item) => item.user_id === userId || item.lead_id === row.id)) continue;
      const member = await membership(tx, userId);
      if (!advisorFor(member, row.category)) continue;
      // A professional who declined or withdrew is not asked again for the same appointment.
      const declined = rows.some(
        (item) => item.user_id === userId && ["declined", "withdrawn"].includes(item.state),
      );
      const free =
        !declined &&
        open &&
        usable(await availability(tx, member, userId, appt, appt.starts_at.getTime(), ends(appt)));
      candidates.push({
        leadId: row.id,
        leadTitle: row.title,
        name: member!.name,
        organization: member!.organization,
        status: declined
          ? ("declined" as const)
          : free
            ? ("available" as const)
            : ("unavailable" as const),
      });
    }
    const value = {
      appointmentId,
      leadId,
      appointment: terms(appt),
      participants,
      candidates,
      canInvite: open && engaged.length < invitationLimit,
    };
    return {
      lead,
      appt,
      value: walletJointAppointmentSchema.parse({
        ...value,
        basis: hash({ actor: actor.userId, lead, appt, value }),
      }),
    };
  }
  // Participations of one request. The invited professional decides; the owner and the Admin
  // read; other readers of the request see none, since names would reveal the other request.
  async function participationsView(tx: PoolClient, actor: PartnerActor, leadId: string) {
    let lead: Request;
    if (actor.wallet) lead = await owned(tx, actor, leadId);
    else {
      const row = (
        await tx.query<Request>(
          `select ${request} from partner_leads l where l.id=$2 and ${visible(actor)}`,
          [actor.userId, leadId],
        )
      ).rows[0];
      if (!row) return fail("PARTNER_NOT_FOUND", 404);
      lead = row;
    }
    const all = !!actor.wallet || actor.administrator;
    const rows = (
      await tx.query<Participation>(
        `select * from partner_appointment_participants where lead_id=$1 and ($2::boolean or user_id=$3)
        order by created_at desc,id limit 20`,
        [leadId, all, actor.userId],
      )
    ).rows;
    const member = actor.wallet ? null : await membership(tx, actor.userId);
    const right = !actor.wallet && (await personalOn(tx, actor.userId, leadId));
    const items = [];
    for (const row of rows) {
      const appt = await appointment(tx, row.appointment_id);
      const mine = !actor.wallet && row.user_id === actor.userId;
      const current = termsCurrent(row, appt);
      const open = appt.state === "scheduled" && appt.starts_at.getTime() > Date.now();
      const check = mine
        ? await availability(tx, member, actor.userId, appt, appt.starts_at.getTime(), ends(appt))
        : null;
      const able =
        mine &&
        right &&
        advisorFor(member, lead.category) &&
        !["draft", "completed"].includes(lead.stage);
      const item = {
        id: row.id,
        appointmentId: row.appointment_id,
        leadId,
        revision: row.revision,
        state: row.state,
        termsCurrent: current,
        outcome: row.outcome,
        host: await professional(tx, appt.advisor_id),
        appointment: terms(appt),
        appointmentState: appt.state,
        check,
        canConfirm: able && open && row.state === "invited" && current && !!check && usable(check),
        canDecline: mine && open && row.state === "invited",
        canWithdraw: mine && open && row.state === "confirmed",
        canRecordOutcome:
          mine &&
          row.state === "confirmed" &&
          current &&
          !row.outcome &&
          appt.state !== "cancelled" &&
          appt.starts_at.getTime() <= Date.now(),
      };
      items.push({ ...item, basis: hash({ actor: actor.userId, lead, row, appt, item }) });
    }
    return jointParticipationsSchema.parse({ items });
  }
  return {
    walletJointAppointment: (actor: PartnerActor, leadId: string, appointmentId: string) =>
      reading(actor, async (tx) => (await walletView(tx, actor, leadId, appointmentId)).value),
    inviteJointParticipant(
      actor: PartnerActor,
      leadId: string,
      appointmentId: string,
      raw: JointInvitationInput,
      key: string,
    ) {
      const input = jointInvitationInputSchema.parse(raw);
      return transaction(
        actor,
        "joint.invite",
        key,
        { leadId, appointmentId, input },
        async (tx) => {
          if (!actor.wallet || input.leadId === leadId) fail("PARTNER_ACCESS_DENIED", 403);
          // Hosting request, appointment, invited request, plannings, subject; then fresh rights.
          // Each row is read after its lock, so the plannings locked are the current ones.
          await owned(tx, actor, leadId);
          await owned(tx, actor, input.leadId);
          await tx.query("select id from partner_leads where id=$1 for update", [leadId]);
          await tx.query(
            "select id from partner_appointments where id=$1 and lead_id=$2 for update",
            [appointmentId, leadId],
          );
          const locked = await appointment(tx, appointmentId, leadId);
          await tx.query("select id from partner_leads where id=$1 for update", [input.leadId]);
          const target = await owned(tx, actor, input.leadId);
          await lockPlanning(tx, [locked.advisor_id, target.responsible_id]);
          await lockSubject(tx, await owned(tx, actor, leadId));
          await lockActor(tx, actor);
          const { value, appt } = await walletView(tx, actor, leadId, appointmentId);
          if (value.basis !== input.basis) fail("PARTNER_CONFLICT", 409);
          const candidate = value.candidates.find((item) => item.leadId === input.leadId);
          if (!value.canInvite || candidate?.status !== "available")
            fail("PARTNER_ACTION_REQUIRED");
          const invited = await owned(tx, actor, input.leadId);
          const id = newId("pjoint");
          await tx.query(
            `insert into partner_appointment_participants(id,appointment_id,lead_id,user_id,invited_by,state,terms_revision,evidence)
            values($1,$2,$3,$4,$5,'invited',$6,$7)`,
            [
              id,
              appointmentId,
              invited.id,
              invited.responsible_id,
              actor.userId,
              appt.link_terms_revision,
              JSON.stringify({ invitation: { basis: input.basis, terms: value.appointment } }),
            ],
          );
          await tx.query(
            "update partner_leads set revision=revision+1,updated_at=now() where id=any($1::text[])",
            [[leadId, invited.id]],
          );
          const at = value.appointment.startsAt;
          await event(tx, actor, invited.id, "appointment.joint_invited.v1", at, "client", id);
          await event(tx, actor, leadId, "appointment.joint_invited.v1", at, "client", id);
          return appointmentId;
        },
        async (tx) => (await walletView(tx, actor, leadId, appointmentId)).value,
      );
    },
    jointParticipations: (actor: PartnerActor, leadId: string) =>
      reading(actor, (tx) => participationsView(tx, actor, leadId)),
    decideJointParticipation(
      actor: PartnerActor,
      leadId: string,
      participationId: string,
      raw: JointParticipationAction,
      key: string,
    ) {
      const input = jointParticipationActionSchema.parse(raw);
      return transaction(
        actor,
        "joint.decide",
        key,
        { leadId, participationId, input },
        async (tx) => {
          if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const seed = (
            await tx.query<Participation>(
              "select * from partner_appointment_participants where id=$1 and lead_id=$2",
              [participationId, leadId],
            )
          ).rows[0];
          if (!seed || seed.user_id !== actor.userId) fail("PARTNER_NOT_FOUND", 404);
          const host = await appointment(tx, seed.appointment_id);
          await tx.query("select id from partner_leads where id=$1 for update", [host.lead_id]);
          await tx.query("select id from partner_appointments where id=$1 for update", [host.id]);
          await tx.query("select id from partner_leads where id=$1 for update", [leadId]);
          await tx.query("select id from partner_appointment_participants where id=$1 for update", [
            participationId,
          ]);
          await lockPlanning(tx, [actor.userId]);
          const member = await membership(tx, actor.userId, true);
          await lockActor(tx, actor);
          const view = await participationsView(tx, actor, leadId);
          const item = view.items.find((entry) => entry.id === participationId);
          if (!item) return fail("PARTNER_NOT_FOUND", 404);
          if (item.basis !== input.basis) fail("PARTNER_CONFLICT", 409);
          const appt = await appointment(tx, host.id);
          const at = appt.starts_at.toISOString();
          switch (input.action) {
            case "confirm": {
              if (!item.canConfirm) fail("PARTNER_ACTION_REQUIRED");
              if (
                ["phone", "video"].includes(appt.mode) &&
                (input.travelBeforeMinutes !== 0 || input.travelAfterMinutes !== 0)
              )
                fail("PARTNER_ACTION_REQUIRED");
              const start =
                appt.starts_at.getTime() -
                (input.preparationMinutes + input.travelBeforeMinutes) * 60000;
              const end = ends(appt) + input.travelAfterMinutes * 60000;
              if (start <= Date.now()) fail("PARTNER_ACTION_REQUIRED");
              // Re-checked with the participant's own buffers; the database guard repeats it.
              const check = await availability(tx, member, actor.userId, appt, start, end);
              if (check.conflict) fail("PARTNER_APPOINTMENT_CONFLICT", 409);
              if (!usable(check)) fail("PARTNER_ACTION_REQUIRED");
              await tx.query(
                `update partner_appointment_participants set state='confirmed',terms_revision=$2,
                preparation_minutes=$3,travel_before_minutes=$4,travel_after_minutes=$5,revision=revision+1,
                decided_at=now(),evidence=evidence||$6::jsonb where id=$1`,
                [
                  participationId,
                  appt.link_terms_revision,
                  input.preparationMinutes,
                  input.travelBeforeMinutes,
                  input.travelAfterMinutes,
                  JSON.stringify({
                    confirmation: {
                      basis: input.basis,
                      check,
                      occupiedStartsAt: new Date(start).toISOString(),
                      occupiedEndsAt: new Date(end).toISOString(),
                      externalCommitmentsChecked: true,
                      capacityConfirmed: true,
                    },
                  }),
                ],
              );
              await tx.query(
                `update partner_leads set stage='appointment_scheduled',
                stage_changed_at=case when stage='appointment_scheduled' then stage_changed_at else now() end,
                first_useful_at=coalesce(first_useful_at,now()),next_action='Tenir le rendez-vous conjoint',
                due_at=$2,waiting=null,revision=revision+1,updated_at=now() where id=$1`,
                [leadId, appt.starts_at],
              );
              await event(
                tx,
                actor,
                leadId,
                "appointment.joint_confirmed.v1",
                at,
                "client",
                participationId,
              );
              await event(
                tx,
                actor,
                appt.lead_id,
                "appointment.joint_confirmed.v1",
                at,
                "client",
                participationId,
              );
              break;
            }
            case "decline":
              if (!item.canDecline) fail("PARTNER_ACTION_REQUIRED");
              await tx.query(
                "update partner_appointment_participants set state='declined',revision=revision+1,decided_at=now() where id=$1",
                [participationId],
              );
              await event(
                tx,
                actor,
                leadId,
                "appointment.joint_declined.v1",
                at,
                "client",
                participationId,
              );
              await event(
                tx,
                actor,
                appt.lead_id,
                "appointment.joint_declined.v1",
                at,
                "client",
                participationId,
              );
              break;
            case "withdraw":
              if (!item.canWithdraw) fail("PARTNER_ACTION_REQUIRED");
              await tx.query(
                `update partner_appointment_participants set state='withdrawn',revision=revision+1,decided_at=now(),
                evidence=evidence||$2::jsonb where id=$1`,
                [participationId, JSON.stringify({ withdrawal: { reason: input.reason } })],
              );
              await release(tx, leadId);
              await event(
                tx,
                actor,
                leadId,
                "appointment.joint_withdrawn.v1",
                at,
                "client",
                participationId,
              );
              await event(
                tx,
                actor,
                appt.lead_id,
                "appointment.joint_withdrawn.v1",
                at,
                "client",
                participationId,
              );
              break;
            case "outcome":
              if (!item.canRecordOutcome) fail("PARTNER_ACTION_REQUIRED");
              await tx.query(
                "update partner_appointment_participants set outcome=$2,revision=revision+1 where id=$1",
                [participationId, input.outcome],
              );
              // Each request keeps its own cycle: the outcome moves only the participant's request.
              if (input.outcome === "completed")
                await tx.query(
                  `update partner_leads set stage='appointment_completed',
                  stage_changed_at=case when stage='appointment_completed' then stage_changed_at else now() end,
                  revision=revision+1,updated_at=now() where id=$1`,
                  [leadId],
                );
              else await release(tx, leadId);
              await event(
                tx,
                actor,
                leadId,
                "appointment.joint_outcome.v1",
                input.outcome,
                "client",
                participationId,
              );
              break;
          }
          return participationId;
        },
        async (tx) => participationsView(tx, actor, leadId),
      );
    },
  };
}
