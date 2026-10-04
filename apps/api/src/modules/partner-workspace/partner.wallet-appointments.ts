import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  walletAppointmentSchema,
  walletAppointmentCancellationSchema,
  type WalletAppointmentCancellation,
} from "@coverview/contracts/partner";
import {
  fail,
  lockActor,
  ownedClient,
  type PartnerActor,
  failOnConcurrentAbort,
} from "./partner.policy.js";
import { event } from "./partner.audit.js";

type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type Subject = {
  id: string;
  client_profile_id: string | null;
  client_user_id: string | null;
  owner_id: string | null;
  profile_revision: number;
  revision: number;
  advice_scope_revision: number;
  stage: string;
};
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

async function subject(tx: PoolClient, actor: PartnerActor, id: string) {
  const lead = (
    await tx.query<Subject>(
      `select l.id,l.client_user_id,l.client_profile_id,
    l.revision,l.advice_scope_revision,l.stage,
    case when l.client_profile_id is null then l.client_user_id else p.user_id end owner_id,
    case when l.client_profile_id is null then coalesce(ip.revision,0) else p.revision end profile_revision
    from partner_leads l left join managed_profiles p on p.id=l.client_profile_id
    left join identity_profiles ip on ip.user_id=l.client_user_id
    where l.id=$2 and (${ownedClient})`,
      [actor.userId, id],
    )
  ).rows[0];
  if (!lead) return fail("PARTNER_NOT_FOUND", 404);
  return lead;
}

// Use the same Lead → appointment → advisor planning → canonical subject order as rescheduling.
// All projections, including idempotent retries, re-authorize after the final blocking lock.
async function locked(tx: PoolClient, actor: PartnerActor, leadId: string, appointmentId: string) {
  if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
  await lockActor(tx, actor);
  await subject(tx, actor, leadId);
  await tx.query("select id from partner_leads where id=$1 for update", [leadId]);
  const appointment = (
    await tx.query<Appointment>(
      `select id,lead_id,advisor_id,starts_at,duration_minutes,mode,location,timezone,state,link_terms_revision
       from partner_appointments where id=$1 and lead_id=$2 for update`,
      [appointmentId, leadId],
    )
  ).rows[0];
  if (!appointment) return fail("PARTNER_NOT_FOUND", 404);
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1,1))", [appointment.advisor_id]);
  const before = await subject(tx, actor, leadId);
  if (before.client_profile_id)
    await tx.query("select id from managed_profiles where id=$1 for share", [
      before.client_profile_id,
    ]);
  else
    await tx.query("select user_id from identity_profiles where user_id=$1 for share", [
      before.client_user_id,
    ]);
  await lockActor(tx, actor);
  const lead = await subject(tx, actor, leadId);
  const advisor = (
    await tx.query<{ name: string | null }>(
      "select application->>'name' name from partner_members where user_id=$1",
      [appointment.advisor_id],
    )
  ).rows[0];
  const basis = createHash("sha256")
    .update(
      JSON.stringify({
        actor: actor.userId,
        lead,
        appointment,
      }),
    )
    .digest("hex");
  const value = walletAppointmentSchema.parse({
    appointmentId,
    leadId,
    advisorName: advisor?.name ?? null,
    appointment: {
      startsAt: appointment.starts_at.toISOString(),
      durationMinutes: appointment.duration_minutes,
      mode: appointment.mode,
      location: appointment.location,
      timezone: appointment.timezone,
    },
    state: appointment.state,
    basis,
    canCancel:
      appointment.state === "scheduled" &&
      appointment.starts_at.getTime() > Date.now() &&
      !["draft", "completed"].includes(lead.stage),
  });
  return { lead, appointment, value };
}

export function createWalletAppointmentOperations(pool: Pool, transaction: Mutation) {
  return {
    async walletAppointment(actor: PartnerActor, leadId: string, appointmentId: string) {
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        const { value } = await locked(tx, actor, leadId, appointmentId);
        await tx.query("commit");
        return value;
      } catch (cause) {
        await tx.query("rollback");
        failOnConcurrentAbort(cause);
        throw cause;
      } finally {
        tx.release();
      }
    },
    async cancelWalletAppointment(
      actor: PartnerActor,
      leadId: string,
      appointmentId: string,
      input: WalletAppointmentCancellation,
      key: string,
    ) {
      const parsed = walletAppointmentCancellationSchema.parse(input);
      return transaction(
        actor,
        "wallet.appointment.cancel",
        key,
        { leadId, appointmentId, input: parsed },
        async (tx) => {
          const { lead, appointment, value } = await locked(tx, actor, leadId, appointmentId);
          if (!value.canCancel || value.basis !== parsed.basis) fail("PARTNER_CONFLICT", 409);
          await tx.query("update partner_appointments set state='cancelled' where id=$1", [
            appointmentId,
          ]);
          await tx.query(
            `update partner_leads l set
          stage=case when stage='appointment_scheduled' and not exists(select 1 from partner_appointments a
            where a.lead_id=l.id and a.state='scheduled' and a.starts_at>clock_timestamp())
            then 'appointment_needed' else stage end,
          stage_changed_at=case when stage='appointment_scheduled' and not exists(select 1 from partner_appointments a
            where a.lead_id=l.id and a.state='scheduled' and a.starts_at>clock_timestamp())
            then clock_timestamp() else stage_changed_at end,
          next_action=case when next_action='Tenir le rendez-vous convenu' and due_at=$2 and waiting is null
            then 'Recontacter le client pour convenir de la suite' else next_action end,
          due_at=case when next_action='Tenir le rendez-vous convenu' and due_at=$2 and waiting is null
            then least(due_at,clock_timestamp()) else due_at end,
          revision=revision+1,updated_at=clock_timestamp() where id=$1`,
            [leadId, appointment.starts_at],
          );
          await event(
            tx,
            actor,
            null,
            "appointment.wallet_cancellation_recorded.v1",
            JSON.stringify({
              leadId,
              subject: lead.client_profile_id ?? lead.client_user_id,
              ownerId: lead.owner_id,
              profileRevision: lead.profile_revision,
              leadRevision: lead.revision,
              termsRevision: appointment.link_terms_revision,
              terms: value.appointment,
              basis: parsed.basis,
            }),
            "private",
            appointmentId,
          );
          await event(
            tx,
            actor,
            leadId,
            "client.appointment_cancelled.v1",
            parsed.reason,
            "client",
            appointmentId,
          );
          return appointmentId;
        },
        async (tx, id) => (await locked(tx, actor, leadId, id)).value,
      );
    },
  };
}
