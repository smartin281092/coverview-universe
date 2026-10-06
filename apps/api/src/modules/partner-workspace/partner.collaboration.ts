import type { PoolClient } from "pg";
import {
  collaborationSchema,
  collaborationTermsSchema,
  type CollaborationResponse,
  type CollaborationTerms,
} from "@coverview/contracts/partner";
import type { partnerLeads } from "./partner.schema.js";
import { camel, date, fail, visible, type Executor, type PartnerActor } from "./partner.policy.js";
import { event, newId, type PartnerAuditActor } from "./partner.audit.js";
import { handoffWork, requireAssignee, requireNewEngagement } from "./partner.participants.js";
import { notifyCollaboration, syncLeadNotifications } from "./partner.notifications.js";
type LeadRow = typeof partnerLeads.$inferSelect;

export async function readCollaborations(
  db: Executor,
  actor: PartnerActor,
  leadId?: string,
  id?: string,
) {
  const rows = (
    await db.query<Record<string, unknown>>(
      `select c.*, coalesce(p.application->>'name','CoverView') proposer_name,
     coalesce(t.application->>'name','') target_name, l.responsible_id,
     (${visible(actor)}) can_open_lead
     from partner_collaborations c join partner_leads l on l.id=c.lead_id
     left join partner_members p on p.user_id=c.proposer_id left join partner_members t on t.user_id=c.target_id
     where (c.proposer_id=$1 or c.target_id=$1 or c.previous_responsible_id=$1 or ${actor.administrator ? "true" : `l.responsible_id=$1 and (${visible(actor)})`})
     and ($2::text is null or c.lead_id=$2) and ($3::text is null or c.id=$3)
     order by (c.state='proposed') desc,c.created_at desc,c.id desc limit 100`,
      [actor.userId, leadId ?? null, id ?? null],
    )
  ).rows;
  return rows.map((r) => {
    const terms = collaborationTermsSchema.parse(r.terms);
    const controls = actor.administrator || r.responsible_id === actor.userId;
    return collaborationSchema.parse({
      ...camel<Record<string, unknown>>(r),
      terms,
      createdAt: date(r.created_at as Date),
      decidedAt: date(r.decided_at as Date | null),
      endedAt: date(r.ended_at as Date | null),
      canRespond: r.state === "proposed" && r.target_id === actor.userId,
      canEnd:
        r.state === "proposed"
          ? controls || r.proposer_id === actor.userId
          : r.state === "accepted" &&
            terms.mode === "co_advice" &&
            (controls || r.target_id === actor.userId),
    });
  });
}

export async function proposeCollaboration(
  tx: PoolClient,
  actor: PartnerActor,
  lead: LeadRow,
  terms: CollaborationTerms,
) {
  if (!actor.administrator && lead.responsibleId !== actor.userId)
    fail("PARTNER_ACCESS_DENIED", 403);
  if (
    !lead.responsibleId ||
    lead.responsibleId === terms.targetId ||
    actor.userId === terms.targetId
  )
    fail("PARTNER_INVALID_ASSIGNEE");
  await requireNewEngagement(tx, lead, terms.targetId, actor);
  if (!(lead.details as { transmissionAuthorized: boolean }).transmissionAuthorized)
    fail("PARTNER_ACTION_REQUIRED");
  const exists = await tx.query(
    `select id from partner_collaborations where lead_id=$1 and target_id=$2 and state='proposed'
     union all select id from partner_contributors where lead_id=$1 and user_id=$2 and revoked_at is null and $3='co_advice'`,
    [lead.id, terms.targetId, terms.mode],
  );
  if (exists.rowCount) fail("PARTNER_CONFLICT", 409);
  const id = newId("pcoll");
  await tx.query(
    `insert into partner_collaborations(id,lead_id,proposer_id,target_id,previous_responsible_id,category,terms)
    values($1,$2,$3,$4,$5,$6,$7)`,
    [
      id,
      lead.id,
      actor.userId,
      terms.targetId,
      lead.responsibleId,
      lead.category,
      JSON.stringify(terms),
    ],
  );
  await event(
    tx,
    actor,
    lead.id,
    "collaboration.proposed",
    terms.reason,
    "assigned",
    terms.targetId,
  );
  await notifyCollaboration(tx, id, "proposed");
  return id;
}

// Called with the Lead lock by commands and the continuity worker. Terms are never edited.
export async function reconcileCollaborations(
  db: Executor,
  leadId: string,
  actor: PartnerAuditActor,
) {
  const cancelled = await db.query<{ id: string }>(
    `update partner_collaborations c
    set state='cancelled',decided_at=now(),revision=c.revision+1
    from partner_leads l where l.id=$1 and c.lead_id=l.id and c.state='proposed' and
    (l.stage='completed' or l.responsible_id is distinct from c.previous_responsible_id or l.category<>c.category
     or not exists(select 1 from partner_members m join partner_organizations o on o.id=m.organization_id
       where m.user_id=c.target_id and m.state='approved' and o.state='approved' and m.roles ? 'advisor'
       and m.application->'categories' ? l.category and (m.review_due_at is null or m.review_due_at>now()))) returning c.id`,
    [leadId],
  );
  for (const row of cancelled.rows) {
    await notifyCollaboration(db, row.id, "cancelled");
    await event(db, actor, leadId, "collaboration.cancelled", "", "assigned", row.id);
  }
  const ended = await db.query<{ id: string; target_id: string }>(
    `update partner_collaborations c set state='ended',ended_at=now(),revision=revision+1
    where c.lead_id=$1 and c.state='accepted' and c.terms->>'mode'='co_advice'
    and not exists(select 1 from partner_contributors pc where pc.collaboration_id=c.id and pc.revoked_at is null)
    returning c.id,c.target_id`,
    [leadId],
  );
  for (const row of ended.rows) {
    await notifyCollaboration(db, row.id, "ended");
    await event(db, actor, leadId, "collaboration.ended", "", "client", row.target_id);
  }
}

