import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  counselRequestInputSchema,
  counselActionInputSchema,
  counselRequestSchema,
  counselQueueSchema,
  counselPersonalSchema,
  counselCandidateSchema,
  counselCandidatesSchema,
  type CounselRequestInput,
  type CounselActionInput,
  type PartnerContext,
} from "@coverview/contracts/partner";
import type { partnerLeads } from "./partner.schema.js";
import {
  fail,
  lockActor,
  membership,
  contextForApplication,
  type PartnerActor,
} from "./partner.policy.js";
import { readAdvicePreferences } from "./partner.advice.js";
import { readNeedCapacity } from "./partner.need-capacity.js";
import { readNeedConflict } from "./partner.need-conflicts.js";
import { readNeedExpertise } from "./partner.need-expertise.js";
import { readNeedExpertiseSource } from "./partner.competence.js";
import { readPracticeSummary } from "./partner.practice.js";
import { readCurrentAvailability } from "./partner.availability.js";
import { readCapacityAssessment } from "./partner.capacity.js";
import { readLeadReferentState } from "./partner.referents.js";
import { proposeCollaboration, readCollaborations } from "./partner.collaboration.js";
import { event, newId } from "./partner.audit.js";
import { syncLeadNotifications } from "./partner.notifications.js";

type Lead = typeof partnerLeads.$inferSelect;
type Access = (
  tx: PoolClient,
  actor: PartnerActor,
  id: string,
) => Promise<{ lead: Lead; ctx: PartnerContext }>;
type Mutation = <T>(
  actor: PartnerActor,
  operation: string,
  key: string,
  input: unknown,
  action: (tx: PoolClient) => Promise<string>,
  project: (tx: PoolClient, id: string) => Promise<T>,
) => Promise<T>;
type RequestRow = {
  id: string;
  lead_id: string;
  author_id: string;
  subject_key: string;
  owner_id: string;
  context: string;
  source_basis: string;
  invalidated_at: Date | null;
  input: unknown;
  created_at: Date;
  author_name: string;
};
type ActionRow = {
  revision: number;
  action: "withdraw" | "follow_up" | "propose" | "resolve";
  reason: string;
  next_action: string | null;
  due_at: Date | null;
  collaboration_id: string | null;
  created_at: Date;
};
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const subject = (l: Lead) =>
  l.clientProfileId ? `profile:${l.clientProfileId}` : `self:${l.clientUserId}`;
const select = `select r.*,coalesce(m.application->>'name','') author_name from partner_counsel_requests r left join partner_members m on m.user_id=r.author_id`;
const closed = new Set(["accepted", "resolved", "withdrawn"]);
const cursorOf = (r: RequestRow) =>
  Buffer.from(JSON.stringify([r.created_at.toISOString(), r.id])).toString("base64url");
function cursorValue(cursor?: string): [string | null, string | null] {
  if (!cursor) return [null, null];
  try {
    const v: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(v) &&
      v.length === 2 &&
      typeof v[0] === "string" &&
      typeof v[1] === "string" &&
      Number.isFinite(Date.parse(v[0])) &&
      v[1].length <= 100
    )
      return [v[0], v[1]];
  } catch {
    /* invalid opaque cursor */
  }
  return fail("PARTNER_NOT_FOUND", 400);
}

