import type { Pool, PoolClient } from "pg";
import { event, type PartnerAuditActor } from "./partner.audit.js";
import { handoffWork } from "./partner.participants.js";
import { reconcileCollaborations } from "./partner.collaboration.js";
import { syncLeadNotifications } from "./partner.notifications.js";
import { followUpDeadline } from "./partner.follow-up.js";
import { authorityCurrent } from "./partner.policy.js";
import { currentContinuityPolicy } from "./partner.settings.js";
import { syncAnalysisNotice } from "./partner.recommendations.js";
import {
  automaticChain,
  computeMatching,
  readMatchingLead,
  recordMatchingDecision,
} from "./partner.matching.js";

const system: PartnerAuditActor = { userId: null, systemActor: "partner-continuity-v1" };
// An offer lapses and a source changes without any command: the analysis notice is read again on
// each tick for a request with reviewed offers or an open notice (C8e).
async function reassessAnalysis(tx: PoolClient, id: string) {
  const lead = (
    await tx.query<{
      responsible_id: string | null;
      client_user_id: string | null;
      client_profile_id: string | null;
    }>(
      `select responsible_id,client_user_id,client_profile_id from partner_leads l where id=$1
       and (exists(select 1 from partner_offers o where o.lead_id=l.id and o.reviewed_at is not null)
         or exists(select 1 from partner_notifications n where n.dedupe_key=l.id||':analysis_incomplete' and n.resolved_at is null))`,
      [id],
    )
  ).rows[0];
  if (lead)
    await syncAnalysisNotice(tx, {
      id,
      responsibleId: lead.responsible_id,
      clientUserId: lead.client_user_id,
      clientProfileId: lead.client_profile_id,
    });
}
// Bounded automatic proposals to the next eligible person, never to anyone already tried in the
// chain; the person still has to accept. Beyond the bound, the human CoverView queue takes over.
async function proposeAutomatically(
  tx: PoolClient,
  id: string,
  previous: string,
  stillValid: boolean,
) {
  const { policy } = await currentContinuityPolicy(tx);
  const chain = await automaticChain(tx, id);
  if (chain.count >= policy.automaticReassignments) return false;
  const lead = await readMatchingLead(tx, id);
  const matching = await computeMatching(tx, lead, [previous, ...chain.tried]);
  const next = matching.candidates[0];
  if (!next) return false;
  const { cycle } = (
    await tx.query<{ cycle: number }>(
      "update partner_leads set responsible_id=$2,assignment='proposed',notified_at=null,first_action_due_at=null,acceptance_due_at=null,continuity_policy_revision=null,first_useful_at=null,waiting=null,notification_cycle=notification_cycle+1,revision=revision+1,updated_at=now() where id=$1 returning notification_cycle cycle",
      [id, next.userId],
    )
  ).rows[0]!;
  await tx.query(
    "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2 and revoked_at is null",
    [id, previous],
  );
  await handoffWork(tx, system, id, next.userId);
  await recordMatchingDecision(tx, {
    leadId: id,
    cycle,
    kind: "automatic",
    actorId: null,
    chosenUserId: next.userId,
    reason: stillValid
      ? "Délai de prise en charge dépassé sans attente justifiée."
      : "Habilitation de l'intervenant précédent expirée.",
    matching,
  });
  await event(tx, system, id, "lead.reassigned_automatically", "", "coverview", previous);
  await event(
    tx,
    system,
    id,
    "lead.assigned",
    "Votre demande est proposée à un nouvel intervenant, qui doit encore confirmer sa prise en charge.",
    "client",
    next.userId,
  );
  await syncLeadNotifications(tx, id);
  return true;
}
const eligible = (
  user: string,
) => `exists(select 1 from identity_users u where u.id=${user} and not u.global_revocation_pending and (
  exists(select 1 from identity_admin_permissions p where p.user_id=u.id and p.permission='administration.access' and p.revoked_at is null)
  or exists(select 1 from partner_members m join partner_organizations o on o.id=m.organization_id where m.user_id=u.id and m.state='approved' and o.state='approved' and m.roles ? 'advisor' and m.application->'categories' ? l.category and (m.review_due_at is null or m.review_due_at>now()))))`;

