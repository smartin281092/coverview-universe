import type { Pool, PoolClient } from "pg";
import {
  communicationPreferencesInputSchema,
  communicationPreferencesSchema,
  communicationRecordInputSchema,
  communicationsQuerySchema,
  communicationsSchema,
  recordingRequestInputSchema,
  recordingDecisionInputSchema,
  recordingSchema,
  transcriptInputSchema,
  transcriptActionInputSchema,
} from "@coverview/contracts/partner-communications";
import {
  context,
  fail,
  membership,
  assigned,
  authorityCurrent,
  type PartnerActor,
} from "./partner.policy.js";
import {
  economyRead,
  economyCursor,
  economyNext,
  type EconomyMutation,
} from "./partner.commercial.js";
import { lockContractSubject } from "./partner.contract.js";
import { newId, event } from "./partner.audit.js";
import type { partnerLeads } from "./partner.schema.js";

type Lead = typeof partnerLeads.$inferSelect;
type Access = (tx: PoolClient, actor: PartnerActor, id: string) => Promise<Lead>;
type Recording = {
  id: string;
  lead_id: string;
  advisor_id: string;
  advisor_revision: number;
  owner_id: string;
  subject_key: string;
  scope_revision: number;
  input: unknown;
  invalidated_at: Date | null;
  created_at: Date;
};
type Version = { id: string; revision: number; input: unknown; created_at: Date };
const subject = (lead: Lead) =>
  lead.clientProfileId ? `profile:${lead.clientProfileId}` : `self:${lead.clientUserId}`;

