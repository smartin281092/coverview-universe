import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  qualityActionInputSchema,
  qualityCaseSchema,
  qualityClientReplySchema,
  qualityCreateSchema,
  qualityHistorySchema,
  qualityPageQuerySchema,
  qualityQueueSchema,
  qualitySettingsInputSchema,
  qualitySettingsSchema,
  surveyResponseInputSchema,
  surveySchema,
  surveysSchema,
} from "@coverview/contracts/partner-quality";
import { context, fail, type PartnerActor } from "./partner.policy.js";
import {
  economyCursor,
  economyNext,
  economyRead,
  type EconomyMutation,
} from "./partner.commercial.js";
import { lockContractSubject } from "./partner.contract.js";
import { event, newId } from "./partner.audit.js";
import type { partnerLeads } from "./partner.schema.js";
import copy from "./partner.quality.fr.json" with { type: "json" };

type Lead = typeof partnerLeads.$inferSelect;
type Access = (tx: PoolClient, actor: PartnerActor, id: string) => Promise<Lead>;
type CaseRow = {
  owner_id: string | null;
  invalidated_at: Date | null;
  id: string;
  lead_id: string;
  subject_key: string;
  author_id: string;
  survey_id: string | null;
  kind: string;
  summary: string;
  priority: string;
  audience: string;
  due_at: Date;
  created_at: Date;
};
type ActionRow = {
  revision: number;
  actor_id: string;
  input: unknown;
  created_at: Date;
  actor_name: string;
};
const subject = (l: Lead) =>
  l.clientProfileId ? `profile:${l.clientProfileId}` : `self:${l.clientUserId}`;
const admin = (actor: PartnerActor) => {
  if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
};
const replySchema = qualityClientReplySchema.extend({
  action: z.literal("reply"),
  sharedWithClient: z.boolean(),
  sharedWithAuthor: z.literal(true),
});

