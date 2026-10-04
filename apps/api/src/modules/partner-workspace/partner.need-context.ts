import { readAdvicePreferences, type AdviceTarget } from "./partner.advice.js";
import { readLeadReferentState } from "./partner.referents.js";
import type { PartnerApplication } from "@coverview/contracts/partner";
import type { Executor, PartnerActor } from "./partner.policy.js";

export type PersonalNeedTarget = AdviceTarget & {
  responsibleId: string | null;
  assignment: string;
  notificationCycle: number;
};
export const personalNeedSubject = (lead: PersonalNeedTarget) =>
  lead.clientProfileId
    ? `profile:${lead.clientProfileId}`
    : lead.clientUserId
      ? `self:${lead.clientUserId}`
      : `unlinked:${lead.adviceScopeRevision}`;

// Caller enforces the personal audience and actor/member/Lead locks. This read also guards
// the canonical profile. These are context revisions, never a decision on the need.
export async function readPersonalNeedContext(
  db: Executor,
  actor: PartnerActor,
  lead: PersonalNeedTarget,
  member: PartnerApplication | null,
) {
  const preferences = await readAdvicePreferences(db, actor, lead);
  const { selection: referent, status } = await readLeadReferentState(db, lead);
  const mandate = (
    await db.query<{
      id: string;
      collaboration_id: string | null;
      access_scope: string;
      can_edit: boolean;
      can_contact: boolean;
    }>(
      `select id,collaboration_id,access_scope,can_edit,can_contact from partner_contributors
       where lead_id=$1 and user_id=$2 and revoked_at is null order by id limit 100`,
      [lead.id, actor.userId],
    )
  ).rows;
  const change =
    (
      await db.query<{ id: string; resolved_at: Date | null }>(
        `select id,resolved_at from partner_notifications where lead_id=$1
         and kind='interlocutor_request' order by created_at desc,id desc limit 1`,
        [lead.id],
      )
    ).rows[0] ?? null;
  return {
    preferences,
    changeRequested: status === "client_change_requested",
    fingerprintBasis: {
      subject: personalNeedSubject(lead),
      owner: lead.clientUserId,
      scope: lead.adviceScopeRevision,
      profile: preferences.profileRevision,
      professional: member && [member.organizationId, member.professionalRevision, member.revision],
      mandate: [lead.responsibleId, lead.assignment, lead.notificationCycle, mandate],
      preferences: [preferences.revision, preferences.status],
      referent: referent?.revision ?? 0,
      change,
    },
  };
}