export function createCommunicationOperations(
  pool: Pool,
  transaction: EconomyMutation,
  access: Access,
) {
  async function leadAccess(tx: PoolClient, actor: PartnerActor, id: string) {
    const initial = await access(tx, actor, id);
    if (initial.clientUserId) await lockContractSubject(tx, initial);
    return access(tx, actor, id);
  }
  async function advisorAssigned(tx: PoolClient, userId: string, lead: Lead) {
    return !!(
      await tx.query(
        `select l.id from partner_leads l where l.id=$2 and ${assigned} and (l.responsible_id=$1 or exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=$1 and c.revoked_at is null and c.access_scope='advice' and c.can_edit and c.can_contact and ${authorityCurrent("c")}))`,
        [userId, lead.id],
      )
    ).rowCount;
  }
  async function canRecord(tx: PoolClient, actor: PartnerActor, lead: Lead) {
    if (actor.wallet || actor.administrator || ["draft", "completed"].includes(lead.stage))
      return false;
    const ctx = await context(tx, actor, true);
    return ctx.canAdvise && advisorAssigned(tx, actor.userId, lead);
  }
  async function preferences(tx: PoolClient, actor: PartnerActor, lead: Lead) {
    const row = (
      await tx.query<{
        revision: number;
        input: unknown;
        created_at: Date;
        invalidated_at: Date | null;
        subject_key: string;
        owner_id: string;
      }>(
        "select * from partner_communication_preferences where lead_id=$1 order by revision desc limit 1",
        [lead.id],
      )
    ).rows[0];
    const valid =
      row &&
      !row.invalidated_at &&
      row.subject_key === subject(lead) &&
      row.owner_id === lead.clientUserId;
    const input = valid ? communicationPreferencesInputSchema.parse(row.input) : null;
    return communicationPreferencesSchema.parse({
      revision: row?.revision ?? 0,
      channels: input?.channels ?? null,
      note: input?.note ?? "",
      confirmedAt: input ? row!.created_at.toISOString() : null,
      canEdit: !!actor.wallet && lead.clientUserId === actor.userId,
    });
  }
  async function recordingAccess(tx: PoolClient, actor: PartnerActor, id: string) {
    const row = (
      await tx.query<Recording>("select * from partner_recording_requests where id=$1 for update", [
        id,
      ])
    ).rows[0];
    if (!row) fail("PARTNER_NOT_FOUND", 404);
    const lead = await leadAccess(tx, actor, row.lead_id);
    if (
      subject(lead) !== row.subject_key ||
      lead.clientUserId !== row.owner_id ||
      !(actor.wallet ? actor.userId === row.owner_id : actor.userId === row.advisor_id)
    )
      fail("PARTNER_NOT_FOUND", 404);
    return { row, lead };
  }
  async function readRecording(
    tx: PoolClient,
    actor: PartnerActor,
    id: string,
    before?: number,
    detail = true,
  ) {
    const { row, lead } = await recordingAccess(tx, actor, id),
      request = recordingRequestInputSchema.parse(row.input);
    const advisor = await membership(tx, row.advisor_id, true);
    const decision = (
      await tx.query<{
        revision: number;
        decision: "allow" | "decline" | "withdraw";
        created_at: Date;
      }>(
        "select * from partner_recording_decisions where request_id=$1 order by revision desc limit 1",
        [id],
      )
    ).rows[0];
    const current =
      advisor?.professionalRevision === row.advisor_revision &&
      advisor.state === "approved" &&
      advisor.organizationState === "approved" &&
      advisor.grantedRoles.includes("advisor") &&
      (!advisor.reviewDueAt || Date.parse(advisor.reviewDueAt) > Date.now()) &&
      lead.adviceScopeRevision === row.scope_revision &&
      !row.invalidated_at &&
      (await advisorAssigned(tx, row.advisor_id, lead));
    const state = !current
      ? "context_changed"
      : decision?.decision === "withdraw"
        ? "withdrawn"
        : decision?.decision === "decline"
          ? "declined"
          : Date.parse(request.validUntil) <= Date.now() ||
              Date.parse(request.retainUntil) <= Date.now()
            ? "expired"
            : decision?.decision === "allow"
              ? "allowed"
              : "requested";
    const readable = state === "allowed";
    if (state !== "requested")
      await tx.query(
        "update partner_notifications set resolved_at=coalesce(resolved_at,now()) where dedupe_key=$1 and resolved_at is null",
        [`recording:${id}`],
      );
    const versions =
      detail && readable
        ? (
            await tx.query<Version>(
              "select * from partner_transcripts where request_id=$1 and ($2::int is null or revision<$2) order by revision desc limit 21",
              [id, before ?? null],
            )
          ).rows
        : [];
    const tasks =
      detail && readable
        ? (
            await tx.query<{
              id: string;
              title: string;
              state: string;
              due_at: Date;
              version_id: string;
              segment_index: number;
            }>(
              `select t.id,t.title,t.state,t.due_at,a.version_id,a.segment_index from partner_transcript_actions a join partner_transcripts v on v.id=a.version_id join partner_tasks t on t.id=a.task_id where v.request_id=$1 order by a.created_at desc,a.id desc limit 101`,
              [id],
            )
          ).rows
        : [];
    if (tasks.length > 100) fail("PARTNER_ACTION_REQUIRED");
    if (versions.length)
      await tx.query(
        "insert into partner_transcript_accesses(id,request_id,actor_id) values($1,$2,$3)",
        [newId("pta"), id, actor.userId],
      );
    const editable = readable && (await canRecord(tx, actor, lead));
    return recordingSchema.parse({
      id,
      leadId: lead.id,
      advisorName: advisor?.name ?? "",
      createdAt: row.created_at.toISOString(),
      request,
      revision: decision?.revision ?? 0,
      state,
      decisionAt: decision?.created_at.toISOString() ?? null,
      canDecide: !!actor.wallet && (state === "requested" || state === "allowed"),
      canTranscribe: editable,
      canFollowUp: editable,
      transcripts: versions.slice(0, 20).map((v) => ({
        id: v.id,
        revision: v.revision,
        input: transcriptInputSchema.parse(v.input),
        createdAt: v.created_at.toISOString(),
      })),
      nextRevision: versions.length > 20 ? versions[19]!.revision : null,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        state: t.state,
        dueAt: t.due_at.toISOString(),
        versionId: t.version_id,
        segmentIndex: t.segment_index,
      })),
    });
  }
  async function readCommunications(
    tx: PoolClient,
    actor: PartnerActor,
    leadId: string,
    raw: unknown = {},
  ) {
    const lead = await leadAccess(tx, actor, leadId),
      query = communicationsQuerySchema.parse(raw);
    const records = (
      await tx.query<{ id: string; input: unknown; created_at: Date; author_name: string }>(
        `select r.*,coalesce(m.application->>'name','') author_name from partner_communication_records r left join partner_members m on m.user_id=r.author_id where r.lead_id=$1 and r.subject_key=$2 and r.owner_id is not distinct from $5::text and r.invalidated_at is null and ($3::timestamptz is null or (r.created_at,r.id)<($3::timestamptz,$4::text)) order by r.created_at desc,r.id desc limit 21`,
        [leadId, subject(lead), ...economyCursor(query.recordsCursor), lead.clientUserId],
      )
    ).rows;
    const recordings = (
      await tx.query<Recording>(
        `select * from partner_recording_requests where lead_id=$1 and subject_key=$2 and owner_id=$3 and ${actor.wallet ? "owner_id" : "advisor_id"}=$4 and ($5::timestamptz is null or (created_at,id)<($5::timestamptz,$6::text)) order by created_at desc,id desc limit 21`,
        [
          leadId,
          subject(lead),
          lead.clientUserId,
          actor.userId,
          ...economyCursor(query.recordingsCursor),
        ],
      )
    ).rows;
    const projected = [];
    for (const row of recordings.slice(0, 20))
      projected.push(await readRecording(tx, actor, row.id, undefined, false));
    return communicationsSchema.parse({
      leadRevision: lead.revision,
      preferences: await preferences(tx, actor, lead),
      records: records.slice(0, 20).map((r) => ({
        id: r.id,
        input: communicationRecordInputSchema.parse(r.input),
        createdAt: r.created_at.toISOString(),
        authorName: r.author_name,
      })),
      recordings: projected,
      nextRecordsCursor: records.length > 20 ? economyNext(records[19]!) : null,
      nextRecordingsCursor: recordings.length > 20 ? economyNext(recordings[19]!) : null,
      canRecord: await canRecord(tx, actor, lead),
    });
  }
  return {
    communications: (actor: PartnerActor, id: string, raw: unknown) =>
      economyRead(pool, actor, (tx) => readCommunications(tx, actor, id, raw)),
    recording: (actor: PartnerActor, id: string, before?: number) =>
      economyRead(pool, actor, (tx) => readRecording(tx, actor, id, before)),
    updateCommunicationPreferences(actor: PartnerActor, id: string, raw: unknown, key: string) {
      const input = communicationPreferencesInputSchema.parse(raw);
      return transaction(
        actor,
        "communication.preferences",
        key,
        { id, input },
        async (tx) => {
          const lead = await leadAccess(tx, actor, id),
            current = await preferences(tx, actor, lead);
          if (!current.canEdit) fail("PARTNER_ACCESS_DENIED", 403);
          if (current.revision !== input.expectedRevision) fail("PARTNER_CONFLICT", 409);
          await tx.query(
            "insert into partner_communication_preferences(id,lead_id,subject_key,owner_id,revision,input) values($1,$2,$3,$4,$5,$6)",
            [newId("pcp"), id, subject(lead), actor.userId, current.revision + 1, input],
          );
          await event(tx, actor, id, "communication.preferences_confirmed.v1", "", "client");
          return id;
        },
        (tx, target) => readCommunications(tx, actor, target),
      );
    },
    recordCommunication(actor: PartnerActor, id: string, raw: unknown, key: string) {
      const input = communicationRecordInputSchema.parse(raw);
      return transaction(
        actor,
        "communication.record",
        key,
        { id, input },
        async (tx) => {
          const lead = await leadAccess(tx, actor, id);
          if (!(await canRecord(tx, actor, lead))) fail("PARTNER_ACCESS_DENIED", 403);
          if (lead.revision !== input.expectedLeadRevision) fail("PARTNER_CONFLICT", 409);
          if (
            Date.parse(input.occurredAt) > Date.now() ||
            Date.parse(input.occurredAt) < lead.createdAt.getTime() ||
            Date.parse(input.dueAt) <= Date.now()
          )
            fail("PARTNER_ACTION_REQUIRED");
          await tx.query(
            "insert into partner_communication_records(id,lead_id,author_id,subject_key,input,owner_id) values($1,$2,$3,$4,$5,$6)",
            [newId("pcr"), id, actor.userId, subject(lead), input, lead.clientUserId],
          );
          await tx.query(
            "update partner_leads set next_action=$2,due_at=$3,waiting=null,first_useful_at=coalesce(first_useful_at,$5::timestamptz),stage=case when $4 and stage in ('new','qualifying','ready_to_assign','to_contact') then 'contacted' else stage end,stage_changed_at=case when $4 and stage in ('new','qualifying','ready_to_assign','to_contact') then now() else stage_changed_at end,revision=revision+1,updated_at=now() where id=$1",
            [
              id,
              input.nextAction,
              input.dueAt,
              input.outcome === "reached" || input.outcome === "received",
              input.occurredAt,
            ],
          );
          await event(tx, actor, id, "communication.recorded.v1", "", "client");
          return id;
        },
        (tx, target) => readCommunications(tx, actor, target),
      );
    },
    requestRecording(actor: PartnerActor, id: string, raw: unknown, key: string) {
      const input = recordingRequestInputSchema.parse(raw);
      return transaction(
        actor,
        "communication.request_recording",
        key,
        { id, input },
        async (tx) => {
          const lead = await leadAccess(tx, actor, id),
            advisor = await membership(tx, actor.userId, true);
          if (!(await canRecord(tx, actor, lead)) || !advisor || !lead.clientUserId)
            fail("PARTNER_ACCESS_DENIED", 403);
          if (lead.revision !== input.expectedLeadRevision) fail("PARTNER_CONFLICT", 409);
          if (
            Date.parse(input.validUntil) <= Date.now() ||
            Date.parse(input.retainUntil) <= Date.now()
          )
            fail("PARTNER_ACTION_REQUIRED");
          const requestId = newId("prr");
          await tx.query(
            "insert into partner_recording_requests(id,lead_id,advisor_id,advisor_revision,owner_id,subject_key,scope_revision,input) values($1,$2,$3,$4,$5,$6,$7,$8)",
            [
              requestId,
              id,
              actor.userId,
              advisor.professionalRevision,
              lead.clientUserId,
              subject(lead),
              lead.adviceScopeRevision,
              input,
            ],
          );
          await tx.query(
            "insert into partner_notifications(id,lead_id,audience,kind,dedupe_key,action,priority,due_at,recipient_id) values($1,$2,'wallet','communication.consent',$3,'communication','normal',$4,$5)",
            [newId("pn"), id, `recording:${requestId}`, input.validUntil, lead.clientUserId],
          );
          await event(tx, actor, id, "communication.consent_requested.v1", "", "client", requestId);
          return requestId;
        },
        (tx, target) => readRecording(tx, actor, target),
      );
    },
    decideRecording(actor: PartnerActor, id: string, raw: unknown, key: string) {
      const input = recordingDecisionInputSchema.parse(raw);
      return transaction(
        actor,
        "communication.decide_recording",
        key,
        { id, input },
        async (tx) => {
          const current = await readRecording(tx, actor, id, undefined, false);
          if (!actor.wallet || !current.canDecide) fail("PARTNER_ACCESS_DENIED", 403);
          if (current.revision !== input.expectedRevision) fail("PARTNER_CONFLICT", 409);
          if ((current.state === "allowed") !== (input.decision === "withdraw"))
            fail("PARTNER_INVALID_TRANSITION");
          await tx.query(
            "insert into partner_recording_decisions(id,request_id,actor_id,revision,decision) values($1,$2,$3,$4,$5)",
            [newId("prd"), id, actor.userId, current.revision + 1, input.decision],
          );
          await tx.query("update partner_notifications set resolved_at=now() where dedupe_key=$1", [
            `recording:${id}`,
          ]);
          await event(
            tx,
            actor,
            current.leadId,
            `communication.consent_${input.decision}.v1`,
            "",
            "client",
            id,
          );
          return id;
        },
        (tx, target) => readRecording(tx, actor, target),
      );
    },
    saveTranscript(actor: PartnerActor, id: string, raw: unknown, key: string) {
      const input = transcriptInputSchema.parse(raw);
      return transaction(
        actor,
        "communication.transcript",
        key,
        { id, input },
        async (tx) => {
          const current = await readRecording(tx, actor, id);
          if (!current.canTranscribe || !current.decisionAt) fail("PARTNER_ACCESS_DENIED", 403);
          const latest = current.transcripts[0];
          if ((latest?.revision ?? 0) !== input.expectedRevision) fail("PARTNER_CONFLICT", 409);
          if (
            Date.parse(input.occurredAt) < Date.parse(current.decisionAt) ||
            Date.parse(input.occurredAt) > Date.now() ||
            Date.parse(input.occurredAt) >= Date.parse(current.request.validUntil) ||
            (latest && latest.input.occurredAt !== input.occurredAt)
          )
            fail("PARTNER_ACTION_REQUIRED");
          await tx.query(
            "insert into partner_transcripts(id,request_id,actor_id,revision,input) values($1,$2,$3,$4,$5)",
            [newId("ptr"), id, actor.userId, input.expectedRevision + 1, input],
          );
          await event(
            tx,
            actor,
            current.leadId,
            "communication.transcript_saved.v1",
            "",
            "private",
            id,
          );
          return id;
        },
        (tx, target) => readRecording(tx, actor, target),
      );
    },
    createTranscriptTask(actor: PartnerActor, id: string, raw: unknown, key: string) {
      const input = transcriptActionInputSchema.parse(raw);
      return transaction(
        actor,
        "communication.transcript_task",
        key,
        { id, input },
        async (tx) => {
          const current = await readRecording(tx, actor, id),
            version = current.transcripts[0];
          if (!current.canFollowUp) fail("PARTNER_ACCESS_DENIED", 403);
          if (!version || version.id !== input.versionId) fail("PARTNER_CONFLICT", 409);
          if (
            !version.input.segments[input.segmentIndex]?.text.includes(input.quote) ||
            Date.parse(input.dueAt) <= Date.now()
          )
            fail("PARTNER_ACTION_REQUIRED");
          const taskId = newId("pt");
          await tx.query(
            "insert into partner_tasks(id,lead_id,responsible_id,title,description,due_at,priority) values($1,$2,$3,$4,'',$5,'normal')",
            [taskId, current.leadId, actor.userId, input.title, input.dueAt],
          );
          await tx.query(
            "insert into partner_transcript_actions(id,version_id,actor_id,segment_index,quote,task_id) values($1,$2,$3,$4,$5,$6)",
            [newId("ptact"), version.id, actor.userId, input.segmentIndex, input.quote, taskId],
          );
          await event(
            tx,
            actor,
            current.leadId,
            "communication.task_created.v1",
            "",
            "assigned",
            taskId,
          );
          return id;
        },
        (tx, target) => readRecording(tx, actor, target),
      );
    },
  };
}
