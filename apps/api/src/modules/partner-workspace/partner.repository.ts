import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { documentAnalysisSchema } from "@coverview/contracts";
import {
  leadSummarySchema,
  leadDetailSchema,
  leadTaskSchema,
  leadAppointmentSchema,
  leadEventSchema,
  leadOfferSchema,
  partnerApplicationInputSchema,
  partnerReviewInputSchema,
  partnerDirectorySchema,
  partnerDashboardSchema,
  offerExtractionSchema,
  partnerWorkSchema,
  type LeadCreateInput,
  type LeadListQuery,
  type LeadSummary,
  type LeadDetail,
} from "@coverview/contracts/partner";
import {
  assigned,
  camel,
  context,
  date,
  fail,
  lockActor,
  managed,
  membership,
  ownedClient,
  visible,
  type Executor,
  type PartnerActor,
} from "./partner.policy.js";
import type { partnerLeads } from "./partner.schema.js";
import { executeLeadCommand, handoffWork } from "./partner.commands.js";
type LeadRow = typeof partnerLeads.$inferSelect;
import { newId, event } from "./partner.audit.js";
const selectLead = `select l.*, coalesce((select application->>'name' from partner_members where user_id=l.responsible_id),(select email from identity_users where id=l.responsible_id)) responsible_name,
 coalesce((select cp.user_id from managed_profiles cp where cp.id=l.client_profile_id),l.client_user_id) current_client_user_id,
 (select count(*)::int from partner_tasks t where t.lead_id=l.id and t.state='open') open_tasks,
 (select count(*)::int from partner_tasks t where t.lead_id=l.id and t.state='open' and t.due_at<now()) overdue_tasks,
 (select min(starts_at) from partner_appointments a where a.lead_id=l.id and a.state='scheduled' and a.starts_at>=now()) next_appointment_at,
 ${assigned} assigned_access, ${managed} managed_access, ${ownedClient} client_access,
 exists(select 1 from partner_contributors ec where ec.lead_id=l.id and ec.user_id=$1 and ec.revoked_at is null and ec.can_edit) contributor_edit
 from partner_leads l`;