export async function processPartnerContinuity(pool: Pool) {
  const tx = await pool.connect();
  try {
    await tx.query("begin");
    await tx.query("set local lock_timeout='2s'");
    await tx.query("set local statement_timeout='10s'");
    const rows = (
      await tx.query<{ id: string }>(
        `select id from partner_leads where stage not in ('draft','completed') and (continuity_checked_at is null or continuity_checked_at<now()-interval '1 minute')
       order by continuity_checked_at nulls first,id limit 50 for update skip locked`,
      )
    ).rows;
    let escalated = 0;
    for (const { id } of rows) {
      const removed = await tx.query(
        `update partner_contributors pc set revoked_at=now() from partner_leads l where l.id=$1 and pc.lead_id=l.id and pc.revoked_at is null and (not ${eligible("pc.user_id")} or not ${authorityCurrent("pc")})`,
        [id],
      );
      if (removed.rowCount) {
        await event(tx, system, id, "lead.contributor_access_expired", "", "coverview");
        const current = (
          await tx.query<{ responsible_id: string | null }>(
            "select responsible_id from partner_leads where id=$1",
            [id],
          )
        ).rows[0];
        await handoffWork(tx, system, id, current?.responsible_id ?? null);
        await tx.query(
          "update partner_leads set revision=revision+1,updated_at=now() where id=$1",
          [id],
        );
      }
      await syncLeadNotifications(tx, id);
      await reassessAnalysis(tx, id);
      const row = (
        await tx.query<{
          responsible_id: string | null;
          valid: boolean;
          notified_at: Date | null;
          first_action_due_at: Date | null;
          acceptance_due_at: Date | null;
          first_useful_at: Date | null;
          due_at: Date | null;
          waiting: { until: string } | null;
          now: Date;
        }>(
          `select responsible_id,(${eligible("l.responsible_id")} and ${authorityCurrent("l")}) valid,waiting,now() as now,notified_at,first_useful_at,due_at,first_action_due_at,acceptance_due_at
         from partner_leads l where id=$1`,
          [id],
        )
      ).rows[0];
      if (row?.responsible_id) {
        const waitingUntil = row.waiting ? new Date(row.waiting.until).getTime() : 0;
        const suspended = waitingUntil > row.now.getTime();
        const deadline = followUpDeadline({
          notifiedAt: row.notified_at,
          firstActionDueAt: row.first_action_due_at,
          acceptanceDueAt: row.acceptance_due_at,
          firstUsefulAt: row.first_useful_at,
          dueAt: row.due_at,
          waiting: row.waiting,
        }).escalationDueAt;
        if (!row.valid || (!suspended && deadline && row.now.getTime() >= deadline.getTime())) {
          const previous = row.responsible_id;
          if (await proposeAutomatically(tx, id, previous, row.valid)) {
            escalated += 1;
            await reconcileCollaborations(tx, id, system);
            await tx.query("update partner_leads set continuity_checked_at=now() where id=$1", [
              id,
            ]);
            continue;
          }
          await tx.query(
            "update partner_leads set responsible_id=null,assignment='coverview',waiting=null,revision=revision+1,updated_at=now() where id=$1",
            [id],
          );
          await tx.query(
            "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=$2 and revoked_at is null",
            [id, previous],
          );
          await handoffWork(tx, system, id, null);
          await event(tx, system, id, "lead.continuity_escalated", "", "client", previous);
          await event(
            tx,
            system,
            id,
            row.valid ? "lead.follow_up_overdue" : "lead.advisor_access_expired",
            "",
            "coverview",
            previous,
          );
          await syncLeadNotifications(tx, id);
          escalated += 1;
        }
      }
      await reconcileCollaborations(tx, id, system);
      await tx.query("update partner_leads set continuity_checked_at=now() where id=$1", [id]);
    }
    await tx.query("commit");
    return { checked: rows.length, escalated };
  } catch (error) {
    await tx.query("rollback");
    throw error;
  } finally {
    tx.release();
  }
}