export function createQualityOperations(pool: Pool, transaction: EconomyMutation, access: Access) {
  async function leadAccess(tx: PoolClient, actor: PartnerActor, id: string) {
    const initial = await access(tx, actor, id);
    if (initial.clientUserId) {
      await lockContractSubject(tx, initial);
      const current = await access(tx, actor, id);
      if (actor.wallet && current.clientUserId !== actor.userId) fail("PARTNER_NOT_FOUND", 404);
      return current;
    }
    return initial;
  }
  async function settings(tx: PoolClient, actor: PartnerActor) {
    admin(actor);
    const row = (
      await tx.query<{ revision: number; input: unknown; created_at: Date }>(
        "select * from partner_quality_settings order by revision desc limit 1",
      )
    ).rows[0];
    const input = row ? qualitySettingsInputSchema.parse(row.input) : null;
    return qualitySettingsSchema.parse({
      revision: row?.revision ?? 0,
      googleReviewUrl: input?.googleReviewUrl ?? null,
      sourceReference: input?.sourceReference ?? "",
      configuredAt: row?.created_at.toISOString() ?? null,
    });
  }
  async function readSurvey(tx: PoolClient, actor: PartnerActor, id: string) {
    if (!actor.wallet || actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
    const row = (
      await tx.query<{
        id: string;
        lead_id: string;
        subject_key: string;
        owner_id: string;
        invalidated_at: Date | null;
        completed_at: Date;
        created_at: Date;
        response: unknown;
        response_at: Date | null;
        case_id: string | null;
      }>(
        `select s.*,r.response,r.created_at response_at,q.id case_id from partner_surveys s left join partner_survey_responses r on r.survey_id=s.id left join partner_quality_cases q on q.survey_id=s.id where s.id=$1`,
        [id],
      )
    ).rows[0];
    if (!row) fail("PARTNER_NOT_FOUND", 404);
    const lead = await leadAccess(tx, actor, row.lead_id);
    if (
      subject(lead) !== row.subject_key ||
      row.owner_id !== lead.clientUserId ||
      row.invalidated_at
    )
      fail("PARTNER_NOT_FOUND", 404);
    const response = row.response ? surveyResponseInputSchema.parse(row.response) : null;
    let url: string | null = null;
    if (response?.rating === 5) {
      const config = (
        await tx.query<{ input: unknown }>(
          "select input from partner_quality_settings order by revision desc limit 1",
        )
      ).rows[0];
      url = config ? qualitySettingsInputSchema.parse(config.input).googleReviewUrl : null;
    }
    return surveySchema.parse({
      id,
      leadId: lead.id,
      title: lead.title,
      category: lead.category,
      result: lead.result ?? "",
      completedAt: row.completed_at.toISOString(),
      invitedAt: row.created_at.toISOString(),
      responseAt: row.response_at?.toISOString() ?? null,
      response,
      caseId: row.case_id,
      googleReviewUrl: url,
      googleStatus:
        response?.rating === 5 ? (url ? "available" : "not_configured") : "not_applicable",
      delivery: "wallet",
      canRespond: !response && lead.stage === "completed",
    });
  }
  async function caseAccess(tx: PoolClient, actor: PartnerActor, id: string) {
    const row = (
      await tx.query<CaseRow>("select * from partner_quality_cases where id=$1 for update", [id])
    ).rows[0];
    if (!row) fail("PARTNER_NOT_FOUND", 404);
    const lead = await leadAccess(tx, actor, row.lead_id);
    if (
      (!actor.administrator &&
        (subject(lead) !== row.subject_key ||
          row.owner_id !== lead.clientUserId ||
          row.invalidated_at)) ||
      (!actor.administrator &&
        (actor.wallet ? row.audience !== "client" : row.author_id !== actor.userId))
    )
      fail("PARTNER_NOT_FOUND", 404);
    return { row, lead };
  }
  async function actions(tx: PoolClient, id: string, actor: PartnerActor, before?: number) {
    return (
      await tx.query<ActionRow>(
        `select a.*,coalesce(nullif(m.application->>'name',''),nullif(trim(concat_ws(' ',p.fields->'firstName'->>'value',p.fields->'lastName'->>'value')),''),'CoverView') actor_name from partner_quality_actions a left join partner_members m on m.user_id=a.actor_id left join identity_profiles p on p.user_id=a.actor_id where a.case_id=$1 and ($2::int is null or a.revision<$2) and ($3::boolean or a.input->>$4='true') order by a.revision desc limit 21`,
        [
          id,
          before ?? null,
          actor.administrator,
          actor.wallet ? "sharedWithClient" : "sharedWithAuthor",
        ],
      )
    ).rows;
  }
  async function readCase(tx: PoolClient, actor: PartnerActor, id: string, before?: number) {
    const { row, lead } = await caseAccess(tx, actor, id);
    const latest = (
      await tx.query<ActionRow>(
        `select a.*,coalesce(nullif(m.application->>'name',''),nullif(trim(concat_ws(' ',p.fields->'firstName'->>'value',p.fields->'lastName'->>'value')),''),'CoverView') actor_name from partner_quality_actions a left join partner_members m on m.user_id=a.actor_id left join identity_profiles p on p.user_id=a.actor_id where case_id=$1 and input->>'action'<>'reply' order by revision desc limit 1`,
        [id],
      )
    ).rows[0];
    const last = latest ? qualityActionInputSchema.parse(latest.input) : null;
    const revision = Number(
      (
        await tx.query<{ revision: number }>(
          "select coalesce(max(revision),0)::int revision from partner_quality_actions where case_id=$1",
          [id],
        )
      ).rows[0]!.revision,
    );
    const history = await actions(tx, id, actor, before);
    const state = last?.action === "close" ? "closed" : latest ? "in_progress" : "open";
    const shared =
      actor.administrator || (actor.wallet ? last?.sharedWithClient : last?.sharedWithAuthor);
    const due = last ? (shared ? last.dueAt : null) : row.due_at.toISOString();
    const response =
      actor.administrator && row.survey_id
        ? (
            await tx.query<{ response: unknown }>(
              "select response from partner_survey_responses where survey_id=$1",
              [row.survey_id],
            )
          ).rows[0]?.response
        : null;
    return qualityCaseSchema.parse({
      id,
      leadId: row.lead_id,
      title: lead.title,
      kind: row.kind,
      summary: row.summary,
      priority: row.priority,
      accountableUnit: "coverview",
      assignedTo: shared ? (latest?.actor_name ?? null) : null,
      state,
      revision,
      nextAction: shared ? (last?.nextAction ?? "") : "",
      dueAt: due,
      overdue: state !== "closed" && !!due && Date.parse(due) < Date.now(),
      createdAt: row.created_at.toISOString(),
      canManage: actor.administrator,
      canReply: !actor.administrator && state !== "closed",
      canShareWithClient:
        row.audience === "client" &&
        !!lead.clientUserId &&
        lead.clientUserId === row.owner_id &&
        subject(lead) === row.subject_key &&
        !row.invalidated_at,
      canShareWithAuthor: row.author_id !== lead.clientUserId,
      survey: response ?? null,
      history: history.slice(0, 20).map((a) => {
        const parsed = qualityActionInputSchema.safeParse(a.input);
        const input = parsed.success ? parsed.data : replySchema.parse(a.input);
        return qualityHistorySchema.parse({
          revision: a.revision,
          action: input.action,
          note: input.note,
          actorName: a.actor_name,
          createdAt: a.created_at.toISOString(),
          nextAction: parsed.success ? parsed.data.nextAction : "",
          dueAt: parsed.success ? parsed.data.dueAt : null,
          sharedWithClient: input.sharedWithClient,
          sharedWithAuthor: input.sharedWithAuthor,
          verified: parsed.success ? parsed.data.verified : false,
        });
      }),
      nextHistoryRevision: history.length > 20 ? history[19]!.revision : null,
    });
  }
  async function notifyCase(
    tx: PoolClient,
    row: { id: string; leadId: string; priority: string; dueAt: string },
  ) {
    await tx.query(
      `insert into partner_notifications(id,lead_id,audience,kind,dedupe_key,action,priority,due_at) values($1,$2,'coverview','quality.pending',$3,'review_quality',$4,$5) on conflict(dedupe_key) do update set resolved_at=null,due_at=excluded.due_at`,
      [newId("pn"), row.leadId, `quality:${row.id}`, row.priority, row.dueAt],
    );
  }
  async function createCase(
    tx: PoolClient,
    actor: PartnerActor,
    lead: Lead,
    input: z.infer<typeof qualityCreateSchema>,
    surveyId: string | null = null,
  ) {
    if (input.sharedWithClient && !lead.clientUserId) fail("PARTNER_ACTION_REQUIRED");
    const id = newId("pqc"),
      dueAt = new Date(Date.now() + 86400000).toISOString();
    await tx.query(
      `insert into partner_quality_cases(id,lead_id,subject_key,author_id,survey_id,kind,summary,priority,audience,due_at,owner_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id,
        lead.id,
        subject(lead),
        actor.userId,
        surveyId,
        input.kind,
        input.summary,
        input.priority,
        actor.wallet || input.sharedWithClient ? "client" : "coverview",
        dueAt,
        lead.clientUserId,
      ],
    );
    await notifyCase(tx, { id, leadId: lead.id, priority: input.priority, dueAt });
    await event(tx, actor, lead.id, "quality.opened.v1", "", "coverview", id);
    return id;
  }
  return {
    qualitySettings: (actor: PartnerActor) => economyRead(pool, actor, (tx) => settings(tx, actor)),
    updateQualitySettings(actor: PartnerActor, raw: unknown, key: string) {
      const input = qualitySettingsInputSchema.parse(raw);
      return transaction(
        actor,
        "quality.settings",
        key,
        input,
        async (tx) => {
          admin(actor);
          await tx.query("select pg_advisory_xact_lock(hashtext('partner-quality-settings'))");
          const current = await settings(tx, actor);
          if (current.revision !== input.expectedRevision) fail("PARTNER_CONFLICT", 409);
          await tx.query(
            "insert into partner_quality_settings(revision,actor_id,input) values($1,$2,$3)",
            [current.revision + 1, actor.userId, input],
          );
          await event(tx, actor, null, "quality.settings_changed.v1", "", "private");
          return "settings";
        },
        (tx) => settings(tx, actor),
      );
    },
    survey: (actor: PartnerActor, id: string) =>
      economyRead(pool, actor, (tx) => readSurvey(tx, actor, id)),
    surveys: (actor: PartnerActor, leadId: string) =>
      economyRead(pool, actor, async (tx) => {
        if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const lead = await leadAccess(tx, actor, leadId);
        const rows = (
          await tx.query<{ id: string }>(
            "select id from partner_surveys where lead_id=$1 and owner_id=$2 and subject_key=$3 and invalidated_at is null limit 1",
            [leadId, actor.userId, subject(lead)],
          )
        ).rows;
        return surveysSchema.parse({
          items: await Promise.all(rows.map((r) => readSurvey(tx, actor, r.id))),
          nextCursor: null,
        });
      }),
    respondSurvey(actor: PartnerActor, id: string, raw: unknown, key: string) {
      const input = surveyResponseInputSchema.parse(raw);
      return transaction(
        actor,
        "quality.survey_response",
        key,
        { id, input },
        async (tx) => {
          const current = await readSurvey(tx, actor, id);
          if (!current.canRespond) fail("PARTNER_CONFLICT", 409);
          const lead = await leadAccess(tx, actor, current.leadId);
          await tx.query(
            "insert into partner_survey_responses(survey_id,actor_id,response) values($1,$2,$3)",
            [id, actor.userId, input],
          );
          if (input.rating < 5)
            await createCase(
              tx,
              actor,
              lead,
              {
                kind: input.callbackRequested ? "callback" : "verification",
                summary: input.comment || copy.surveySummary,
                priority: input.callbackRequested ? "high" : "normal",
                sharedWithClient: true,
                confirmed: true,
              },
              id,
            );
          await tx.query("update partner_notifications set resolved_at=now() where dedupe_key=$1", [
            `survey:${id}`,
          ]);
          await event(tx, actor, lead.id, "quality.response_received.v1", "", "coverview", id);
          return id;
        },
        (tx, target) => readSurvey(tx, actor, target),
      );
    },
    createQualityCase(actor: PartnerActor, leadId: string, raw: unknown, key: string) {
      const input = qualityCreateSchema.parse(raw);
      return transaction(
        actor,
        "quality.create",
        key,
        { leadId, input },
        async (tx) => {
          if (actor.wallet && !["complaint", "callback"].includes(input.kind))
            fail("PARTNER_ACCESS_DENIED", 403);
          const lead = await leadAccess(tx, actor, leadId);
          return createCase(tx, actor, lead, input);
        },
        (tx, id) => readCase(tx, actor, id),
      );
    },
    qualityCase: (actor: PartnerActor, id: string, before?: number) =>
      economyRead(pool, actor, (tx) => readCase(tx, actor, id, before)),
    qualityQueue: (actor: PartnerActor, raw: unknown, leadId?: string) =>
      economyRead(pool, actor, async (tx) => {
        const query = qualityPageQuerySchema.parse(raw),
          cursor = economyCursor(query.cursor);
        if (!leadId) admin(actor);
        else await leadAccess(tx, actor, leadId);
        if (!actor.wallet && !actor.administrator && !(await context(tx, actor, true)).operational)
          fail("PARTNER_ACCESS_DENIED", 403);
        const rows = (
          await tx.query<CaseRow>(
            `select q.* from partner_quality_cases q join partner_leads l on l.id=q.lead_id where ($1::text is null or q.lead_id=$1) and ($2::boolean or q.author_id=$3 or $4::boolean and q.audience='client') and ($2::boolean or (q.invalidated_at is null and q.owner_id is not distinct from case when l.client_profile_id is null then l.client_user_id else (select mp.user_id from managed_profiles mp where mp.id=l.client_profile_id) end and q.subject_key=case when l.client_profile_id is not null then 'profile:'||l.client_profile_id else 'self:'||coalesce(l.client_user_id,'null') end)) and ($5::text='all' or ($5='closed')=coalesce((select a.input->>'action'='close' from partner_quality_actions a where a.case_id=q.id and a.input->>'action'<>'reply' order by a.revision desc limit 1),false)) and ($6::timestamptz is null or (q.created_at,q.id)<($6::timestamptz,$7::text)) order by q.created_at desc,q.id desc limit 21`,
            [
              leadId ?? null,
              actor.administrator,
              actor.userId,
              !!actor.wallet,
              query.state,
              ...cursor,
            ],
          )
        ).rows;
        const page = rows.slice(0, 20),
          items = [];
        for (const row of page) items.push(await readCase(tx, actor, row.id));
        return qualityQueueSchema.parse({
          items,
          nextCursor: rows.length > 20 ? economyNext(page.at(-1)!) : null,
        });
      }),
    actQualityCase(actor: PartnerActor, id: string, raw: unknown, key: string) {
      const input = qualityActionInputSchema.parse(raw);
      return transaction(
        actor,
        "quality.action",
        key,
        { id, input },
        async (tx) => {
          admin(actor);
          const current = await readCase(tx, actor, id);
          if (current.revision !== input.expectedRevision) fail("PARTNER_CONFLICT", 409);
          if (
            (input.sharedWithClient && !current.canShareWithClient) ||
            (input.sharedWithAuthor && !current.canShareWithAuthor)
          )
            fail("PARTNER_ACCESS_DENIED", 403);
          if ((current.state === "closed") !== (input.action === "reopen"))
            fail("PARTNER_INVALID_TRANSITION");
          if (input.dueAt && Date.parse(input.dueAt) <= Date.now()) fail("PARTNER_ACTION_REQUIRED");
          await tx.query(
            "insert into partner_quality_actions(id,case_id,revision,actor_id,input) values($1,$2,$3,$4,$5)",
            [newId("pqa"), id, current.revision + 1, actor.userId, input],
          );
          if (input.action === "close")
            await tx.query(
              "update partner_notifications set resolved_at=now() where dedupe_key=$1",
              [`quality:${id}`],
            );
          else
            await notifyCase(tx, {
              id,
              leadId: current.leadId,
              priority: current.priority,
              dueAt: input.dueAt!,
            });
          if (input.sharedWithClient) {
            const lead = await leadAccess(tx, actor, current.leadId);
            await tx.query(
              "insert into partner_notifications(id,lead_id,recipient_id,audience,kind,dedupe_key,action,priority,resolved_at) values($1,$2,$3,'wallet','quality.updated',$4,null,'normal',now())",
              [
                newId("pn"),
                current.leadId,
                lead.clientUserId,
                `quality-update:${id}:${current.revision + 1}`,
              ],
            );
          }
          if (input.sharedWithAuthor)
            await tx.query(
              "insert into partner_notifications(id,lead_id,recipient_id,audience,kind,dedupe_key,action,priority,resolved_at) select $1,$2,author_id,'partner','quality.updated',$3,null,'normal',now() from partner_quality_cases where id=$4",
              [
                newId("pn"),
                current.leadId,
                `quality-author-update:${id}:${current.revision + 1}`,
                id,
              ],
            );
          await event(tx, actor, current.leadId, `quality.${input.action}.v1`, "", "coverview", id);
          return id;
        },
        (tx, target) => readCase(tx, actor, target),
      );
    },
    replyQualityCase(actor: PartnerActor, id: string, raw: unknown, key: string) {
      const input = qualityClientReplySchema.parse(raw);
      return transaction(
        actor,
        "quality.reply",
        key,
        { id, input },
        async (tx) => {
          if (actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
          const current = await readCase(tx, actor, id);
          if (!current.canReply || current.revision !== input.expectedRevision)
            fail("PARTNER_CONFLICT", 409);
          await tx.query(
            "insert into partner_quality_actions(id,case_id,revision,actor_id,input) values($1,$2,$3,$4,$5)",
            [
              newId("pqa"),
              id,
              current.revision + 1,
              actor.userId,
              {
                ...input,
                action: "reply",
                sharedWithClient: current.canShareWithClient,
                sharedWithAuthor: true,
              },
            ],
          );
          await event(tx, actor, current.leadId, "quality.reply.v1", "", "coverview", id);
          return id;
        },
        (tx, target) => readCase(tx, actor, target),
      );
    },
  };
}
