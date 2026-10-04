import type { PoolClient } from "pg";
import type { LeadCommand } from "@coverview/contracts/partner";
import { leadReopeningsSchema } from "@coverview/contracts/partner-lifecycle";
import { fail, type Executor, type PartnerActor } from "./partner.policy.js";
import { lockContractSubject } from "./partner.contract.js";
import { economyCursor, economyNext } from "./partner.commercial.js";
import { event, newId } from "./partner.audit.js";
import type { partnerLeads } from "./partner.schema.js";
type Lead = typeof partnerLeads.$inferSelect;
const subject = (lead: Lead) =>
  lead.clientProfileId
    ? `profile:${lead.clientProfileId}`
    : lead.clientUserId
      ? `self:${lead.clientUserId}`
      : `lead:${lead.id}`;
async function available(db: Executor) {
  return !!(
    await db.query<{ table: string | null }>(
      "select to_regclass('partner_lead_reopenings')::text as table",
    )
  ).rows[0]?.table;
}
export async function reopenLead(
  tx: PoolClient,
  actor: PartnerActor,
  rawLead: Lead,
  input: Extract<LeadCommand, { action: "reopen" }>,
) {
  if (!(await available(tx))) fail("PARTNER_UNAVAILABLE", 503);
  if (
    (
      await tx.query<{ table: string | null }>(
        "select to_regclass('partner_lead_relationships')::text as table",
      )
    ).rows[0]?.table &&
    (
      await tx.query(
        "select id from partner_lead_relationships where source_lead_id=$1 and kind='duplicate' and withdrawn_at is null and invalidated_at is null limit 1",
        [rawLead.id],
      )
    ).rowCount
  )
    fail("PARTNER_ACTION_REQUIRED");
  const lead = rawLead.clientUserId
    ? { ...rawLead, ...(await lockContractSubject(tx, rawLead)) }
    : rawLead;
  if (actor.wallet || lead.stage !== "completed" || !lead.result || !lead.reason)
    fail("PARTNER_INVALID_TRANSITION");
  const now = (await tx.query<{ at: Date }>("select clock_timestamp() at")).rows[0]!.at;
  if (Date.parse(input.dueAt) <= now.getTime()) fail("PARTNER_ACTION_REQUIRED");
  const id = newId("preopen");
  await tx.query(
    `insert into partner_lead_reopenings(id,lead_id,actor_id,owner_id,subject_key,lead_revision,closed_result,closed_reason,closed_at,reopened_at,reason,next_action,due_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      id,
      lead.id,
      actor.userId,
      lead.clientUserId,
      subject(lead),
      lead.revision,
      lead.result,
      lead.reason,
      lead.stageChangedAt,
      now,
      input.reason,
      input.nextAction,
      input.dueAt,
    ],
  );
  await tx.query(
    `update partner_leads set stage='qualifying',stage_changed_at=clock_timestamp(),result=null,reason=null,
    next_action=$2,due_at=$3,waiting=null where id=$1`,
    [lead.id, input.nextAction, input.dueAt],
  );
  await event(tx, actor, lead.id, "lead.reopened.v1", "", "client", id);
}
// Caller has checked current session/visibility and full operational or Wallet access.
export async function readLeadReopenings(db: Executor, rawLead: Lead, cursor?: string) {
  if (!(await available(db))) return fail("PARTNER_UNAVAILABLE", 503);
  const lead = rawLead.clientUserId
      ? { ...rawLead, ...(await lockContractSubject(db, rawLead)) }
      : rawLead,
    [at, id] = economyCursor(cursor);
  const rows = (
    await db.query<{
      id: string;
      lead_id: string;
      actor_id: string;
      closed_result: string;
      closed_reason: string;
      closed_at: Date;
      reopened_at: Date;
      reason: string;
      next_action: string;
      due_at: Date;
    }>(
      `select * from partner_lead_reopenings
      where lead_id=$1 and owner_id is not distinct from $2 and subject_key=$3 and ($4::timestamptz is null or (reopened_at,id)<($4,$5))
      order by reopened_at desc,id desc limit 21`,
      [lead.id, lead.clientUserId, subject(lead), at, id],
    )
  ).rows;
  return leadReopeningsSchema.parse({
    items: rows.slice(0, 20).map((r) => ({
      id: r.id,
      leadId: r.lead_id,
      actorId: r.actor_id,
      closedResult: r.closed_result,
      closedReason: r.closed_reason,
      closedAt: r.closed_at.toISOString(),
      reopenedAt: r.reopened_at.toISOString(),
      reason: r.reason,
      nextAction: r.next_action,
      dueAt: r.due_at.toISOString(),
    })),
    nextCursor:
      rows.length > 20
        ? economyNext({ id: rows[19]!.id, created_at: rows[19]!.reopened_at })
        : null,
  });
}