export async function respondCollaboration(
  tx: PoolClient,
  actor: PartnerActor,
  id: string,
  input: CollaborationResponse,
) {
  // Lock the Lead before the proposal, matching all other mutations.
  const row = (
    await tx.query<Record<string, unknown>>(
      `select l.* from partner_leads l
    join partner_collaborations c on c.lead_id=l.id where c.id=$1
    and (c.target_id=$2 or c.proposer_id=$2 or l.responsible_id=$2 or $3) for update of l`,
      [id, actor.userId, actor.administrator],
    )
  ).rows[0];
  if (!row) return fail("PARTNER_NOT_FOUND", 404);
  const lead = camel<LeadRow>(row);
  await reconcileCollaborations(tx, lead.id, actor);
  const proposal = (
    await tx.query<Record<string, unknown>>(
      "select * from partner_collaborations where id=$1 for update",
      [id],
    )
  ).rows[0]!;
  if (proposal.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
  const terms = collaborationTermsSchema.parse(proposal.terms);
  const owner = actor.administrator || lead.responsibleId === actor.userId;
  const target = actor.userId === terms.targetId;
  if (["accept", "decline"].includes(input.decision) && !target) fail("PARTNER_ACCESS_DENIED", 403);
  if (input.decision === "cancel" && !owner && proposal.proposer_id !== actor.userId)
    fail("PARTNER_ACCESS_DENIED", 403);
  if (input.decision === "end" && ((!owner && !target) || terms.mode !== "co_advice"))
    fail("PARTNER_ACCESS_DENIED", 403);
  if (proposal.state !== (input.decision === "end" ? "accepted" : "proposed"))
    fail("PARTNER_INVALID_TRANSITION");
  let state: string;
  if (input.decision === "accept") {
    if (
      ["draft", "completed"].includes(lead.stage) ||
      lead.responsibleId !== proposal.previous_responsible_id ||
      lead.category !== proposal.category
    )
      fail("PARTNER_INVALID_TRANSITION");
    await requireNewEngagement(tx, lead, terms.targetId, actor);
    // The proposer must still control the Lead or hold the actual admin permission.
    const permitted = await tx.query(
      "select id from identity_users where id=$1 and not global_revocation_pending for share",
      [proposal.proposer_id],
    );
    if (!permitted.rowCount) fail("PARTNER_ACCESS_DENIED", 403);
    const administrator = await tx.query(
      "select id from identity_admin_permissions where user_id=$1 and permission='administration.access' and revoked_at is null for share",
      [proposal.proposer_id],
    );
    if (!administrator.rowCount) {
      if (proposal.proposer_id !== lead.responsibleId) fail("PARTNER_ACCESS_DENIED", 403);
      await requireAssignee(tx, lead, String(proposal.proposer_id), {
        ...actor,
        administrator: false,
      });
    }
    if (terms.mode === "co_advice") {
      await tx.query(
        `insert into partner_contributors(id,lead_id,user_id,can_edit,can_contact,collaboration_id)
        values($1,$2,$3,$4,$5,$6)`,
        [
          newId("pcon"),
          lead.id,
          terms.targetId,
          terms.access === "contribute",
          terms.communication === "client_direct",
          id,
        ],
      );
    } else {
      await tx.query(
        "update partner_contributors set revoked_at=now() where lead_id=$1 and user_id=any($2::text[]) and revoked_at is null",
        [lead.id, [lead.responsibleId, terms.targetId]],
      );
      if (terms.mode === "one_off")
        await tx.query(
          `insert into partner_contributors(id,lead_id,user_id,can_edit,can_contact,access_scope,collaboration_id)
        values($1,$2,$3,false,false,'progress',$4)`,
          [newId("pcon"), lead.id, lead.responsibleId, id],
        );
      // A negotiated handover continues this Lead's clock and dated waiting condition.
      await tx.query(
        "update partner_leads set responsible_id=$2,assignment='accepted' where id=$1",
        [lead.id, terms.targetId],
      );
      await handoffWork(tx, actor, lead.id, terms.targetId);
      await event(tx, actor, lead.id, "lead.transferred", "", "client", terms.targetId);
    }
    state = "accepted";
  } else if (input.decision === "end") {
    await tx.query(
      "update partner_contributors set revoked_at=now() where collaboration_id=$1 and revoked_at is null",
      [id],
    );
    await handoffWork(tx, actor, lead.id, lead.responsibleId);
    state = "ended";
  } else state = input.decision === "decline" ? "declined" : "cancelled";
  await tx.query(
    `update partner_collaborations set state=$2,revision=revision+1,response=$3,
    decided_at=case when $2='ended' then decided_at else now() end,
    ended_at=case when $2='ended' then now() else null end where id=$1`,
    [id, state, input.reason],
  );
  await event(
    tx,
    actor,
    lead.id,
    `collaboration.${state}`,
    input.reason,
    "assigned",
    terms.targetId,
  );
  if (terms.mode === "co_advice" && ["accepted", "ended"].includes(state))
    await event(tx, actor, lead.id, `collaboration.${state}`, "", "client", terms.targetId);
  await notifyCollaboration(tx, id, state);
  await reconcileCollaborations(tx, lead.id, actor);
  await tx.query("update partner_leads set revision=revision+1,updated_at=now() where id=$1", [
    lead.id,
  ]);
  await syncLeadNotifications(tx, lead.id);
  return id;
}