export function createCounselOperations(
  pool: Pool,
  transaction: Mutation,
  personal: Access,
  administratorLead: Access,
  documentsAvailable: boolean,
) {
  const access = async (tx: PoolClient, actor: PartnerActor, id: string, own = false) => {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const read = actor.administrator && !own ? administratorLead : personal;
    let value = await read(tx, actor, id);
    await readAdvicePreferences(tx, actor, value.lead);
    value = await read(tx, actor, id); // owner may have changed during the profile lock wait
    const preferences = await readAdvicePreferences(tx, actor, value.lead);
    const context = hash({
      subject: subject(value.lead),
      owner: value.lead.clientUserId,
      scope: value.lead.adviceScopeRevision,
      profile: preferences.profileRevision,
      responsible: value.lead.responsibleId,
      assignment: value.lead.assignment,
      cycle: value.lead.notificationCycle,
    });
    return { ...value, preferences, context };
  };
  const authorized = async (tx: PoolClient, actor: PartnerActor, id: string) => {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const row = (await tx.query<RequestRow>(`${select} where r.id=$1`, [id])).rows[0];
    if (!row || (!actor.administrator && row.author_id !== actor.userId))
      fail("PARTNER_NOT_FOUND", 404);
    const current = await access(tx, actor, row.lead_id);
    if (row.subject_key !== subject(current.lead) || row.owner_id !== current.lead.clientUserId)
      fail("PARTNER_NOT_FOUND", 404);
    return { row, ...current };
  };
  const project = async (tx: PoolClient, actor: PartnerActor, id: string) => {
    const { row, lead, context } = await authorized(tx, actor, id);
    const history = (
      await tx.query<ActionRow>(
        "select * from partner_counsel_actions where request_id=$1 order by revision desc limit 20",
        [id],
      )
    ).rows;
    const latest = history[0];
    const collaborationId = (
      await tx.query<{ collaboration_id: string }>(
        "select collaboration_id from partner_counsel_actions where request_id=$1 and collaboration_id is not null order by revision desc limit 1",
        [id],
      )
    ).rows[0]?.collaboration_id;
    const collaborationState = collaborationId
      ? (
          await tx.query<{ state: string }>(
            "select state from partner_collaborations where id=$1",
            [collaborationId],
          )
        ).rows[0]?.state
      : null;
    const state =
      latest?.action === "withdraw"
        ? "withdrawn"
        : latest?.action === "resolve"
          ? "resolved"
          : collaborationState === "accepted"
            ? "accepted"
            : row.invalidated_at ||
                row.context !== context ||
                ["draft", "completed"].includes(lead.stage)
              ? "context_changed"
              : collaborationState === "proposed"
                ? "awaiting_specialist"
                : "open";
    const input = counselRequestInputSchema.parse(row.input);
    return counselRequestSchema.parse({
      id,
      leadId: lead.id,
      leadTitle: lead.title,
      authorName: row.author_name,
      createdAt: row.created_at.toISOString(),
      request: {
        kind: input.kind,
        summary: input.summary,
        nextAction: input.nextAction,
        dueAt: input.dueAt,
      },
      revision: latest?.revision ?? 0,
      state,
      nextAction: latest?.next_action ?? input.nextAction,
      dueAt: closed.has(state) ? null : (latest?.due_at?.toISOString() ?? input.dueAt),
      canWithdraw:
        row.author_id === actor.userId && !closed.has(state) && collaborationState !== "proposed",
      canAct: actor.administrator && !closed.has(state),
      collaboration: collaborationId
        ? ((await readCollaborations(tx, actor, lead.id, collaborationId))[0] ?? null)
        : null,
      history: history.map((h) => ({
        revision: h.revision,
        action: h.action,
        reason: h.reason,
        nextAction: h.next_action,
        dueAt: h.due_at?.toISOString() ?? null,
        recordedAt: h.created_at.toISOString(),
      })),
    });
  };
  const personalView = async (tx: PoolClient, actor: PartnerActor, id: string, cursor?: string) => {
    const { lead, ctx, context } = await access(tx, actor, id, true);
    const assessedAt = new Date().toISOString();
    const capacity = await readNeedCapacity(tx, actor, lead, ctx.application, assessedAt);
    const conflict = await readNeedConflict(tx, actor, lead, ctx.application, assessedAt);
    const expertise = await readNeedExpertise(
      tx,
      actor,
      lead,
      ctx.application,
      assessedAt,
      documentsAvailable,
      undefined,
      true,
    );
    const refs = [capacity, conflict, expertise].map((d) => [
      d.revision,
      d.scopeFingerprint,
      d.status,
      d.effectivePosition,
    ]);
    const [at, after] = cursorValue(cursor);
    const rows = (
      await tx.query<RequestRow>(
        `${select} where r.lead_id=$1 and r.author_id=$2 and r.subject_key=$3 and r.owner_id=$4
      and ($5::timestamptz is null or (r.created_at,r.id)<($5::timestamptz,$6)) order by r.created_at desc,r.id desc limit 21`,
        [id, actor.userId, subject(lead), lead.clientUserId, at, after],
      )
    ).rows;
    const items = [];
    for (const r of rows.slice(0, 20)) items.push(await project(tx, actor, r.id));
    const open = (
      await tx.query(
        `select r.id from partner_counsel_requests r
      left join lateral(select action,collaboration_id from partner_counsel_actions where request_id=r.id order by revision desc limit 1) a on true
      where r.lead_id=$1 and r.author_id=$2 and r.context=$3 and r.invalidated_at is null and coalesce(a.action,'open') not in ('withdraw','resolve')
      and not exists(select 1 from partner_counsel_actions ca join partner_collaborations c on c.id=ca.collaboration_id where ca.request_id=r.id and c.state='accepted') limit 1`,
        [id, actor.userId, context],
      )
    ).rowCount;
    await lockActor(tx, actor);
    return counselPersonalSchema.parse({
      basis: hash({ context, refs }),
      assessedAt,
      capacity,
      conflict,
      expertise,
      canRequest: !!lead.clientUserId && !open,
      requests: { items, nextCursor: rows.length > 20 ? cursorOf(rows[19]!) : null },
    });
  };
  const candidate = async (
    tx: PoolClient,
    actor: PartnerActor,
    requestId: string,
    userId: string,
    writing = false,
  ) => {
    if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const member = await membership(tx, userId, writing);
    const { lead, preferences, context } = await authorized(tx, actor, requestId);
    if (
      !member ||
      !contextForApplication(member).canAdvise ||
      !member.categories.some((c) => c === lead.category) ||
      userId === lead.responsibleId ||
      userId === actor.userId
    )
      fail("PARTNER_INVALID_ASSIGNEE");
    const source = await readNeedExpertiseSource(
      tx,
      userId,
      lead.category,
      member,
      new Date().toISOString(),
      documentsAvailable,
      writing,
    );
    const practice = await readPracticeSummary(tx, userId),
      availability = await readCurrentAvailability(tx, member);
    const assessedAt = new Date().toISOString();
    const capacity = await readCapacityAssessment(
      tx,
      member,
      lead.category as Parameters<typeof readCapacityAssessment>[2],
      assessedAt,
    );
    const referent = await readLeadReferentState(tx, lead);
    const confirmed = preferences.status === "confirmed" ? preferences.current : null;
    const comparison = (requested: string | null | undefined, values: string[] | undefined) =>
      !requested || !values?.length
        ? ("unknown" as const)
        : values.includes(requested)
          ? ("matches" as const)
          : ("differs" as const);
    const value = {
      id: userId,
      name: member.name,
      organization: member.organization,
      competence: source.evidence.summary,
      competenceSourceStatus: source.evidence.sourceStatus,
      practice,
      capacity,
      language: comparison(confirmed?.languageCode, practice.languageCodes),
      region:
        confirmed && ["video", "phone"].includes(confirmed.mode ?? "")
          ? ("not_applicable" as const)
          : confirmed && ["home", "office"].includes(confirmed.mode ?? "")
            ? comparison(confirmed.canton, practice.cantons)
            : ("unknown" as const),
      mode: comparison(
        confirmed?.mode,
        availability?.professionalScope === "current" ? availability.modes : undefined,
      ),
      confirmedReferent:
        referent.status === "human_review" &&
        referent.selection?.status === "chosen" &&
        referent.selection.advisor?.id === userId,
      availabilityDeclaredAt: availability?.declaredAt ?? null,
      remainingChecks: [
        "need_expertise",
        "need_capacity",
        "conflicts",
        "distribution",
        "client_agreement",
      ],
      decision: "human_review_required" as const,
    };
    return counselCandidateSchema.parse({
      ...value,
      assessedAt,
      basis: hash({
        context,
        member,
        preferences: [preferences.revision, preferences.status],
        source: source.reference,
        availability,
        referent,
        ...value,
      }),
    });
  };
  async function read<T>(actor: PartnerActor, action: (tx: PoolClient) => Promise<T>) {
    const tx = await pool.connect();
    try {
      await tx.query("begin isolation level repeatable read");
      await lockActor(tx, actor);
      const result = await action(tx);
      await lockActor(tx, actor);
      await tx.query("commit");
      return result;
    } catch (cause) {
      await tx.query("rollback");
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "40001")
        fail("PARTNER_CONFLICT", 409);
      throw cause;
    } finally {
      tx.release();
    }
  }
  return {
    counselPersonal: (actor: PartnerActor, id: string, cursor?: string) =>
      read(actor, (tx) => personalView(tx, actor, id, cursor)),
    counselRequest: (actor: PartnerActor, id: string) =>
      read(actor, (tx) => project(tx, actor, id)),
    requestCounsel: (actor: PartnerActor, id: string, raw: CounselRequestInput, key: string) => {
      const input = counselRequestInputSchema.parse(raw);
      let wrote = false;
      return transaction(
        actor,
        `counsel.request:${id}`,
        key,
        input,
        async (tx) => {
          const current = await personalView(tx, actor, id);
          if (current.basis !== input.basis) fail("PARTNER_CONFLICT", 409);
          if (!current.canRequest || Date.parse(input.dueAt) <= Date.now())
            fail("PARTNER_ACTION_REQUIRED");
          const { lead, context } = await access(tx, actor, id, true),
            requestId = newId("counsel");
          await tx.query(
            `insert into partner_counsel_requests(id,lead_id,author_id,subject_key,owner_id,context,source_basis,input)
          values($1,$2,$3,$4,$5,$6,$7,$8)`,
            [
              requestId,
              id,
              actor.userId,
              subject(lead),
              lead.clientUserId,
              context,
              input.basis,
              JSON.stringify(input),
            ],
          );
          // The chosen summary is only exposed by the dedicated CoverView projection.
          await event(tx, actor, id, "counsel.requested.v1", "", "coverview", requestId);
          wrote = true;
          return requestId;
        },
        async (tx, target) => {
          await access(tx, actor, id, true);
          const value = await project(tx, actor, target);
          if (
            wrote &&
            ((await personalView(tx, actor, id)).basis !== input.basis ||
              Date.parse(input.dueAt) <= Date.now())
          )
            fail("PARTNER_CONFLICT", 409);
          await lockActor(tx, actor);
          return value;
        },
      );
    },
    counselQueue: (actor: PartnerActor, cursor?: string) =>
      read(actor, async (tx) => {
        if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const [at, after] = cursorValue(cursor);
        const rows = (
          await tx.query<RequestRow>(
            `${select}
        left join lateral(select action from partner_counsel_actions where request_id=r.id order by revision desc limit 1) a on true
        where coalesce(a.action,'open') not in ('withdraw','resolve')
        and not exists(select 1 from partner_counsel_actions ca join partner_collaborations c on c.id=ca.collaboration_id where ca.request_id=r.id and c.state='accepted')
        and ($1::timestamptz is null or (r.created_at,r.id)>($1::timestamptz,$2))
        and r.subject_key=case when l.client_profile_id is null then 'self:'||l.client_user_id else 'profile:'||l.client_profile_id end
        and r.owner_id=coalesce(mp.user_id,l.client_user_id)
        order by r.created_at,r.id limit 21`.replace(
              "left join lateral",
              "join partner_leads l on l.id=r.lead_id left join managed_profiles mp on mp.id=l.client_profile_id left join lateral",
            ),
            [at, after],
          )
        ).rows;
        // Multiple queue entries must acquire their shared Lead guards in the same order as
        // coordinated writes. Sources then remain in one repeatable-read observation.
        await tx.query(
          "select id from partner_leads where id=any($1::text[]) order by id for update",
          [[...new Set(rows.slice(0, 20).map((r) => r.lead_id))].sort()],
        );
        const items = [];
        for (const row of rows.slice(0, 20)) items.push(await project(tx, actor, row.id));
        return counselQueueSchema.parse({
          items,
          nextCursor: rows.length > 20 ? cursorOf(rows[19]!) : null,
        });
      }),
    counselCandidates: (actor: PartnerActor, id: string, cursor?: string) =>
      read(actor, async (tx) => {
        if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const value = await project(tx, actor, id);
        if (value.state !== "open") fail("PARTNER_ACTION_REQUIRED");
        const { lead } = await authorized(tx, actor, id);
        const rows = (
          await tx.query<{ user_id: string }>(
            `select m.user_id from partner_members m join partner_organizations o on o.id=m.organization_id
        where m.state='approved' and o.state='approved' and m.roles ? 'advisor' and m.application->'categories' ? $1
        and (m.review_due_at is null or m.review_due_at>clock_timestamp()) and m.user_id<>$2 and m.user_id is distinct from $3
        and ($4::text is null or m.user_id>$4) order by m.user_id limit 21`,
            [lead.category, actor.userId, lead.responsibleId, cursor ?? null],
          )
        ).rows;
        const items = [];
        for (const r of rows.slice(0, 20)) items.push(await candidate(tx, actor, id, r.user_id));
        return counselCandidatesSchema.parse({
          items,
          nextCursor: rows.length > 20 ? rows[19]!.user_id : null,
        });
      }),
    actCounsel: (actor: PartnerActor, id: string, raw: CounselActionInput, key: string) => {
      const input = counselActionInputSchema.parse(raw);
      if (actor.wallet || (input.action !== "withdraw" && !actor.administrator))
        fail("PARTNER_ACCESS_DENIED", 403);
      let wrote = false;
      return transaction(
        actor,
        `counsel.action:${id}`,
        key,
        input,
        async (tx) => {
          // Match the membership -> Lead order before any collaboration/source writes.
          if (input.action === "propose") await membership(tx, input.terms.targetId, true);
          const current = await project(tx, actor, id);
          if (current.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          if (input.action === "withdraw" ? !current.canWithdraw : !current.canAct)
            fail("PARTNER_ACCESS_DENIED", 403);
          if (
            (input.action === "propose" && current.state !== "open") ||
            (input.action === "follow_up" &&
              !["open", "awaiting_specialist"].includes(current.state))
          )
            fail("PARTNER_ACTION_REQUIRED");
          if (input.action === "resolve" && current.collaboration?.state === "proposed")
            fail("PARTNER_ACTION_REQUIRED");
          if ("dueAt" in input && Date.parse(input.dueAt) <= Date.now())
            fail("PARTNER_ACTION_REQUIRED");
          const { lead } = await authorized(tx, actor, id);
          let evidence = null,
            collaborationId: string | null = null;
          if (input.action === "propose") {
            evidence = await candidate(tx, actor, id, input.terms.targetId, true);
            if (evidence.basis !== input.candidateBasis) fail("PARTNER_CONFLICT", 409);
            collaborationId = await proposeCollaboration(tx, actor, lead, input.terms);
            await tx.query(
              "update partner_leads set revision=revision+1,updated_at=now() where id=$1",
              [lead.id],
            );
            await syncLeadNotifications(tx, lead.id);
          }
          await tx.query(
            `insert into partner_counsel_actions(id,request_id,revision,actor_id,action,reason,next_action,due_at,collaboration_id,evidence)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              newId("counselaction"),
              id,
              input.revision + 1,
              actor.userId,
              input.action,
              input.reason,
              "nextAction" in input ? input.nextAction : null,
              "dueAt" in input ? input.dueAt : null,
              collaborationId,
              evidence ? JSON.stringify(evidence) : null,
            ],
          );
          await event(tx, actor, lead.id, `counsel.${input.action}.v1`, "", "coverview", id);
          wrote = true;
          await lockActor(tx, actor);
          if ("dueAt" in input && Date.parse(input.dueAt) <= Date.now())
            fail("PARTNER_CONFLICT", 409);
          if (
            input.action === "propose" &&
            (await candidate(tx, actor, id, input.terms.targetId, true)).basis !==
              input.candidateBasis
          )
            fail("PARTNER_CONFLICT", 409);
          return id;
        },
        async (tx, target) => {
          const value = await project(tx, actor, target);
          if (
            wrote &&
            input.action === "propose" &&
            (await candidate(tx, actor, id, input.terms.targetId, true)).basis !==
              input.candidateBasis
          )
            fail("PARTNER_CONFLICT", 409);
          await lockActor(tx, actor);
          if (wrote && "dueAt" in input && Date.parse(input.dueAt) <= Date.now())
            fail("PARTNER_CONFLICT", 409);
          return value;
        },
      );
    },
  };
}