type ReadRow = LeadRow & {
  currentClientUserId: string | null;
  responsibleName: string | null;
  openTasks: number;
  overdueTasks: number;
  nextAppointmentAt: Date | null;
  assignedAccess: boolean;
  managedAccess: boolean;
  clientAccess: boolean;
  contributorEdit: boolean;
};
function summary(actor: PartnerActor, row: ReadRow): LeadSummary {
  const operational =
    !actor.wallet &&
    (actor.administrator ||
      row.assignedAccess ||
      row.managedAccess ||
      (row.creatorId === actor.userId && row.stage === "draft" && !row.responsibleId));
  const access = actor.wallet ? "client" : operational ? "operational" : "progress";
  const waiting = row.waiting as { reason: string; until: string } | null;
  const now = Date.now(),
    active = row.stage !== "completed" && row.stage !== "draft";
  const alerts: LeadSummary["alerts"] = [];
  const firstActionDueAt = row.notifiedAt
    ? new Date(row.notifiedAt.getTime() + 86400000).toISOString()
    : null;
  const suspended = waiting && new Date(waiting.until).getTime() > now;
  if (active && operational) {
    if (!row.responsibleId) alerts.push("unassigned");
    if (!suspended) {
      if (!row.nextAction || !row.dueAt) alerts.push("no_next_action");
      if (row.dueAt && row.dueAt.getTime() < now) alerts.push("overdue");
      if (!row.firstUsefulAt && firstActionDueAt) {
        const remaining = new Date(firstActionDueAt).getTime() - now;
        if (remaining <= 0) alerts.push("first_action_overdue");
        else if (remaining < 4 * 3600000) alerts.push("first_action_due");
      }
    }
    if (waiting && new Date(waiting.until).getTime() <= now) alerts.push("waiting_expired");
    if (row.overdueTasks) alerts.push("task_overdue");
  }
  return leadSummarySchema.parse({
    id: row.id,
    revision: row.revision,
    title: row.title,
    category: row.category,
    object: row.object,
    clientName: row.clientName,
    clientUserId: operational || actor.wallet ? row.currentClientUserId : null,
    clientProfileId: operational || actor.wallet ? row.clientProfileId : null,
    stage: row.stage,
    assignment: row.assignment,
    responsibleId: row.responsibleId,
    responsibleName: row.responsibleName,
    referrerId: row.creatorId,
    priority: row.priority,
    nextAction: operational ? row.nextAction : "",
    dueAt: operational ? date(row.dueAt) : null,
    waiting: operational ? waiting : null,
    result: row.result,
    reason: operational || actor.wallet ? row.reason : null,
    estimatedCommissionMinor: operational ? row.estimatedCommissionMinor : null,
    notifiedAt: operational ? date(row.notifiedAt) : null,
    firstUsefulAt: operational ? date(row.firstUsefulAt) : null,
    firstActionDueAt: operational ? firstActionDueAt : null,
    createdAt: date(row.createdAt),
    stageChangedAt: date(row.stageChangedAt),
    updatedAt: date(row.updatedAt),
    openTasks: operational ? row.openTasks : 0,
    overdueTasks: operational ? row.overdueTasks : 0,
    nextAppointmentAt: operational || actor.wallet ? date(row.nextAppointmentAt) : null,
    alerts,
    access,
    canEdit:
      operational &&
      (actor.administrator ||
        row.responsibleId === actor.userId ||
        row.contributorEdit ||
        (row.creatorId === actor.userId && row.stage === "draft" && !row.responsibleId) ||
        row.managedAccess),
    canAssign: !actor.wallet && actor.administrator,
  });
}
async function readLead(db: Executor, actor: PartnerActor, id: string, lock = false) {
  const result = await db.query<Record<string, unknown>>(
    `${selectLead} where l.id=$2 and (${visible(actor)}) ${lock ? "for update of l" : ""}`,
    [actor.userId, id],
  );
  if (!result.rows[0]) return fail("PARTNER_NOT_FOUND", 404);
  return camel<ReadRow>(result.rows[0]);
}
async function detail(db: Executor, actor: PartnerActor, id: string): Promise<LeadDetail> {
  const row = await readLead(db, actor, id),
    base = summary(actor, row);
  const operational = base.access === "operational";
  const info = z
    .object({
      context: z.string(),
      email: z.string(),
      phone: z.string(),
      language: z.string(),
      source: z.string(),
      transmissionAuthorized: z.boolean(),
    })
    .parse(row.details);
  const tasks = operational
    ? (
        await db.query<Record<string, unknown>>(
          "select * from partner_tasks where lead_id=$1 order by state,due_at,id limit 100",
          [id],
        )
      ).rows.map((r) => {
        const task = camel<Record<string, unknown>>(r);
        return leadTaskSchema.parse({
          ...task,
          dueAt: date(r.due_at as Date),
          reminderAt: date(r.reminder_at as Date | null),
          completedAt: date(r.completed_at as Date | null),
        });
      })
    : [];
  const appointments =
    operational || actor.wallet
      ? (
          await db.query<Record<string, unknown>>(
            "select * from partner_appointments where lead_id=$1 order by starts_at desc,id limit 100",
            [id],
          )
        ).rows.map((r) =>
          leadAppointmentSchema.parse({
            ...camel<Record<string, unknown>>(r),
            startsAt: date(r.starts_at as Date),
          }),
        )
      : [];
  const events =
    base.access !== "progress"
      ? (
          await db.query<Record<string, unknown>>(
            `select * from partner_events where lead_id=$1 and (audience='client' or (not $3::boolean and (audience='private' and actor_id=$2 or audience='assigned' or audience='coverview' and $4::boolean))) order by created_at desc,id desc limit 100`,
            [id, actor.userId, !!actor.wallet, actor.administrator],
          )
        ).rows.map((r) =>
          leadEventSchema.parse({
            id: r.id,
            kind: r.kind,
            authorId: r.actor_id,
            audience: r.audience,
            text: r.text,
            createdAt: date(r.created_at as Date),
          }),
        )
      : [];
  const offers =
    base.access !== "progress"
      ? (
          await db.query<Record<string, unknown>>(
            `select * from partner_offers where lead_id=$1 ${actor.wallet ? "and published_at is not null" : ""} order by created_at desc,id limit 100`,
            [id],
          )
        ).rows.map((r) =>
          leadOfferSchema.parse({
            ...z.record(z.string(), z.unknown()).parse(r.data),
            id: r.id,
            version: r.version,
            active: r.active,
            state: r.state,
            reviewedAt: date(r.reviewed_at as Date | null),
            publishedAt: date(r.published_at as Date | null),
            createdAt: date(r.created_at as Date),
          }),
        )
      : [];
  return leadDetailSchema.parse({
    ...base,
    context: operational || actor.wallet ? info.context : null,
    email: operational ? info.email : null,
    phone: operational ? info.phone : null,
    language: operational ? info.language : null,
    source: operational ? info.source : null,
    transmissionAuthorized: operational ? info.transmissionAuthorized : null,
    tasks,
    appointments,
    events,
    offers,
    availableTabs:
      operational && (actor.administrator || row.assignedAccess || row.managedAccess)
        ? ["overview", "activity", "tasks", "appointments", "notes", "offers"]
        : actor.wallet
          ? ["overview", "activity", "appointments", "offers"]
          : ["overview"],
  });
}
export function createPartnerRepository(pool: Pool) {
  async function transaction<T>(
    actor: PartnerActor,
    operation: string,
    key: string,
    input: unknown,
    action: (tx: PoolClient) => Promise<string>,
    project: (tx: PoolClient, id: string) => Promise<T>,
  ) {
    if (!z.uuid().safeParse(key).success) fail("PARTNER_ACCESS_DENIED", 400);
    const tx = await pool.connect();
    try {
      await tx.query<Record<string, unknown>>("begin");
      await lockActor(tx, actor);
      const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
      const existing = (
        await tx.query<Record<string, unknown>>(
          "select * from partner_commands where user_id=$1 and key=$2",
          [actor.userId, key],
        )
      ).rows[0];
      let target: string;
      if (existing) {
        if (existing.operation !== operation || existing.hash !== hash)
          fail("PARTNER_IDEMPOTENCY_REUSED", 422);
        target = String(existing.target_id);
      } else {
        target = await action(tx);
        await tx.query<Record<string, unknown>>(
          "insert into partner_commands(id,user_id,key,operation,hash,target_id) values($1,$2,$3,$4,$5,$6)",
          [newId("pcmd"), actor.userId, key, operation, hash, target],
        );
      }
      // Re-project with current permissions, never replay a stale private response after transfer.
      const result = await project(tx, target);
      await tx.query<Record<string, unknown>>("commit");
      return result;
    } catch (error) {
      await tx.query<Record<string, unknown>>("rollback");
      throw error;
    } finally {
      tx.release();
    }
  }
  return {
    context: (actor: PartnerActor) => context(pool, actor),
    async sourceConsulted(actor: PartnerActor, id: string, offerId: string) {
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        await readLead(tx, actor, id, true);
        const lead = await detail(tx, actor, id),
          offer = lead.offers.find((value) => value.id === offerId);
        if (!offer) fail("PARTNER_NOT_FOUND", 404);
        const recent = await tx.query(
          "select id from partner_events where lead_id=$1 and actor_id=$2 and subject_id=$3 and kind='document.viewed' and created_at>now()-interval '30 minutes' limit 1",
          [id, actor.userId, offerId],
        );
        if (!recent.rowCount)
          await event(
            tx,
            actor,
            id,
            "document.viewed",
            `${offer.company} · ${offer.product}`,
            actor.wallet ? "client" : "assigned",
            offerId,
          );
        await tx.query("commit");
      } catch (cause) {
        await tx.query("rollback");
        throw cause;
      } finally {
        tx.release();
      }
    },
    async work(actor: PartnerActor) {
      if (!(await context(pool, actor)).operational) fail("PARTNER_ACCESS_DENIED", 403);
      const scope = `(${visible(actor)}) and (${actor.administrator ? "true" : `${assigned} or ${managed}`})`;
      const tasks = (
        await pool.query<Record<string, unknown>>(
          `select t.*,l.title lead_title,l.client_name from partner_tasks t join partner_leads l on l.id=t.lead_id where ${scope} and t.state='open' order by t.due_at,t.id limit 101`,
          [actor.userId],
        )
      ).rows;
      const appointments = (
        await pool.query<Record<string, unknown>>(
          `select a.*,l.title lead_title,l.client_name from partner_appointments a join partner_leads l on l.id=a.lead_id where ${scope} and a.state='scheduled' and a.starts_at>now()-interval '1 day' order by a.starts_at,a.id limit 101`,
          [actor.userId],
        )
      ).rows;
      return partnerWorkSchema.parse({
        tasks: tasks.slice(0, 100).map((row) => ({
          ...camel<Record<string, unknown>>(row),
          dueAt: date(row.due_at as Date),
          reminderAt: date(row.reminder_at as Date | null),
          completedAt: date(row.completed_at as Date | null),
        })),
        appointments: appointments.slice(0, 100).map((row) => ({
          ...camel<Record<string, unknown>>(row),
          startsAt: date(row.starts_at as Date),
        })),
        truncated: tasks.length > 100 || appointments.length > 100,
      });
    },
    async dashboard(actor: PartnerActor) {
      if (!(await context(pool, actor)).operational) fail("PARTNER_ACCESS_DENIED", 403);
      const rows = (
        await pool.query<Record<string, unknown>>(
          `select l.stage,count(*)::int count,count(*) filter(where l.stage not in ('draft','completed'))::int active,count(*) filter(where l.stage not in ('draft','completed') and l.due_at<now() and (l.waiting is null or (l.waiting->>'until')::timestamptz<=now()))::int overdue,count(*) filter(where l.responsible_id is null and l.stage not in ('draft','completed'))::int unassigned,count(*) filter(where l.result in ('contract','resolved_without_contract'))::int resolved from partner_leads l where ${visible(actor)} group by l.stage`,
          [actor.userId],
        )
      ).rows;
      const tasks = (
        await pool.query<Record<string, unknown>>(
          `select count(*)::int count from partner_tasks t join partner_leads l on l.id=t.lead_id where t.state='open' and (${visible(actor)}) and (${actor.administrator ? "true" : `${assigned} or ${managed}`})`,
          [actor.userId],
        )
      ).rows[0];
      const sum = (key: string) => rows.reduce((total, row) => total + Number(row[key]), 0);
      return partnerDashboardSchema.parse({
        active: sum("active"),
        overdue: sum("overdue"),
        unassigned: sum("unassigned"),
        resolved: sum("resolved"),
        openTasks: Number(tasks?.count ?? 0),
        stages: rows.map((row) => ({ stage: row.stage, count: Number(row.count) })),
      });
    },
    async applications(actor: PartnerActor) {
      if (!actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
      const ids = (
        await pool.query<Record<string, unknown>>(
          "select user_id from partner_members order by created_at desc,user_id limit 100",
        )
      ).rows;
      const items = [];
      for (const row of ids) {
        const member = await membership(pool, String(row.user_id));
        if (member) items.push(member);
      }
      return { items };
    },
    apply(actor: PartnerActor, input: z.infer<typeof partnerApplicationInputSchema>, key: string) {
      return transaction(
        actor,
        "apply",
        key,
        input,
        async (tx) => {
          const existing = await membership(tx, actor.userId, true);
          if (existing && !["draft", "needs_information", "rejected"].includes(existing.state))
            fail("PARTNER_CONFLICT", 409);
          const organizationId = existing?.organizationId ?? newId("porg");
          if (!existing)
            await tx.query<Record<string, unknown>>(
              "insert into partner_organizations(id,name) values($1,$2)",
              [organizationId, input.organization],
            );
          await tx.query<Record<string, unknown>>(
            `insert into partner_members(user_id,organization_id,application) values($1,$2,$3) on conflict(user_id) do update set application=excluded.application,state='submitted',roles='[]',revision=partner_members.revision+1`,
            [actor.userId, organizationId, JSON.stringify(input)],
          );
          await event(
            tx,
            actor,
            null,
            "application.submitted",
            input.organization,
            "coverview",
            actor.userId,
          );
          return actor.userId;
        },
        async (tx) => context(tx, actor),
      );
    },
    review(
      actor: PartnerActor,
      userId: string,
      input: z.infer<typeof partnerReviewInputSchema>,
      key: string,
    ) {
      return transaction(
        actor,
        `review:${userId}`,
        key,
        input,
        async (tx) => {
          if (!actor.administrator) fail("PARTNER_ACCESS_DENIED", 403);
          const member = await membership(tx, userId);
          if (!member || member.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          if (input.state === "approved" && !input.roles.length) fail("PARTNER_ACTION_REQUIRED");
          const reviewed = await tx.query<Record<string, unknown>>(
            "update partner_members set state=$2,roles=$3,review_reason=$4,reviewed_by=$5,reviewed_at=now(),review_due_at=$6,revision=revision+1 where user_id=$1 and revision=$7",
            [
              userId,
              input.state,
              JSON.stringify(input.roles),
              input.reason,
              actor.userId,
              input.reviewDueAt,
              input.revision,
            ],
          );
          if (!reviewed.rowCount) fail("PARTNER_CONFLICT", 409);
          if (input.organizationState)
            await tx.query<Record<string, unknown>>(
              "update partner_organizations set state=$2,reviewed_by=$3,review_reason=$4,reviewed_at=now() where id=$1",
              [member.organizationId, input.organizationState, actor.userId, input.reason],
            );
          if (
            input.state !== "approved" ||
            !input.roles.includes("advisor") ||
            (input.organizationState && input.organizationState !== "approved")
          ) {
            const revoked =
              input.organizationState && input.organizationState !== "approved"
                ? (
                    await tx.query<Record<string, unknown>>(
                      "select user_id from partner_members where organization_id=$1",
                      [member.organizationId],
                    )
                  ).rows.map((r) => String(r.user_id))
                : [userId];
            const leads = (
              await tx.query<Record<string, unknown>>(
                "update partner_leads set responsible_id=null,assignment='reassign',updated_at=now(),revision=revision+1 where responsible_id=any($1::text[]) and stage<>'completed' returning id",
                [revoked],
              )
            ).rows;
            await tx.query<Record<string, unknown>>(
              "update partner_contributors set revoked_at=now() where user_id=any($1::text[]) and revoked_at is null",
              [revoked],
            );
            for (const lead of leads) {
              await handoffWork(tx, actor, String(lead.id), null);
              await event(
                tx,
                actor,
                String(lead.id),
                "lead.reassignment_required",
                "CoverView recherche un nouvel interlocuteur pour votre demande.",
                "client",
              );
            }
          }
          await event(
            tx,
            actor,
            null,
            `application.${input.state}`,
            input.reason,
            "coverview",
            userId,
          );
          return userId;
        },
        async (tx, id) => {
          const application = await membership(tx, id);
          if (!application) return fail("PARTNER_NOT_FOUND", 404);
          return application;
        },
      );
    },
    async directory(actor: PartnerActor) {
      const ctx = await context(pool, actor);
      if (!ctx.operational) fail("PARTNER_ACCESS_DENIED", 403);
      const result = await pool.query<Record<string, unknown>>(
        `select m.user_id id,m.application->>'name' name,m.application->>'organization' organization,m.application->'categories' categories from partner_members m join partner_organizations o on o.id=m.organization_id where m.state='approved' and o.state='approved' and m.roles ? 'advisor' and (m.review_due_at is null or m.review_due_at>now()) order by m.application->>'name',m.user_id limit 100`,
      );
      return partnerDirectorySchema.parse({ items: result.rows });
    },
    async list(actor: PartnerActor, query: LeadListQuery) {
      if (!actor.wallet && !(await context(pool, actor)).operational)
        fail("PARTNER_ACCESS_DENIED", 403);
      const values: unknown[] = [actor.userId],
        clauses = [`(${visible(actor)})`];
      const add = (expression: string, value: unknown) => {
        values.push(value);
        clauses.push(expression.replace("?", `$${values.length}`));
      };
      if (query.q)
        add(
          "(l.title || ' ' || l.client_name || ' ' || l.object) ilike ?",
          `%${query.q.replace(/[\\%_]/gu, "\\$&")}%`,
        );
      if (query.stage) add("l.stage=?", query.stage);
      if (query.category) add("l.category=?", query.category);
      if (query.responsibleId) add("l.responsible_id=?", query.responsibleId);
      if (query.clientUserId)
        add(
          "coalesce((select cp.user_id from managed_profiles cp where cp.id=l.client_profile_id),l.client_user_id)=?",
          query.clientUserId,
        );
      if (query.clientProfileId === "self") clauses.push("l.client_profile_id is null");
      else if (query.clientProfileId) add("l.client_profile_id=?", query.clientProfileId);
      if (query.view === "mine" && !actor.wallet && !actor.administrator) clauses.push(assigned);
      if (query.view === "referred") clauses.push("l.creator_id=$1");
      if (query.view === "urgent") clauses.push("l.priority='urgent'");
      if (query.view === "overdue")
        clauses.push(
          "l.due_at<now() and l.stage<>'completed' and (l.waiting is null or (l.waiting->>'until')::timestamptz<=now())",
        );
      if (query.view === "no_action")
        clauses.push(
          "(l.next_action='' or l.due_at is null) and l.stage not in ('draft','completed')",
        );
      if (query.view === "closed") clauses.push("l.stage='completed'");
      if (query.cursor) {
        let cursor: unknown;
        try {
          cursor = JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8"));
        } catch {
          fail("PARTNER_NOT_FOUND", 400);
        }
        const parsed = z
          .object({ at: z.iso.datetime(), id: z.string().max(100) })
          .safeParse(cursor);
        if (!parsed.success) fail("PARTNER_NOT_FOUND", 400);
        values.push(parsed.data.at, parsed.data.id);
        clauses.push(`(l.created_at,l.id)<($${values.length - 1}::timestamptz,$${values.length})`);
      }
      values.push(query.limit + 1);
      const result = await pool.query<Record<string, unknown>>(
        `${selectLead} where ${clauses.join(" and ")} order by l.created_at desc,l.id desc limit $${values.length}`,
        values,
      );
      const rows = result.rows.slice(0, query.limit).map((r) => camel<ReadRow>(r)),
        last = rows.at(-1);
      return {
        items: rows.map((row) => summary(actor, row)),
        nextCursor:
          result.rows.length > query.limit && last
            ? Buffer.from(
                JSON.stringify({ at: last.createdAt.toISOString(), id: last.id }),
              ).toString("base64url")
            : null,
      };
    },
    detail: (actor: PartnerActor, id: string) => detail(pool, actor, id),
    async extraction(actor: PartnerActor, leadId: string, documentId: string) {
      const lead = await readLead(pool, actor, leadId);
      if (!summary(actor, lead).canEdit) fail("PARTNER_ACCESS_DENIED", 403);
      const source = (
        await pool.query<Record<string, unknown>>(
          "select * from files where id=$1 and user_id=$2 and deleted_at is null",
          [documentId, actor.userId],
        )
      ).rows[0];
      if (!source) fail("PARTNER_INVALID_DOCUMENT");
      const parsed = documentAnalysisSchema.safeParse(source.analysis),
        analysis = parsed.success ? parsed.data : null,
        insurance = analysis?.insurance;
      const premium = insurance?.premium,
        factor =
          premium?.period === "year"
            ? 1
            : premium?.period === "month"
              ? 12
              : premium?.period === "quarter"
                ? 4
                : premium?.period === "half_year"
                  ? 2
                  : null;
      return offerExtractionSchema.parse({
        documentId,
        state: source.state,
        company: insurance?.companyId ?? null,
        product: analysis?.title ?? null,
        annualPremiumMinor:
          premium?.currency === "CHF" && factor ? premium.amountMinor * factor : null,
        premiumOrigin: factor === 1 ? "extracted" : factor ? "calculated" : "missing",
        premiumSource: premium ? JSON.stringify(premium.source) : null,
        reference: insurance?.policyNumber?.value ?? null,
        effectiveDate: insurance?.startsOn?.value ?? null,
      });
    },
    create(actor: PartnerActor, input: LeadCreateInput, key: string) {
      return transaction(
        actor,
        "create_lead",
        key,
        input,
        async (tx) => {
          const ctx = await context(tx, actor, true);
          if (!actor.wallet && !ctx.canCreate) fail("PARTNER_ACCESS_DENIED", 403);
          if (
            !input.draft &&
            ((!actor.wallet && (!input.nextAction || !input.dueAt)) ||
              !input.transmissionAuthorized)
          )
            fail("PARTNER_ACTION_REQUIRED");
          let name = input.clientName;
          if (input.clientUserId) {
            if (!actor.administrator && input.clientUserId !== actor.userId) {
              const allowed = await tx.query<Record<string, unknown>>(
                `select l.id from partner_leads l where (${visible(actor)}) and ${assigned} and coalesce((select cp.user_id from managed_profiles cp where cp.id=l.client_profile_id),l.client_user_id)=$2 and l.client_profile_id is not distinct from $3 limit 1`,
                [actor.userId, input.clientUserId, input.clientProfileId],
              );
              if (!allowed.rowCount) fail("PARTNER_INVALID_CLIENT");
            }
            if (input.clientProfileId) {
              const person = await tx.query<Record<string, unknown>>(
                "select display_name from managed_profiles where id=$1 and user_id=$2 for share",
                [input.clientProfileId, input.clientUserId],
              );
              if (!person.rowCount) fail("PARTNER_INVALID_CLIENT");
              name = String(person.rows[0]?.display_name);
            } else {
              const person = await tx.query<Record<string, unknown>>(
                "select fields from identity_profiles where user_id=$1 for share",
                [input.clientUserId],
              );
              if (!person.rowCount) fail("PARTNER_INVALID_CLIENT");
              const fields = z.record(z.string(), z.unknown()).parse(person.rows[0]?.fields);
              const field = z.object({ value: z.string() });
              const first = field.safeParse(fields.firstName),
                last = field.safeParse(fields.lastName);
              if (first.success && last.success) name = `${first.data.value} ${last.data.value}`;
            }
          } else if (input.clientProfileId || actor.wallet) fail("PARTNER_INVALID_CLIENT");
          if (actor.wallet && input.clientUserId !== actor.userId) fail("PARTNER_INVALID_CLIENT");
          const id = newId("lead"),
            responsibleId =
              !actor.wallet &&
              ctx.canAdvise &&
              (actor.administrator || ctx.application?.categories.includes(input.category))
                ? actor.userId
                : null;
          await tx.query<Record<string, unknown>>(
            `insert into partner_leads(id,creator_id,responsible_id,client_user_id,client_profile_id,title,category,object,client_name,details,stage,assignment,priority,next_action,due_at,notified_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,case when $3::text is null or $11='draft' then null else now() end)`,
            [
              id,
              actor.userId,
              responsibleId,
              input.clientUserId,
              input.clientProfileId,
              input.title,
              input.category,
              input.object,
              name,
              JSON.stringify({
                context: input.context,
                email: input.email,
                phone: input.phone,
                language: input.language,
                source: input.source,
                transmissionAuthorized: input.transmissionAuthorized,
              }),
              input.draft ? "draft" : "new",
              responsibleId ? "accepted" : "unassigned",
              input.priority,
              actor.wallet ? "Qualifier la demande du client" : input.nextAction,
              actor.wallet ? new Date(Date.now() + 86400000).toISOString() : input.dueAt,
            ],
          );
          await event(tx, actor, id, "lead.created", input.title, "client");
          return id;
        },
        (tx, id) => detail(tx, actor, id),
      );
    },
    command(
      actor: PartnerActor,
      id: string,
      input: Parameters<typeof executeLeadCommand>[3],
      key: string,
    ) {
      return transaction(
        actor,
        `lead:${id}`,
        key,
        input,
        async (tx) => {
          const ctx = await context(tx, actor, true);
          if (!actor.wallet && !ctx.operational) fail("PARTNER_ACCESS_DENIED", 403);
          const lead = await readLead(tx, actor, id, true),
            access = summary(actor, lead);
          if (lead.revision !== input.revision) fail("PARTNER_CONFLICT", 409);
          if (actor.wallet ? input.action !== "client_choice" : !access.canEdit)
            fail("PARTNER_ACCESS_DENIED", 403);
          if (!actor.wallet && !ctx.canAdvise && !ctx.canManage && input.action !== "edit")
            fail("PARTNER_ACCESS_DENIED", 403);
          if (
            !actor.wallet &&
            ["offer", "offer_review", "offer_publish"].includes(input.action) &&
            !ctx.canAdvise
          )
            fail("PARTNER_ACCESS_DENIED", 403);
          await executeLeadCommand(
            tx,
            actor,
            { ...lead, clientUserId: lead.currentClientUserId },
            input,
          );
          await tx.query<Record<string, unknown>>(
            "update partner_leads set revision=revision+1,updated_at=now() where id=$1",
            [id],
          );
          return id;
        },
        (tx, target) => detail(tx, actor, target),
      );
    },
  };
}
