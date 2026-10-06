import type { PoolClient } from "pg";
import type { partnerLeads } from "./partner.schema.js";
import {
  authorityCurrent,
  engageable,
  fail,
  membership,
  type PartnerActor,
} from "./partner.policy.js";
import { event, type PartnerAuditActor } from "./partner.audit.js";
import { leaveJointAppointments, settleJointAppointments } from "./partner.joint-appointments.js";
type LeadRow = typeof partnerLeads.$inferSelect;
export async function requireAssignee(
  tx: PoolClient,
  lead: LeadRow,
  userId: string,
  actor: PartnerActor,
) {
  if (actor.administrator && userId === actor.userId) return;
  const person = await membership(tx, userId, true);
  if (
    !person ||
    person.state !== "approved" ||
    person.organizationState !== "approved" ||
    !person.grantedRoles.includes("advisor") ||
    !person.categories.includes(lead.category as (typeof person.categories)[number]) ||
    (person.reviewDueAt && new Date(person.reviewDueAt).getTime() <= Date.now())
  )
    fail("PARTNER_INVALID_ASSIGNEE");
}
/** A new responsibility or contribution also respects the CoverView restrictions (C8a). */
export async function requireNewEngagement(
  tx: PoolClient,
  lead: LeadRow,
  userId: string,
  actor: PartnerActor,
) {
  await requireAssignee(tx, lead, userId, actor);
  if (actor.administrator && userId === actor.userId) return;
  if (!engageable(await membership(tx, userId, true), lead.category))
    fail("PARTNER_INVALID_ASSIGNEE");
}
export async function requireParticipant(
  tx: PoolClient,
  lead: LeadRow,
  userId: string,
  actor: PartnerActor,
) {
  await requireAssignee(tx, lead, userId, actor);
  if (
    (userId === lead.responsibleId &&
      (!lead.marketValidUntil || lead.marketValidUntil.getTime() > Date.now())) ||
    (userId === actor.userId && actor.administrator)
  )
    return;
  const participant = await tx.query<Record<string, unknown>>(
    `select id from partner_contributors pc where lead_id=$1 and user_id=$2 and revoked_at is null and ${authorityCurrent("pc")} and access_scope='advice' and can_edit`,
    [lead.id, userId],
  );
  if (!participant.rowCount) fail("PARTNER_INVALID_ASSIGNEE");
}
export async function handoffWork(
  tx: PoolClient,
  actor: PartnerAuditActor,
  leadId: string,
  responsibleId: string | null,
) {
  // Future commitments cannot stay assigned to an intervenant who no longer has access.
  const remainingParticipant = `exists(select 1 from partner_contributors pc where pc.lead_id=$1 and pc.user_id=a.advisor_id and pc.revoked_at is null and ${authorityCurrent("pc")} and pc.access_scope='advice' and pc.can_edit and pc.can_contact)`;
  const cancelled = await tx.query<{ id: string }>(
    `update partner_appointments a set state='cancelled' where lead_id=$1 and state='scheduled' and starts_at>now() and advisor_id is distinct from $2 and not ${remainingParticipant} returning a.id`,
    [leadId, responsibleId],
  );
  // Joint appointments follow (C6b): hosted ones end their participations, and a professional
  // who lost the personal right on this request leaves the appointments joined through it.
  await settleJointAppointments(
    tx,
    actor,
    cancelled.rows.map((row) => row.id),
  );
  await leaveJointAppointments(tx, actor, leadId, false);
  if (responsibleId)
    await tx.query(
      `update partner_tasks t set responsible_id=$2 where lead_id=$1 and state='open' and responsible_id<>$2 and not exists(select 1 from partner_contributors pc where pc.lead_id=$1 and pc.user_id=t.responsible_id and pc.revoked_at is null and ${authorityCurrent("pc")} and pc.access_scope='advice' and pc.can_edit)`,
      [leadId, responsibleId],
    );
  if (cancelled.rowCount) {
    await tx.query(
      "update partner_leads set stage='appointment_needed',stage_changed_at=now(),next_action='Replanifier le rendez-vous avec le client' where id=$1 and stage='appointment_scheduled' and not exists(select 1 from partner_appointments where lead_id=$1 and state='scheduled' and starts_at>now())",
      [leadId],
    );
    await event(
      tx,
      actor,
      leadId,
      "appointment.cancelled",
      "Le rendez-vous avec l’intervenant sortant doit être replanifié. CoverView suit la reprise du dossier.",
      "client",
    );
  }
}
