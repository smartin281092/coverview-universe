import type { Pool } from "pg";
import { event, type PartnerAuditActor } from "./partner.audit.js";
import { handoffWork } from "./partner.participants.js";
import { reconcileCollaborations } from "./partner.collaboration.js";
import { syncLeadNotifications } from "./partner.notifications.js";
import { followUpDeadline } from "./partner.follow-up.js";
import { authorityCurrent } from "./partner.policy.js";

const system: PartnerAuditActor = { userId: null, systemActor: "partner-continuity-v1" };
// Full matching is not connected yet: zero automatic assignments to another advisor.
// A single escalation moves the Lead to the human CoverView queue, never around a loop.
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
