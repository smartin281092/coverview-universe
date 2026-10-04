import type { Pool, PoolClient } from "pg";
import type { LeadSummary } from "@coverview/contracts/partner";
import {
  leadRelationshipInputSchema,
  leadRelationshipsSchema,
  leadRelationshipCandidatesSchema,
  type LeadRelationshipInput,
  type LeadRelationshipBlocker,
} from "@coverview/contracts/partner-relationships";
import {
  economyRead,
  economyCursor,
  economyNext,
  type EconomyMutation,
} from "./partner.commercial.js";
import { lockContractSubject } from "./partner.contract.js";
import { fail, PartnerError, visible, type PartnerActor } from "./partner.policy.js";
import { event, newId } from "./partner.audit.js";
import { executeLeadCommand } from "./partner.commands.js";
import { syncLeadNotifications } from "./partner.notifications.js";
import { reconcileCollaborations } from "./partner.collaboration.js";
import type { partnerLeads } from "./partner.schema.js";
type Lead = typeof partnerLeads.$inferSelect;
type Access = (
  tx: PoolClient,
  actor: PartnerActor,
  id: string,
) => Promise<{ lead: Lead; summary: LeadSummary; canControl: boolean }>;
type Row = {
  id: string;
  source_lead_id: string;
  target_lead_id: string;
  owner_id: string;
  subject_key: string;
  kind: "related" | "duplicate";
  reason: string;
  created_at: Date;
  withdrawn_at: Date | null;
  withdrawal_reason: string | null;
  invalidated_at: Date | null;
};
const subject = (lead: Lead) =>
  lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${lead.clientUserId}`;
const active = (lead: Lead) => !["draft", "completed"].includes(lead.stage);
export function createRelationshipOperations(
  pool: Pool,
  transaction: EconomyMutation,
  access: Access,
) {
  async function storage(tx: PoolClient) {
    if (
      !(
        await tx.query<{ table: string | null }>(
          "select to_regclass('partner_lead_relationships')::text as table",
        )
      ).rows[0]?.table
    )
      fail("PARTNER_UNAVAILABLE", 503);
  }
  async function exact(tx: PoolClient, actor: PartnerActor, id: string) {
    const current = await access(tx, actor, id);
    const lead = current.lead.clientUserId
      ? { ...current.lead, ...(await lockContractSubject(tx, current.lead)) }
      : current.lead;
    return { ...current, lead };
  }
  async function pair(tx: PoolClient, actor: PartnerActor, a: string, b: string) {
    const values = new Map<string, Awaited<ReturnType<typeof exact>>>();
    for (const id of [...new Set([a, b])].sort()) values.set(id, await exact(tx, actor, id));
    const source = values.get(a)!,
      target = values.get(b)!;
    if (
      a === b ||
      !source.lead.clientUserId ||
      source.lead.clientUserId !== target.lead.clientUserId ||
      subject(source.lead) !== subject(target.lead)
    )
      fail("PARTNER_INVALID_CLIENT");
    return { source, target };
  }
  async function isRoot(tx: PoolClient, id: string) {
    return !(
      await tx.query(
        `select id from partner_lead_relationships where source_lead_id=$1 and withdrawn_at is null and invalidated_at is null limit 1`,
        [id],
      )
    ).rowCount;
  }
  async function assessment(tx: PoolClient, current: Awaited<ReturnType<typeof exact>>) {
    if (!current.canControl)
      return {
        canGroup: false,
        canMerge: false,
        blockers: [],
        openTasks: null,
        futureAppointments: null,
      };
    const lead = current.lead,
      blockers: LeadRelationshipBlocker[] = [];
    if (!lead.clientUserId) blockers.push("canonical_subject");
    if (!active(lead)) blockers.push("inactive");
    const r = (
      await tx.query<{
        linked: boolean;
        signed: boolean;
        conclusion: boolean;
        protected: boolean;
        tasks: number;
        appointments: number;
      }>(
        `select
      exists(select 1 from partner_lead_relationships where (source_lead_id=$1 or target_lead_id=$1) and withdrawn_at is null and invalidated_at is null) linked,
      exists(select 1 from partner_conclusions c join partner_offer_signatures s on s.conclusion_id=c.id where c.lead_id=$1 and c.invalidated_at is null) signed,
      exists(select 1 from partner_conclusions c where c.lead_id=$1 and c.invalidated_at is null and c.withdrawn_at is null and c.valid_until>now()) conclusion,
      (exists(select 1 from partner_market_reservations where lead_id=$1 and (state='accepted' or state='reserved' and expires_at>now()))
        or exists(select 1 from partner_quality_cases q where lead_id=$1 and invalidated_at is null and coalesce((select input->>'action' from partner_quality_actions where case_id=q.id order by revision desc limit 1),'')<>'close')
        or exists(select 1 from partner_collaborations where lead_id=$1 and state='proposed')) protected,
      (select count(*)::int from partner_tasks where lead_id=$1 and state='open') tasks,
      (select count(*)::int from partner_appointments where lead_id=$1 and state='scheduled' and starts_at>now()) appointments`,
        [lead.id],
      )
    ).rows[0]!;
    if (r.linked) blockers.push("existing_group");
    const canGroup = blockers.length === 0;
    if (r.signed) blockers.push("signature");
    if (r.conclusion) blockers.push("conclusion");
    if (r.protected) blockers.push("protected_follow_up");
    return {
      canGroup,
      canMerge: blockers.length === 0,
      blockers,
      openTasks: r.tasks,
      futureAppointments: r.appointments,
    };
  }
  async function read(tx: PoolClient, actor: PartnerActor, id: string, cursor?: string) {
    await storage(tx);
    const current = await exact(tx, actor, id),
      [at, key] = economyCursor(cursor);
    const rows = (
      await tx.query<Row>(
        `select * from partner_lead_relationships where (source_lead_id=$1 or target_lead_id=$1)
      and owner_id=$2 and subject_key=$3 and invalidated_at is null and ($4::timestamptz is null or (created_at,id)<($4,$5))
      order by created_at desc,id desc limit 21`,
        [id, current.lead.clientUserId, subject(current.lead), at, key],
      )
    ).rows;
    const items = [];
    for (const row of rows.slice(0, 20)) {
      try {
        const { source, target } = await pair(tx, actor, row.source_lead_id, row.target_lead_id);
        items.push({
          id: row.id,
          source: source.summary,
          target: target.summary,
          kind: row.kind,
          reason: row.reason,
          createdAt: row.created_at.toISOString(),
          active: !row.withdrawn_at,
          withdrawnAt: row.withdrawn_at?.toISOString() ?? null,
          withdrawalReason: row.withdrawal_reason,
          canWithdraw: !row.withdrawn_at && source.canControl && target.canControl,
        });
      } catch (error) {
        if (
          !(error instanceof PartnerError) ||
          !["PARTNER_NOT_FOUND", "PARTNER_INVALID_CLIENT"].includes(error.code)
        )
          throw error;
      }
    }
    return leadRelationshipsSchema.parse({
      leadRevision: current.lead.revision,
      assessment: await assessment(tx, current),
      items,
      nextCursor: rows.length > 20 ? economyNext(rows[19]!) : null,
    });
  }
  return {
    leadRelationships: (actor: PartnerActor, id: string, cursor?: string) =>
      economyRead(pool, actor, (tx) => read(tx, actor, id, cursor)),
    leadRelationshipCandidates: (actor: PartnerActor, id: string, cursor?: string) =>
      economyRead(pool, actor, async (tx) => {
        await storage(tx);
        const current = await exact(tx, actor, id),
          [at, key] = economyCursor(cursor);
        if (actor.wallet || !current.canControl) fail("PARTNER_ACCESS_DENIED", 403);
        if (!current.lead.clientUserId)
          return leadRelationshipCandidatesSchema.parse({ items: [], nextCursor: null });
        const rows = (
          await tx.query<{ id: string; created_at: Date }>(
            `select l.id,l.created_at from partner_leads l where l.id<>$2
        and l.client_profile_id is not distinct from $3 and coalesce((select user_id from managed_profiles where id=l.client_profile_id),l.client_user_id)=$4
        and (${visible(actor)}) and ($5::timestamptz is null or (l.created_at,l.id)<($5,$6))
        order by l.created_at desc,l.id desc limit 21`,
            [actor.userId, id, current.lead.clientProfileId, current.lead.clientUserId, at, key],
          )
        ).rows;
        const base = await assessment(tx, current),
          items = [];
        for (const row of rows.slice(0, 20)) {
          try {
            const candidate = await exact(tx, actor, row.id),
              root = await isRoot(tx, row.id);
            items.push({
              lead: candidate.summary,
              canGroup: base.canGroup && candidate.canControl && active(candidate.lead) && root,
              canMerge:
                base.canMerge &&
                candidate.canControl &&
                active(candidate.lead) &&
                root &&
                candidate.lead.category === current.lead.category,
            });
          } catch (error) {
            if (!(error instanceof PartnerError) || error.code !== "PARTNER_NOT_FOUND") throw error;
          }
        }
        return leadRelationshipCandidatesSchema.parse({
          items,
          nextCursor: rows.length > 20 ? economyNext(rows[19]!) : null,
        });
      }),
    changeLeadRelationship: (
      actor: PartnerActor,
      id: string,
      raw: LeadRelationshipInput,
      key: string,
    ) => {
      const input = leadRelationshipInputSchema.parse(raw);
      return transaction(
        actor,
        "relationships.change",
        key,
        { id, input },
        async (tx) => {
          await storage(tx);
          if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
          const existing =
            input.action === "withdraw"
              ? (
                  await tx.query<Row>("select * from partner_lead_relationships where id=$1", [
                    input.id,
                  ])
                ).rows[0]
              : null;
          if (
            input.action === "withdraw" &&
            (!existing || ![existing.source_lead_id, existing.target_lead_id].includes(id))
          )
            fail("PARTNER_NOT_FOUND", 404);
          const sourceId = existing?.source_lead_id ?? id,
            targetId =
              existing?.target_lead_id ?? (input.action === "link" ? input.targetLeadId : "");
          const { source, target } = await pair(tx, actor, sourceId, targetId);
          if (!source.canControl || !target.canControl) fail("PARTNER_ACCESS_DENIED", 403);
          if (
            source.lead.revision !== input.sourceRevision ||
            target.lead.revision !== input.targetRevision
          )
            fail("PARTNER_CONFLICT", 409);
          let relationId: string;
          if (input.action === "link") {
            const status = await assessment(tx, source);
            if (!status.canGroup || !active(target.lead) || !(await isRoot(tx, targetId)))
              fail("PARTNER_ACTION_REQUIRED");
            if (
              input.kind === "duplicate" &&
              (!status.canMerge || source.lead.category !== target.lead.category)
            )
              fail("PARTNER_ACTION_REQUIRED");
            relationId = newId("prel");
            await tx.query(
              `insert into partner_lead_relationships(id,source_lead_id,target_lead_id,source_revision,target_revision,owner_id,subject_key,actor_id,kind,reason)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
              [
                relationId,
                sourceId,
                targetId,
                input.sourceRevision,
                input.targetRevision,
                source.lead.clientUserId,
                subject(source.lead),
                actor.userId,
                input.kind,
                input.reason,
              ],
            );
            if (input.kind === "duplicate")
              await executeLeadCommand(tx, actor, source.lead, {
                action: "close",
                revision: source.lead.revision,
                result: "duplicate",
                reason: "duplicate",
                comment: input.reason,
              });
          } else {
            const row = (
              await tx.query<Row>(
                "select * from partner_lead_relationships where id=$1 for update",
                [input.id],
              )
            ).rows[0];
            if (
              !row ||
              row.withdrawn_at ||
              row.invalidated_at ||
              row.owner_id !== source.lead.clientUserId ||
              row.subject_key !== subject(source.lead)
            )
              fail("PARTNER_CONFLICT", 409);
            relationId = row.id;
            await tx.query(
              "update partner_lead_relationships set withdrawn_at=clock_timestamp(),withdrawn_by=$2,withdrawal_reason=$3 where id=$1",
              [row.id, actor.userId, input.reason],
            );
            if (row.kind === "duplicate") {
              if (
                !input.nextAction ||
                !input.dueAt ||
                source.lead.stage !== "completed" ||
                source.lead.result !== "duplicate"
              )
                fail("PARTNER_ACTION_REQUIRED");
              await executeLeadCommand(tx, actor, source.lead, {
                action: "reopen",
                revision: source.lead.revision,
                reason: input.reason,
                nextAction: input.nextAction,
                dueAt: input.dueAt,
              });
            }
          }
          for (const leadId of [sourceId, targetId].sort()) {
            await tx.query(
              "update partner_leads set revision=revision+1,updated_at=clock_timestamp() where id=$1",
              [leadId],
            );
            await event(
              tx,
              actor,
              leadId,
              input.action === "link"
                ? "lead.relationship_linked.v1"
                : "lead.relationship_withdrawn.v1",
              "",
              "client",
              relationId,
            );
            await syncLeadNotifications(tx, leadId);
            await reconcileCollaborations(tx, leadId, actor);
          }
          return id;
        },
        (tx, root) => read(tx, actor, root),
      );
    },
  };
}
