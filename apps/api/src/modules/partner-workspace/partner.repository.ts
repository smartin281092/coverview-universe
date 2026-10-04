import { readDistributionReview, recordDistributionReview } from "./partner.distribution-review.js";
import { readSolutionClauses, recordSolutionClauses } from "./partner.solution-clauses.js";
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { documentAnalysisSchema } from "@coverview/contracts";
import {
  distributionReviewInputSchema,
  type DistributionReviewInput,
  solutionClausesInputSchema,
  type SolutionClausesInput,
  needExpertiseEvidenceSchema,
  solutionBindingInputSchema,
  solutionBindingQuerySchema,
  type SolutionBindingInput,
  solutionEvidenceQuerySchema,
  type SolutionEvidenceQuery,
  needExpertiseInputSchema,
  type NeedExpertiseInput,
  needConflictInputSchema,
  type NeedConflictInput,
  needCapacityInputSchema,
  type NeedCapacityInput,
  leadSummarySchema,
  leadCommandSchema,
  leadDetailSchema,
  leadTaskSchema,
  leadAppointmentSchema,
  leadEventSchema,
  partnerApplicationInputSchema,
  partnerReviewInputSchema,
  partnerDirectorySchema,
  partnerDashboardSchema,
  offerExtractionSchema,
  partnerWorkSchema,
  partnerContinuityUpdateSchema,
  insuranceLeadConsentSchema,
  offerImportInputSchema,
  offerImportRetrySchema,
  referentUpdateSchema,
  referentQuerySchema,
  advicePreferencesInputSchema,
  appointmentTimeInputSchema,
  personalAppointmentProposalSchema,
  personalAppointmentConfirmSchema,
  type PersonalAppointmentProposal,
  type PersonalAppointmentConfirm,
  type AppointmentTimeInput,
  type AdvicePreferencesInput,
  type PartnerContinuityUpdate,
  type LeadCreateInput,
  type LeadListQuery,
  type LeadSummary,
  type LeadDetail,
  type PartnerNotificationQuery,
  type CollaborationResponse,
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
import { executeLeadCommand } from "./partner.commands.js";
import { readOffers } from "./partner.offers.js";
import { readSolutionBinding, recordSolutionBinding } from "./partner.solution-binding.js";
import { readSolutionEvidence } from "./partner.solution-evidence.js";
import { readBoundSolutionEvidence } from "./partner.bound-solution-evidence.js";
import { readFinalPolicies } from "./partner.final-policy.js";
import { readOfferImports } from "./partner.imports.js";
import {
  readReferentProfile,
  updateReferent,
  readReferentContinuity,
} from "./partner.referents.js";
import {
  readCollaborations,
  respondCollaboration,
  reconcileCollaborations,
} from "./partner.collaboration.js";
import { handoffWork } from "./partner.participants.js";
import { createConventionOperations } from "./partner.convention.js";
import { createCompetenceOperations, readNeedCompetenceEvidence } from "./partner.competence.js";
import { createAvailabilityOperations } from "./partner.availability.js";
import { createCapacityOperations } from "./partner.capacity.js";
import { createSharedModesOperations } from "./partner.shared-modes.js";
import { readAppointmentAssessment } from "./partner.appointment-assessment.js";
import { protectAppointmentTime, recordAppointmentTime } from "./partner.appointment-time.js";
import { previewPersonalAppointment } from "./partner.appointment-creation.js";
import { createAppointmentLinkOperations } from "./partner.appointment-links.js";
import { createWalletAppointmentOperations } from "./partner.wallet-appointments.js";
import { createBookingOperations } from "./partner.booking.js";
import { createCounselOperations } from "./partner.counsel.js";
import { createPracticeOperations } from "./partner.practice.js";
import { readAdvicePreferences, confirmAdvicePreferences } from "./partner.advice.js";
import { readNeedConflict, decideNeedConflict } from "./partner.need-conflicts.js";
import { readNeedExpertise, decideNeedExpertise } from "./partner.need-expertise.js";
import { readPersonalNeedContext } from "./partner.need-context.js";
import { readNeedCapacity, decideNeedCapacity } from "./partner.need-capacity.js";
import { readAdvisorAssessment } from "./partner.advisor-assessment.js";
import { readReferentAssessment } from "./partner.referent-assessment.js";
import { followUpDeadline, followUpOverdueSql } from "./partner.follow-up.js";
import { readContinuitySettings, updateContinuitySettings } from "./partner.settings.js";
import {
  syncLeadNotifications,
  readPartnerNotifications,
  markPartnerNotificationRead,
} from "./partner.notifications.js";
type LeadRow = typeof partnerLeads.$inferSelect;
import { newId, event } from "./partner.audit.js";
import { createInsuranceLead, insuranceLinks, readInsuranceSource } from "./partner.insurance.js";
import {
  readCurrentContract,
  compareCurrentContract,
  lockContractSubject,
} from "./partner.contract.js";
import {
  readContractCandidates,
  leadSourceSnapshot,
  leadSourceReviewRevisionSql,
  createLeadOfferUpload,
  queueLeadOfferUpload,
  leadImportAnalysis,
} from "../document-intelligence/index.js";
const selectLead = `select l.*, coalesce((select application->>'name' from partner_members where user_id=l.responsible_id),(select email from identity_users where id=l.responsible_id)) responsible_name,
 coalesce((select cp.user_id from managed_profiles cp where cp.id=l.client_profile_id),l.client_user_id) current_client_user_id,
 (select count(*)::int from partner_tasks t where t.lead_id=l.id and t.state='open') open_tasks,
 (select count(*)::int from partner_tasks t where t.lead_id=l.id and t.state='open' and t.due_at<now()) overdue_tasks,
 (select min(starts_at) from partner_appointments a where a.lead_id=l.id and a.state='scheduled' and a.starts_at>=now()) next_appointment_at,
 ${assigned} assigned_access, ${managed} managed_access, ${ownedClient} client_access,
 exists(select 1 from partner_contributors ec where ec.lead_id=l.id and ec.user_id=$1 and ec.revoked_at is null and ec.can_edit and ec.access_scope='advice') contributor_edit,
 exists(select 1 from partner_contributors ec where ec.lead_id=l.id and ec.user_id=$1 and ec.revoked_at is null and ec.can_contact and ec.access_scope='advice') contributor_contact
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
  contributorContact: boolean;
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
  const deadlines = followUpDeadline({ ...row, waiting });
  const firstActionDueAt = date(deadlines.firstActionDueAt);
  const suspended = waiting && new Date(waiting.until).getTime() > now;
  const controls =
    !actor.wallet &&
    (actor.administrator || row.responsibleId === actor.userId || row.managedAccess);
  const actions = controls
    ? [
        "edit",
        "next_action",
        "transition",
        "contact",
        "note",
        "task",
        "task_state",
        "appointment",
        "appointment_state",
        "wait",
        "close",
        "offer",
        "offer_review",
        "contract_review",
        "final_policy_review",
        "offer_publish",
        "offer_withdraw",
      ]
    : operational && row.contributorEdit
      ? [
          "note",
          "task",
          "task_state",
          "offer",
          "offer_review",
          "contract_review",
          "final_policy_review",
          ...(row.contributorContact
            ? ["contact", "appointment", "appointment_state", "offer_publish", "offer_withdraw"]
            : []),
        ]
      : operational && row.stage === "draft" && row.creatorId === actor.userId
        ? ["edit"]
        : [];
  if (!actor.wallet && row.responsibleId === actor.userId && row.assignment === "proposed")
    actions.push("accept");
  if (!actor.wallet && actor.administrator) actions.push("assign");
  if (
    active &&
    !actor.wallet &&
    (actor.administrator ||
      (row.assignedAccess &&
        (row.responsibleId === actor.userId || (row.contributorEdit && row.contributorContact))))
  )
    actions.push("personal_appointment");
  const canCollaborate =
    active &&
    !!row.responsibleId &&
    !actor.wallet &&
    (actor.administrator || row.responsibleId === actor.userId);
  if (canCollaborate) actions.push("collaboration_propose");
  if (active && operational && (row.responsibleId === actor.userId || row.assignedAccess))
    actions.push("advisor_assessment");
  if (active && operational) {
    if (!row.responsibleId) alerts.push("unassigned");
    if (!suspended) {
      if (
        row.assignment === "proposed" &&
        !row.firstUsefulAt &&
        deadlines.acceptanceDueAt &&
        deadlines.acceptanceDueAt.getTime() <= now
      )
        alerts.push("acceptance_overdue");
      if (!row.nextAction || !row.dueAt) alerts.push("no_next_action");
      if (row.firstUsefulAt && row.dueAt && row.dueAt.getTime() <= now) alerts.push("overdue");
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
    acceptanceDueAt:
      active &&
      operational &&
      row.responsibleId &&
      row.assignment === "proposed" &&
      !row.firstUsefulAt
        ? date(deadlines.acceptanceDueAt)
        : null,
    continuityPolicyRevision: operational ? row.continuityPolicyRevision : null,
    continuityDueAt:
      active && operational && row.responsibleId ? date(deadlines.reviewDueAt) : null,
    escalationDueAt:
      active && operational && row.responsibleId ? date(deadlines.escalationDueAt) : null,
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
    canCollaborate,
    allowedActions: actions,
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
            `select e.*,case when o.id is not null then json_build_object('id',o.id,'version',o.version,'company',o.data->>'company','product',o.data->>'product') end offer,
             exists(select 1 from partner_notifications n where n.lead_id=e.lead_id and n.dedupe_key=e.id||':response' and n.resolved_at is null) response_pending
             from partner_events e
             left join partner_final_policies p on p.id=e.subject_id and p.lead_id=e.lead_id
             left join partner_offers o on o.id=coalesce(p.offer_id,e.subject_id) and o.lead_id=e.lead_id and (not $3::boolean or o.published_at is not null)
             where e.lead_id=$1 and (e.audience='client' or (not $3::boolean and (e.audience='private' and e.actor_id=$2 or e.audience='assigned' or e.audience='coverview' and $4::boolean)))
             and (e.kind<>'client.advice_preferences_confirmed.v1' or exists(select 1 from partner_advice_preferences ap where ap.id=e.subject_id and ap.lead_id=e.lead_id and ap.subject_id=$5))
             order by e.created_at desc,e.id desc limit 100`,
            [
              id,
              actor.userId,
              !!actor.wallet,
              actor.administrator,
              row.clientProfileId
                ? `profile:${row.clientProfileId}`
                : row.currentClientUserId
                  ? `self:${row.currentClientUserId}`
                  : null,
            ],
          )
        ).rows.map((r) =>
          leadEventSchema.parse({
            id: r.id,
            subjectId: r.subject_id,
            offer: r.offer,
            responsePending: r.response_pending,
            kind: r.kind,
            authorId: r.actor_id ?? "system_partner_continuity",
            systemActor: r.system_actor,
            audience: r.audience,
            text: r.text,
            createdAt: date(r.created_at as Date),
          }),
        )
      : [];
  const offers = base.access !== "progress" ? (await readOffers(db, id, !!actor.wallet)).items : [];
  const currentContract =
    base.access !== "progress"
      ? await readCurrentContract(db, { ...row, clientUserId: row.currentClientUserId })
      : null;
  return leadDetailSchema.parse({
    ...base,
    referentContinuity:
      operational || actor.wallet
        ? await readReferentContinuity(db, { ...row, clientUserId: row.currentClientUserId })
        : null,
    context: operational || actor.wallet ? info.context : null,
    email:
      operational &&
      (actor.administrator ||
        row.responsibleId === actor.userId ||
        row.managedAccess ||
        row.contributorContact)
        ? info.email
        : null,
    phone:
      operational &&
      (actor.administrator ||
        row.responsibleId === actor.userId ||
        row.managedAccess ||
        row.contributorContact)
        ? info.phone
        : null,
    language: operational ? info.language : null,
    source: operational ? info.source : null,
    insuranceRequestId:
      operational || actor.wallet
        ? ((
            await db.query<{ request_id: string }>(
              "select request_id from partner_insurance_sources where lead_id=$1",
              [id],
            )
          ).rows[0]?.request_id ?? null)
        : null,
    transmissionAuthorized: operational ? info.transmissionAuthorized : null,
    tasks,
    appointments,
    events,
    offers,
    currentContract,
    comparisons: compareCurrentContract(currentContract, offers),
    collaborations:
      !actor.wallet && base.access !== "progress" ? await readCollaborations(db, actor, id) : [],
    participants:
      operational || actor.wallet
        ? (
            await db.query(
              `select u.id,coalesce(m.application->>'name','CoverView') name,
              (u.id=$2 or coalesce(c.can_contact,false)) "canContact", (u.id=$2 or coalesce(c.can_edit,false)) "canWork" from identity_users u
      left join partner_members m on m.user_id=u.id left join partner_contributors c on c.user_id=u.id and c.lead_id=$1 and c.revoked_at is null
              where u.id=$2 or c.access_scope='advice' order by u.id limit 100`,
              [id, row.responsibleId],
            )
          ).rows
        : [],
    availableTabs:
      operational && (actor.administrator || row.assignedAccess || row.managedAccess)
        ? ["overview", "activity", "tasks", "appointments", "notes", "offers", "collaboration"]
        : actor.wallet
          ? ["overview", "activity", "appointments", "offers"]
          : ["overview"],
  });
}
export function createPartnerRepository(pool: Pool, documentsAvailable = true) {
  async function adviceLead(tx: PoolClient, actor: PartnerActor, id: string, write = false) {
    if (write && (!actor.wallet || actor.administrator)) fail("PARTNER_ACCESS_DENIED", 403);
    if (!actor.wallet && !(await context(tx, actor, true)).operational)
      fail("PARTNER_ACCESS_DENIED", 403);
    const lead = await readLead(tx, actor, id, true);
    if (summary(actor, lead).access === "progress") fail("PARTNER_NOT_FOUND", 404);
    if (write && lead.stage === "completed") fail("PARTNER_ACCESS_DENIED", 403);
    return { ...lead, clientUserId: lead.currentClientUserId };
  }
  async function importLead(tx: PoolClient, actor: PartnerActor, id: string, write = false) {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const ctx = await context(tx, actor, true);
    const lead = await readLead(tx, actor, id, true);
    const access = summary(actor, lead);
    if (!ctx.operational || access.access !== "operational") fail("PARTNER_NOT_FOUND", 404);
    const writable =
      ctx.canAdvise &&
      !!access.allowedActions?.includes("offer") &&
      !["draft", "completed"].includes(lead.stage);
    if (write && !writable) fail("PARTNER_ACCESS_DENIED", 403);
    return { lead, writable };
  }
  async function importResult(
    tx: PoolClient,
    actor: PartnerActor,
    leadId: string,
    id: string,
    write = false,
  ) {
    const { lead, writable } = await importLead(tx, actor, leadId, write);
    const item = (await readOfferImports(tx, leadId, writable, { id })).items[0];
    if (!item) return fail("PARTNER_NOT_FOUND", 404);
    return { leadRevision: lead.revision, item };
  }
  async function accessibleOffer(
    db: Executor,
    actor: PartnerActor,
    leadId: string,
    offerId: string,
  ) {
    const lead = await readLead(db, actor, leadId);
    if (summary(actor, lead).access === "progress") fail("PARTNER_NOT_FOUND", 404);
    const offer = (await readOffers(db, leadId, !!actor.wallet, { offerId })).items[0];
    if (!offer || !offer.canDownload) return fail("PARTNER_NOT_FOUND", 404);
    return offer;
  }
  async function withOfferAccess<T>(
    actor: PartnerActor,
    id: string,
    read: (tx: PoolClient) => Promise<T>,
  ) {
    const tx = await pool.connect();
    try {
      await tx.query("begin");
      await lockActor(tx, actor);
      const lead = await readLead(tx, actor, id, true);
      if (summary(actor, lead).access === "progress") fail("PARTNER_NOT_FOUND", 404);
      if (actor.wallet) {
        const subject = await lockContractSubject(tx, lead);
        if (subject.clientUserId !== actor.userId) fail("PARTNER_NOT_FOUND", 404);
      }
      const result = await read(tx);
      await tx.query("commit");
      return result;
    } catch (cause) {
      await tx.query("rollback");
      throw cause;
    } finally {
      tx.release();
    }
  }
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
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23P01" &&
        "constraint" in error &&
        error.constraint === "partner_protected_time_conflict"
      )
        fail("PARTNER_APPOINTMENT_CONFLICT", 409);
      throw error;
    } finally {
      tx.release();
    }
  }
  async function personalAdvisorLead(tx: PoolClient, actor: PartnerActor, id: string) {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const ctx = await context(tx, actor, true);
    if (!ctx.canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
    const lead = await readLead(tx, actor, id, true);
    if (summary(actor, lead).access !== "operational") fail("PARTNER_NOT_FOUND", 404);
    if (
      ["draft", "completed"].includes(lead.stage) ||
      (lead.responsibleId !== actor.userId && !lead.assignedAccess) ||
      (!actor.administrator && !ctx.application?.categories.some((c) => c === lead.category))
    )
      fail("PARTNER_ACCESS_DENIED", 403);
    return { ctx, lead: { ...lead, clientUserId: lead.currentClientUserId } };
  }
  async function personalAssessment(
    tx: PoolClient,
    actor: PartnerActor,
    id: string,
    appointmentId: string,
  ) {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const ctx = await context(tx, actor, true);
    if (!ctx.operational) fail("PARTNER_ACCESS_DENIED", 403);
    const lead = await readLead(tx, actor, id, true);
    const access = summary(actor, lead);
    if (access.access !== "operational") fail("PARTNER_NOT_FOUND", 404);
    const result = await readAppointmentAssessment(
      tx,
      actor,
      { ...lead, clientUserId: lead.currentClientUserId },
      appointmentId,
      ctx,
      !!access.allowedActions?.includes("appointment") &&
        !["draft", "completed"].includes(lead.stage) &&
        (actor.administrator ||
          lead.responsibleId === actor.userId ||
          (lead.contributorEdit && lead.contributorContact)),
      lead.revision,
    );
    return { result, ctx };
  }
  async function personalCreationLead(tx: PoolClient, actor: PartnerActor, id: string) {
    if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
    const ctx = await context(tx, actor, true);
    if (!ctx.canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
    const lead = await readLead(tx, actor, id, true);
    if (summary(actor, lead).access !== "operational") fail("PARTNER_NOT_FOUND", 404);
    if (
      ["draft", "completed"].includes(lead.stage) ||
      (!actor.administrator &&
        (!ctx.application?.categories.some((c) => c === lead.category) ||
          (lead.responsibleId !== actor.userId &&
            !(lead.contributorEdit && lead.contributorContact))))
    )
      fail("PARTNER_ACCESS_DENIED", 403);
    return { ctx, lead: { ...lead, clientUserId: lead.currentClientUserId } };
  }
  async function personalRescheduling(
    tx: PoolClient,
    actor: PartnerActor,
    id: string,
    appointmentId: string,
  ) {
    const authorized = await personalCreationLead(tx, actor, id);
    const row = (
      await tx.query<Record<string, unknown>>(
        "select * from partner_appointments where id=$1 and lead_id=$2 and advisor_id=$3 for update",
        [appointmentId, id, actor.userId],
      )
    ).rows[0];
    if (!row) fail("PARTNER_NOT_FOUND", 404);
    const terms = leadAppointmentSchema.parse({
      ...camel<Record<string, unknown>>(row),
      startsAt: date(row.starts_at as Date),
    });
    const previous = {
      ...terms,
      occupiedBeforeMinutes: Number(row.occupied_before_minutes),
      occupiedAfterMinutes: Number(row.occupied_after_minutes),
    };
    return { ...authorized, previous, row };
  }
  return {
    ...createCompetenceOperations(pool, transaction, documentsAvailable),
    ...createWalletAppointmentOperations(pool, transaction),
    ...createBookingOperations(pool, transaction),
    ...createCounselOperations(
      pool,
      transaction,
      personalAdvisorLead,
      async (tx, actor, id) => {
        if (!actor.administrator || actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
        const lead = await readLead(tx, actor, id, true);
        return {
          lead: { ...lead, clientUserId: lead.currentClientUserId },
          ctx: await context(tx, actor),
        };
      },
      documentsAvailable,
    ),
    ...createAppointmentLinkOperations(pool, transaction, async (db, actor, id) => {
      const lead = await readLead(db, actor, id);
      if (!actor.wallet && summary(actor, lead).access !== "operational")
        fail("PARTNER_NOT_FOUND", 404);
      return { ...lead, clientUserId: lead.currentClientUserId };
    }),
    async distributionReview(
      actor: PartnerActor,
      id: string,
      offerId: string,
      companyId: string,
      beforeRevision?: number,
    ) {
      referentQuerySchema.parse({ beforeRevision });
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const now = (await tx.query<{ at: Date }>("select transaction_timestamp() at")).rows[0]!.at;
        await lockActor(tx, actor);
        const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
        const dossier = await readDistributionReview(
          tx,
          actor,
          lead,
          ctx.application,
          offerId,
          companyId,
          now.toISOString(),
          documentsAvailable,
          beforeRevision,
          false,
        );
        await lockActor(tx, actor);
        if (!(await context(tx, actor)).canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
        await tx.query("commit");
        return dossier;
      } catch (cause) {
        await tx.query("rollback");
        if (cause && typeof cause === "object" && "code" in cause && cause.code === "40001")
          fail("PARTNER_CONFLICT", 409);
        throw cause;
      } finally {
        tx.release();
      }
    },
    recordDistributionReview(
      actor: PartnerActor,
      id: string,
      offerId: string,
      companyId: string,
      raw: DistributionReviewInput,
      key: string,
    ) {
      const input = distributionReviewInputSchema.parse(raw);
      return transaction(
        actor,
        `distribution-review:${id}:${offerId}:${companyId}`,
        key,
        input,
        async (tx) => {
          const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
          return recordDistributionReview(
            tx,
            actor,
            lead,
            ctx.application,
            offerId,
            companyId,
            input,
            documentsAvailable,
          );
        },
        async (tx) => {
          const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
          return await readDistributionReview(
            tx,
            actor,
            lead,
            ctx.application,
            offerId,
            companyId,
            new Date().toISOString(),
            documentsAvailable,
            undefined,
            true,
          );
        },
      );
    },
    async solutionClauses(
      actor: PartnerActor,
      id: string,
      offerId: string,
      companyId: string,
      beforeRevision?: number,
    ) {
      referentQuerySchema.parse({ beforeRevision });
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const now = (await tx.query<{ at: Date }>("select transaction_timestamp() at")).rows[0]!.at;
        await lockActor(tx, actor);
        const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
        const dossier = await readSolutionClauses(
          tx,
          actor,
          lead,
          ctx.application,
          offerId,
          companyId,
          now.toISOString(),
          documentsAvailable,
          beforeRevision,
          false,
        );
        await lockActor(tx, actor);
        if (!(await context(tx, actor)).canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
        await tx.query("commit");
        return dossier;
      } catch (cause) {
        await tx.query("rollback");
        if (cause && typeof cause === "object" && "code" in cause && cause.code === "40001")
          fail("PARTNER_CONFLICT", 409);
        throw cause;
      } finally {
        tx.release();
      }
    },
    recordSolutionClauses(
      actor: PartnerActor,
      id: string,
      offerId: string,
      companyId: string,
      raw: SolutionClausesInput,
      key: string,
    ) {
      const input = solutionClausesInputSchema.parse(raw);
      return transaction(
        actor,
        `solution-clauses:${id}:${offerId}:${companyId}`,
        key,
        input,
        async (tx) => {
          const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
          return recordSolutionClauses(
            tx,
            actor,
            lead,
            ctx.application,
            offerId,
            companyId,
            input,
            documentsAvailable,
          );
        },
        async (tx) => {
          const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
          return await readSolutionClauses(
            tx,
            actor,
            lead,
            ctx.application,
            offerId,
            companyId,
            new Date().toISOString(),
            documentsAvailable,
            undefined,
            true,
          );
        },
      );
    },
    async solutionBinding(
      actor: PartnerActor,
      id: string,
      offerId: string,
      beforeRevision?: number,
      sourcePage?: number,
    ) {
      solutionBindingQuerySchema.parse({ beforeRevision, sourcePage });
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const now = (await tx.query<{ at: Date }>("select transaction_timestamp() at")).rows[0]!.at;
        await lockActor(tx, actor);
        const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
        const { dossier } = await readSolutionBinding(
          tx,
          actor,
          lead,
          ctx.application,
          offerId,
          now.toISOString(),
          documentsAvailable,
          beforeRevision,
          false,
          sourcePage,
        );
        await lockActor(tx, actor);
        if (!(await context(tx, actor)).canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
        await tx.query("commit");
        return dossier;
      } catch (cause) {
        await tx.query("rollback");
        if (cause && typeof cause === "object" && "code" in cause && cause.code === "40001")
          fail("PARTNER_CONFLICT", 409);
        throw cause;
      } finally {
        tx.release();
      }
    },
    recordSolutionBinding(
      actor: PartnerActor,
      id: string,
      offerId: string,
      raw: SolutionBindingInput,
      key: string,
    ) {
      const input = solutionBindingInputSchema.parse(raw);
      return transaction(
        actor,
        `solution-binding:${id}:${offerId}`,
        key,
        input,
        async (tx) => {
          const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
          return recordSolutionBinding(
            tx,
            actor,
            lead,
            ctx.application,
            offerId,
            input,
            documentsAvailable,
          );
        },
        async (tx) => {
          const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
          return (
            await readSolutionBinding(
              tx,
              actor,
              lead,
              ctx.application,
              offerId,
              new Date().toISOString(),
              documentsAvailable,
              undefined,
              true,
            )
          ).dossier;
        },
      );
    },
    async boundSolutionEvidence(
      actor: PartnerActor,
      id: string,
      offerId: string,
      raw: SolutionEvidenceQuery = {},
    ) {
      const query = solutionEvidenceQuerySchema.parse(raw);
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const snapshot = (await tx.query<{ at: Date }>("select transaction_timestamp() as at"))
          .rows[0]!;
        await lockActor(tx, actor);
        const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
        const result = await readBoundSolutionEvidence(
          tx,
          actor,
          lead,
          ctx.application,
          offerId,
          query,
          snapshot.at.toISOString(),
          documentsAvailable,
        );
        await lockActor(tx, actor);
        if (!(await context(tx, actor)).canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
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
    },
    async solutionEvidence(
      actor: PartnerActor,
      id: string,
      offerId: string,
      raw: SolutionEvidenceQuery = {},
    ) {
      const query = solutionEvidenceQuerySchema.parse(raw);
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const snapshot = (await tx.query<{ at: Date }>("select transaction_timestamp() as at"))
          .rows[0]!;
        await lockActor(tx, actor);
        const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
        const result = await readSolutionEvidence(
          tx,
          actor,
          lead,
          ctx.application,
          offerId,
          query,
          snapshot.at.toISOString(),
          documentsAvailable,
        );
        await lockActor(tx, actor);
        if (!(await context(tx, actor)).canAdvise) fail("PARTNER_ACCESS_DENIED", 403);
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
    },
    async needExpertiseEvidence(actor: PartnerActor, id: string) {
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const snapshot = (await tx.query<{ at: Date }>("select transaction_timestamp() as at"))
          .rows[0]!;
        await lockActor(tx, actor);
        const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
        const context = await readPersonalNeedContext(tx, actor, lead, ctx.application);
        const assessedAt = snapshot.at.toISOString();
        const result = needExpertiseEvidenceSchema.parse({
          version: 1,
          leadId: id,
          advisorId: actor.userId,
          assessedAt,
          scope: context.preferences.scope,
          scopeRevision: lead.adviceScopeRevision,
          changeRequested: context.changeRequested,
          assessment: "human_review_required",
          competence: await readNeedCompetenceEvidence(
            tx,
            actor.userId,
            lead.category,
            ctx.application,
            assessedAt,
            documentsAvailable,
          ),
        });
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
    },
    async referentAssessment(actor: PartnerActor, id: string, includeSharedModes = false) {
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const snapshot = (await tx.query<{ at: Date }>("select transaction_timestamp() as at"))
          .rows[0]!;
        await lockActor(tx, actor);
        const lead = await adviceLead(tx, actor, id);
        const result = await readReferentAssessment(
          tx,
          actor,
          lead,
          snapshot.at.toISOString(),
          includeSharedModes,
        );
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
    },
    async advisorAssessment(actor: PartnerActor, id: string, includeCapacity = false) {
      if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      const tx = await pool.connect();
      try {
        // Sources can change independently. Never combine different committed generations.
        await tx.query("begin isolation level repeatable read");
        const snapshot = (await tx.query<{ at: Date }>("select transaction_timestamp() as at"))
          .rows[0]!;
        await lockActor(tx, actor);
        const { ctx, lead } = await personalAdvisorLead(tx, actor, id);
        const result = await readAdvisorAssessment(
          tx,
          actor,
          { ...lead, clientUserId: lead.currentClientUserId },
          ctx.application,
          snapshot.at.toISOString(),
          includeCapacity,
        );
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
    },
    async needExpertise(actor: PartnerActor, id: string, beforeRevision?: number) {
      referentQuerySchema.parse(beforeRevision === undefined ? {} : { beforeRevision });
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const now = (await tx.query<{ at: Date }>("select transaction_timestamp() at")).rows[0]!.at;
        await lockActor(tx, actor);
        const { lead, ctx } = await personalAdvisorLead(tx, actor, id);
        const result = await readNeedExpertise(
          tx,
          actor,
          lead,
          ctx.application,
          now.toISOString(),
          documentsAvailable,
          beforeRevision,
        );
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
    },
    decideNeedExpertise(actor: PartnerActor, id: string, raw: NeedExpertiseInput, key: string) {
      const input = needExpertiseInputSchema.parse(raw);
      return transaction(
        actor,
        `need-expertise:${id}`,
        key,
        input,
        async (tx) => {
          const { lead, ctx } = await personalAdvisorLead(tx, actor, id);
          return decideNeedExpertise(tx, actor, lead, ctx.application, input, documentsAvailable);
        },
        async (tx) => {
          const { lead, ctx } = await personalAdvisorLead(tx, actor, id);
          await readAdvicePreferences(tx, actor, lead);
          const now = (await tx.query<{ at: Date }>("select clock_timestamp() at")).rows[0]!.at;
          return readNeedExpertise(
            tx,
            actor,
            lead,
            ctx.application,
            now.toISOString(),
            documentsAvailable,
            undefined,
            true,
          );
        },
      );
    },
    async needConflict(actor: PartnerActor, id: string, beforeRevision?: number) {
      referentQuerySchema.parse(beforeRevision === undefined ? {} : { beforeRevision });
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const now = (await tx.query<{ at: Date }>("select transaction_timestamp() at")).rows[0]!.at;
        await lockActor(tx, actor);
        const { lead, ctx } = await personalAdvisorLead(tx, actor, id);
        const result = await readNeedConflict(
          tx,
          actor,
          lead,
          ctx.application,
          now.toISOString(),
          beforeRevision,
        );
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
    },
    decideNeedConflict(actor: PartnerActor, id: string, raw: NeedConflictInput, key: string) {
      const input = needConflictInputSchema.parse(raw);
      return transaction(
        actor,
        `need-conflicts:${id}`,
        key,
        input,
        async (tx) => {
          const { lead, ctx } = await personalAdvisorLead(tx, actor, id);
          return decideNeedConflict(tx, actor, lead, ctx.application, input);
        },
        async (tx) => {
          const { lead, ctx } = await personalAdvisorLead(tx, actor, id);
          await readAdvicePreferences(tx, actor, lead);
          const now = (await tx.query<{ at: Date }>("select clock_timestamp() at")).rows[0]!.at;
          return readNeedConflict(tx, actor, lead, ctx.application, now.toISOString());
        },
      );
    },
    async needCapacity(actor: PartnerActor, id: string, beforeRevision?: number) {
      referentQuerySchema.parse(beforeRevision === undefined ? {} : { beforeRevision });
      const tx = await pool.connect();
      try {
        await tx.query("begin isolation level repeatable read");
        const now = (await tx.query<{ at: Date }>("select transaction_timestamp() at")).rows[0]!.at;
        await lockActor(tx, actor);
        const { lead, ctx } = await personalAdvisorLead(tx, actor, id);
        const result = await readNeedCapacity(
          tx,
          actor,
          lead,
          ctx.application,
          now.toISOString(),
          beforeRevision,
        );
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
    },
    decideNeedCapacity(actor: PartnerActor, id: string, raw: NeedCapacityInput, key: string) {
      const input = needCapacityInputSchema.parse(raw);
      return transaction(
        actor,
        `need-capacity:${id}`,
        key,
        input,
        async (tx) => {
          const { lead, ctx } = await personalAdvisorLead(tx, actor, id);
          return decideNeedCapacity(tx, actor, lead, ctx.application, input);
        },
        async (tx) => {
          const { lead, ctx } = await personalAdvisorLead(tx, actor, id);
          await readAdvicePreferences(tx, actor, lead);
          const now = (await tx.query<{ at: Date }>("select clock_timestamp() at")).rows[0]!.at;
          return readNeedCapacity(tx, actor, lead, ctx.application, now.toISOString());
        },
      );
    },
    async previewPersonalRescheduling(
      actor: PartnerActor,
      id: string,
      appointmentId: string,
      raw: PersonalAppointmentProposal,
    ) {
      const proposal = personalAppointmentProposalSchema.parse(raw);
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        const { lead, ctx, previous } = await personalRescheduling(tx, actor, id, appointmentId);
        if (previous.state !== "scheduled") fail("PARTNER_INVALID_TRANSITION");
        const result = await previewPersonalAppointment(tx, actor, lead, ctx, proposal, previous);
        await tx.query("commit");
        return result;
      } catch (cause) {
        await tx.query("rollback");
        throw cause;
      } finally {
        tx.release();
      }
    },
    confirmPersonalRescheduling(
      actor: PartnerActor,
      id: string,
      appointmentId: string,
      raw: PersonalAppointmentConfirm,
      key: string,
    ) {
      const input = personalAppointmentConfirmSchema.parse(raw);
      return transaction(
        actor,
        `personal-rescheduling:${id}:${appointmentId}`,
        key,
        input,
        async (tx) => {
          const { lead, ctx, previous, row } = await personalRescheduling(
            tx,
            actor,
            id,
            appointmentId,
          );
          if (previous.state !== "scheduled") fail("PARTNER_INVALID_TRANSITION");
          const preview = await previewPersonalAppointment(
            tx,
            actor,
            lead,
            ctx,
            { appointment: input.appointment, time: input.time },
            previous,
          );
          if (preview.basis !== input.basis) fail("PARTNER_CONFLICT", 409);
          if (preview.assessment.overlappingCommitment) fail("PARTNER_APPOINTMENT_CONFLICT", 409);
          if (!preview.canConfirm) fail("PARTNER_ACTION_REQUIRED");
          const oldPlan = (
            await tx.query<{ id: string; revision: number }>(
              "select id,revision from partner_appointment_time_plans where appointment_id=$1 and advisor_id=$2 order by revision desc limit 1",
              [appointmentId, actor.userId],
            )
          ).rows[0];
          const appt = input.appointment;
          // One SQL change: the guard must inspect the new terms with the new buffers.
          await tx.query(
            `update partner_appointments set starts_at=$2,duration_minutes=$3,mode=$4,location=$5,timezone=$6,
             occupied_before_minutes=$7,occupied_after_minutes=$8 where id=$1`,
            [
              appointmentId,
              appt.startsAt,
              appt.durationMinutes,
              appt.mode,
              appt.location,
              appt.timezone,
              input.time.preparationMinutes + input.time.travelBeforeMinutes,
              input.time.travelAfterMinutes,
            ],
          );
          await recordAppointmentTime(
            tx,
            actor,
            appointmentId,
            (oldPlan?.revision ?? 0) + 1,
            { ...input.time, basis: input.basis, confirmed: true },
            new Date(preview.occupiedStartsAt),
            new Date(preview.occupiedEndsAt),
            {
              rescheduling: {
                previous: personalAppointmentProposalSchema.shape.appointment.parse({
                  startsAt: previous.startsAt,
                  durationMinutes: previous.durationMinutes,
                  mode: previous.mode,
                  location: previous.location,
                  timezone: previous.timezone,
                }),
                next: appt,
              },
              previousProtection: {
                versionId: oldPlan?.id ?? null,
                occupiedBeforeMinutes: row.occupied_before_minutes,
                occupiedAfterMinutes: row.occupied_after_minutes,
              },
              declaration: preview.assessment.declaration,
              client: preview.assessment.client,
              leadRevision: lead.revision,
              clientUserId: lead.currentClientUserId,
              clientProfileId: lead.clientProfileId,
              personalConfirmation: {
                version: 1,
                clientAgreementConfirmed: input.clientAgreementConfirmed,
                externalCommitmentsChecked: input.externalCommitmentsChecked,
                capacityConfirmed: input.capacityConfirmed,
                preparationAndTravelChecked: input.preparationAndTravelChecked,
              },
            },
          );
          // An unrelated next action or waiting period must never be postponed by a report.
          await tx.query(
            `update partner_leads set due_at=case when waiting is null and due_at=$2
             and next_action='Tenir le rendez-vous convenu' then $3 else due_at end,
             revision=revision+1,updated_at=now() where id=$1`,
            [id, previous.startsAt, appt.startsAt],
          );
          await event(
            tx,
            actor,
            id,
            "appointment.rescheduled.v1",
            `${previous.startsAt} · ${previous.mode} → ${appt.startsAt} · ${appt.mode}`,
            "client",
            appointmentId,
          );
          await syncLeadNotifications(tx, id);
          return appointmentId;
        },
        async (tx) => {
          // Replay projects current state, even after cancellation, but never after loss of mandate.
          await personalRescheduling(tx, actor, id, appointmentId);
          return detail(tx, actor, id);
        },
      );
    },
    async previewPersonalAppointment(
      actor: PartnerActor,
      id: string,
      raw: PersonalAppointmentProposal,
    ) {
      const proposal = personalAppointmentProposalSchema.parse(raw);
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        const { lead, ctx } = await personalCreationLead(tx, actor, id);
        const result = await previewPersonalAppointment(tx, actor, lead, ctx, proposal);
        await tx.query("commit");
        return result;
      } catch (cause) {
        await tx.query("rollback");
        throw cause;
      } finally {
        tx.release();
      }
    },
    confirmPersonalAppointment(
      actor: PartnerActor,
      id: string,
      raw: PersonalAppointmentConfirm,
      key: string,
    ) {
      const input = personalAppointmentConfirmSchema.parse(raw);
      return transaction(
        actor,
        `personal-appointment:${id}`,
        key,
        input,
        async (tx) => {
          const { lead, ctx } = await personalCreationLead(tx, actor, id);
          const proposal = { appointment: input.appointment, time: input.time };
          const preview = await previewPersonalAppointment(tx, actor, lead, ctx, proposal);
          if (preview.basis !== input.basis) fail("PARTNER_CONFLICT", 409);
          if (preview.assessment.overlappingCommitment) fail("PARTNER_APPOINTMENT_CONFLICT", 409);
          if (!preview.canConfirm) fail("PARTNER_ACTION_REQUIRED");
          const appointmentId = await executeLeadCommand(tx, actor, lead, {
            action: "appointment",
            revision: lead.revision,
            appointment: { ...input.appointment, advisorId: actor.userId },
          });
          if (!appointmentId) throw new Error("Appointment creation returned no identifier");
          await recordAppointmentTime(
            tx,
            actor,
            appointmentId,
            1,
            { ...input.time, basis: input.basis, confirmed: true },
            new Date(preview.occupiedStartsAt),
            new Date(preview.occupiedEndsAt),
            {
              declaration: preview.assessment.declaration,
              client: preview.assessment.client,
              appointmentStartsAt: preview.assessment.startsAt,
              appointmentEndsAt: preview.assessment.endsAt,
              appointment: input.appointment,
              leadRevision: lead.revision,
              clientUserId: lead.currentClientUserId,
              clientProfileId: lead.clientProfileId,
              mode: input.appointment.mode,
              personalConfirmation: {
                version: 1,
                clientAgreementConfirmed: input.clientAgreementConfirmed,
                externalCommitmentsChecked: input.externalCommitmentsChecked,
                capacityConfirmed: input.capacityConfirmed,
                preparationAndTravelChecked: input.preparationAndTravelChecked,
              },
            },
          );
          await tx.query(
            "update partner_leads set revision=revision+1,updated_at=now() where id=$1",
            [id],
          );
          await syncLeadNotifications(tx, id);
          await reconcileCollaborations(tx, id, actor);
          return appointmentId;
        },
        async (tx, appointmentId) => {
          await personalCreationLead(tx, actor, id);
          if (
            !(
              await tx.query(
                "select id from partner_appointments where id=$1 and lead_id=$2 and advisor_id=$3",
                [appointmentId, id, actor.userId],
              )
            ).rowCount
          )
            fail("PARTNER_NOT_FOUND", 404);
          return detail(tx, actor, id);
        },
      );
    },
    protectAppointmentTime(
      actor: PartnerActor,
      id: string,
      appointmentId: string,
      raw: AppointmentTimeInput,
      key: string,
    ) {
      const input = appointmentTimeInputSchema.parse(raw);
      return transaction(
        actor,
        `appointment-time:${id}:${appointmentId}`,
        key,
        input,
        async (tx) => {
          const { result, ctx } = await personalAssessment(tx, actor, id, appointmentId);
          await protectAppointmentTime(tx, actor, ctx, result, input);
          return appointmentId;
        },
        async (tx) => {
          const { result } = await personalAssessment(tx, actor, id, appointmentId);
          if (result.responsibility !== "current") fail("PARTNER_ACCESS_DENIED", 403);
          return result;
        },
      );
    },
    async appointmentAssessment(actor: PartnerActor, id: string, appointmentId: string) {
      if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        const { result } = await personalAssessment(tx, actor, id, appointmentId);
        await tx.query("commit");
        return result;
      } catch (cause) {
        await tx.query("rollback");
        throw cause;
      } finally {
        tx.release();
      }
    },
    async advicePreferences(actor: PartnerActor, id: string, beforeRevision?: number) {
      referentQuerySchema.parse(beforeRevision === undefined ? {} : { beforeRevision });
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        const lead = await adviceLead(tx, actor, id);
        const result = await readAdvicePreferences(tx, actor, lead, beforeRevision);
        await tx.query("commit");
        return result;
      } catch (cause) {
        await tx.query("rollback");
        throw cause;
      } finally {
        tx.release();
      }
    },
    confirmAdvicePreferences(
      actor: PartnerActor,
      id: string,
      raw: AdvicePreferencesInput,
      key: string,
    ) {
      const input = advicePreferencesInputSchema.parse(raw);
      return transaction(
        actor,
        `advice:${id}`,
        key,
        input,
        async (tx) =>
          confirmAdvicePreferences(tx, actor, await adviceLead(tx, actor, id, true), input),
        async (tx) => readAdvicePreferences(tx, actor, await adviceLead(tx, actor, id, true)),
      );
    },
    ...createPracticeOperations(pool, transaction),
    ...createAvailabilityOperations(pool, transaction),
    ...createSharedModesOperations(pool, transaction),
    ...createCapacityOperations(pool, transaction),
    ...createConventionOperations(pool, transaction, documentsAvailable),
    async referentProfile(
      actor: PartnerActor,
      profileId: string,
      category: string,
      beforeRevision?: number,
    ) {
      referentQuerySchema.parse(beforeRevision === undefined ? {} : { beforeRevision });
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        const result = await readReferentProfile(tx, actor, profileId, category, beforeRevision);
        await tx.query("commit");
        return result;
      } catch (cause) {
        await tx.query("rollback");
        throw cause;
      } finally {
        tx.release();
      }
    },
    updateReferent(
      actor: PartnerActor,
      profileId: string,
      category: string,
      raw: z.infer<typeof referentUpdateSchema>,
      key: string,
    ) {
      const input = referentUpdateSchema.parse(raw);
      return transaction(
        actor,
        `referent:${profileId}:${category}`,
        key,
        input,
        (tx) => updateReferent(tx, actor, profileId, category, input),
        (tx) => readReferentProfile(tx, actor, profileId, category),
      );
    },
    async offerImports(actor: PartnerActor, id: string, cursor?: string) {
      return withOfferAccess(actor, id, async (tx) => {
        const { lead, writable } = await importLead(tx, actor, id);
        return {
          leadRevision: lead.revision,
          ...(await readOfferImports(tx, id, writable, cursor ? { cursor } : {})),
        };
      });
    },
    prepareOfferImport(
      actor: PartnerActor,
      leadId: string,
      raw: z.infer<typeof offerImportInputSchema>,
      key: string,
    ) {
      const input = offerImportInputSchema.parse(raw);
      return transaction(
        actor,
        `import:${leadId}`,
        key,
        input,
        async (tx) => {
          const { lead } = await importLead(tx, actor, leadId, true);
          const existing = (
            await tx.query<{ id: string }>(
              "select id from partner_offer_imports where lead_id=$1 and checksum=$2",
              [leadId, input.source.checksum],
            )
          ).rows[0];
          if (existing) return existing.id;
          if (input.revision !== lead.revision) fail("PARTNER_CONFLICT", 409);
          const documentId = await createLeadOfferUpload(tx, actor.userId, input.source);
          const id = newId("pimport");
          await tx.query(
            "insert into partner_offer_imports(id,lead_id,document_id,checksum,created_by) values($1,$2,$3,$4,$5)",
            [id, leadId, documentId, input.source.checksum, actor.userId],
          );
          await tx.query(
            "update partner_leads set revision=revision+1,updated_at=now() where id=$1",
            [leadId],
          );
          await event(tx, actor, leadId, "offer.import_started", "", "assigned", id);
          return id;
        },
        (tx, id) => importResult(tx, actor, leadId, id, true),
      );
    },
    async importSource(actor: PartnerActor, leadId: string, id: string, write = false) {
      return withOfferAccess(actor, leadId, async (tx) => {
        const result = await importResult(tx, actor, leadId, id, write);
        if (!write && !result.item.canDownload) fail("PARTNER_INVALID_DOCUMENT");
        const row = (
          await tx.query<{ user_id: string }>(
            "select user_id from files where id=$1 and deleted_at is null",
            [result.item.documentId],
          )
        ).rows[0];
        if (!row) return fail("PARTNER_NOT_FOUND", 404);
        return { documentId: result.item.documentId, userId: row.user_id };
      });
    },
    async completeImportUpload(actor: PartnerActor, leadId: string, id: string, mime: string) {
      return withOfferAccess(actor, leadId, async (tx) => {
        const result = await importResult(tx, actor, leadId, id, true);
        await queueLeadOfferUpload(tx, result.item.documentId, actor.userId, { mime });
        return importResult(tx, actor, leadId, id, true);
      });
    },
    retryOfferImport(
      actor: PartnerActor,
      leadId: string,
      id: string,
      raw: z.infer<typeof offerImportRetrySchema>,
      key: string,
    ) {
      const input = offerImportRetrySchema.parse(raw);
      return transaction(
        actor,
        `import_retry:${leadId}:${id}`,
        key,
        input,
        async (tx) => {
          const result = await importResult(tx, actor, leadId, id, true);
          if (!result.item.canRetry) fail("PARTNER_INVALID_TRANSITION");
          await queueLeadOfferUpload(tx, result.item.documentId, actor.userId, {
            revision: input.revision,
          });
          await event(tx, actor, leadId, "offer.import_retried", "", "assigned", id);
          return id;
        },
        (tx, target) => importResult(tx, actor, leadId, target, true),
      );
    },
    async importSourceConsulted(actor: PartnerActor, leadId: string, id: string) {
      return withOfferAccess(actor, leadId, async (tx) => {
        const result = await importResult(tx, actor, leadId, id);
        if (!result.item.canDownload) fail("PARTNER_INVALID_DOCUMENT");
        const existing = await tx.query(
          "select id from partner_events where lead_id=$1 and actor_id=$2 and subject_id=$3 and kind='offer.import_viewed' and created_at>now()-interval '30 minutes' limit 1",
          [leadId, actor.userId, id],
        );
        if (!existing.rowCount)
          await event(tx, actor, leadId, "offer.import_viewed", "", "assigned", id);
      });
    },
    async insuranceSource(actor: PartnerActor, id: string) {
      if (actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        if (!(await context(tx, actor, true)).operational) fail("PARTNER_ACCESS_DENIED", 403);
        const lead = await readLead(tx, actor, id, true);
        if (summary(actor, lead).access !== "operational") fail("PARTNER_NOT_FOUND", 404);
        const result = await readInsuranceSource(tx, actor, id);
        await tx.query("commit");
        return result;
      } catch (cause) {
        await tx.query("rollback");
        throw cause;
      } finally {
        tx.release();
      }
    },
    async offerHistory(actor: PartnerActor, id: string, cursor?: string) {
      return withOfferAccess(actor, id, (tx) =>
        readOffers(tx, id, !!actor.wallet, { history: true, ...(cursor ? { cursor } : {}) }),
      );
    },
    async finalPolicies(actor: PartnerActor, id: string, cursor?: string) {
      return withOfferAccess(actor, id, async (tx) => {
        const lead = await readLead(tx, actor, id);
        const canReview =
          summary(actor, lead).allowedActions?.includes("final_policy_review") === true &&
          (await context(tx, actor)).canAdvise;
        return {
          leadRevision: lead.revision,
          ...(await readFinalPolicies(
            tx,
            { ...lead, clientUserId: lead.currentClientUserId },
            canReview,
            cursor ? { cursor } : {},
          )),
        };
      });
    },
    async finalPolicySource(actor: PartnerActor, id: string, policyId: string, record = false) {
      return withOfferAccess(actor, id, async (tx) => {
        const lead = await readLead(tx, actor, id);
        const policy = (
          await readFinalPolicies(tx, { ...lead, clientUserId: lead.currentClientUserId }, false, {
            id: policyId,
          })
        ).items[0];
        if (!policy?.canDownload) return fail("PARTNER_NOT_FOUND", 404);
        if (
          record &&
          !(
            await tx.query(
              "select id from partner_events where lead_id=$1 and actor_id=$2 and subject_id=$3 and kind='policy.viewed' and created_at>now()-interval '30 minutes' limit 1",
              [id, actor.userId, policyId],
            )
          ).rowCount
        )
          await event(
            tx,
            actor,
            id,
            "policy.viewed",
            "",
            actor.wallet ? "client" : "assigned",
            policyId,
          );
        return policy.documentId;
      });
    },
    async offerSource(actor: PartnerActor, id: string, offerId: string) {
      return withOfferAccess(
        actor,
        id,
        async (tx) => (await accessibleOffer(tx, actor, id, offerId)).documentId,
      );
    },
    async contractCandidates(actor: PartnerActor, id: string) {
      if (!actor.wallet) fail("PARTNER_ACCESS_DENIED", 403);
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        const lead = await readLead(tx, actor, id);
        const target = await lockContractSubject(tx, {
          ...lead,
          clientUserId: lead.currentClientUserId,
        });
        if (target.clientUserId !== actor.userId) fail("PARTNER_ACCESS_DENIED", 403);
        const result = await readContractCandidates(tx, actor.userId, target.clientProfileId);
        await tx.query("commit");
        return {
          items: result.entries.map((entry) => entry.candidate),
          truncated: result.truncated,
        };
      } catch (error) {
        await tx.query("rollback");
        throw error;
      } finally {
        tx.release();
      }
    },
    insuranceLinks: (actor: PartnerActor, requestId: string) =>
      insuranceLinks(pool, actor, requestId),
    linkInsurance(
      actor: PartnerActor,
      requestId: string,
      input: z.infer<typeof insuranceLeadConsentSchema>,
      key: string,
    ) {
      const consent = insuranceLeadConsentSchema.parse(input);
      return transaction(
        actor,
        `insurance:${requestId}`,
        key,
        consent,
        (tx) => createInsuranceLead(tx, actor, requestId, consent.personId),
        (tx, id) => detail(tx, actor, id),
      );
    },
    async collaborations(actor: PartnerActor) {
      if (actor.wallet || !(await context(pool, actor)).operational)
        fail("PARTNER_ACCESS_DENIED", 403);
      return { items: await readCollaborations(pool, actor) };
    },
    respondCollaboration(
      actor: PartnerActor,
      id: string,
      input: CollaborationResponse,
      key: string,
    ) {
      return transaction(
        actor,
        `collaboration:${id}`,
        key,
        input,
        async (tx) => {
          if (actor.wallet || !(await context(tx, actor, true)).operational)
            fail("PARTNER_ACCESS_DENIED", 403);
          return respondCollaboration(tx, actor, id, input);
        },
        async (tx, target) => {
          if (!(await context(tx, actor)).operational) fail("PARTNER_ACCESS_DENIED", 403);
          const result = (await readCollaborations(tx, actor, undefined, target))[0];
          if (!result) return fail("PARTNER_NOT_FOUND", 404);
          return result;
        },
      );
    },
    continuitySettings: (actor: PartnerActor) => readContinuitySettings(pool, actor),
    updateContinuitySettings(actor: PartnerActor, raw: PartnerContinuityUpdate, key: string) {
      const input = partnerContinuityUpdateSchema.parse(raw);
      return transaction(
        actor,
        "continuity:settings",
        key,
        input,
        async (tx) => {
          const revision = await updateContinuitySettings(tx, actor, input);
          await event(
            tx,
            actor,
            null,
            "continuity.settings_changed",
            input.reason,
            "coverview",
            revision,
          );
          return revision;
        },
        (tx) => readContinuitySettings(tx, actor),
      );
    },
    context: (actor: PartnerActor) => context(pool, actor),
    notifications: (actor: PartnerActor, query: PartnerNotificationQuery) =>
      readPartnerNotifications(pool, actor, query),
    readNotification(actor: PartnerActor, id: string, key: string) {
      return transaction(
        actor,
        `notification:${id}:read`,
        key,
        { id },
        async (tx) => {
          await markPartnerNotificationRead(tx, actor, id);
          return id;
        },
        async (tx, notificationId) => {
          await markPartnerNotificationRead(tx, actor, notificationId);
          return { read: true as const };
        },
      );
    },
    async sourceConsulted(actor: PartnerActor, id: string, offerId: string | null) {
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        await lockActor(tx, actor);
        await readLead(tx, actor, id, true);
        const lead = await detail(tx, actor, id),
          offer = offerId ? await accessibleOffer(tx, actor, id, offerId) : null;
        const contract =
          offerId === null && lead.currentContract?.status === "available"
            ? lead.currentContract
            : null;
        if (!offer && !contract) fail("PARTNER_NOT_FOUND", 404);
        const subjectId = offer?.id ?? contract!.referenceId;
        const recent = await tx.query(
          "select id from partner_events where lead_id=$1 and actor_id=$2 and subject_id=$3 and kind='document.viewed' and created_at>now()-interval '30 minutes' limit 1",
          [id, actor.userId, subjectId],
        );
        if (!recent.rowCount)
          await event(
            tx,
            actor,
            id,
            "document.viewed",
            offer ? `${offer.company} · ${offer.product}` : "",
            actor.wallet ? "client" : "assigned",
            subjectId,
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
          `select l.stage,count(*)::int count,count(*) filter(where l.stage not in ('draft','completed'))::int active,count(*) filter(where ${followUpOverdueSql})::int overdue,count(*) filter(where l.responsible_id is null and l.stage not in ('draft','completed'))::int unassigned,count(*) filter(where l.result in ('contract','resolved_without_contract'))::int resolved from partner_leads l where ${visible(actor)} group by l.stage`,
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
            const affected = (
              await tx.query<{ id: string }>(
                `select l.id from partner_leads l where
              l.responsible_id=any($1::text[]) or exists(select 1 from partner_contributors c where c.lead_id=l.id and c.user_id=any($1::text[]) and c.revoked_at is null)
              or exists(select 1 from partner_collaborations c where c.lead_id=l.id and c.target_id=any($1::text[]) and c.state='proposed') order by l.id for update of l`,
                [revoked],
              )
            ).rows;
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
              await syncLeadNotifications(tx, String(lead.id));
            }
            for (const lead of affected) {
              if (!leads.some((value) => value.id === lead.id)) {
                const current = (
                  await tx.query<{ responsible_id: string | null }>(
                    "select responsible_id from partner_leads where id=$1",
                    [lead.id],
                  )
                ).rows[0]!;
                await handoffWork(tx, actor, lead.id, current.responsible_id);
                await tx.query(
                  "update partner_leads set revision=revision+1,updated_at=now() where id=$1",
                  [lead.id],
                );
                await event(tx, actor, lead.id, "lead.contributor_access_expired", "", "assigned");
              }
              await reconcileCollaborations(tx, lead.id, actor);
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
      if (query.view === "overdue") clauses.push(`(${followUpOverdueSql})`);
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
      return withOfferAccess(actor, leadId, async (tx) => {
        const { lead } = await importLead(tx, actor, leadId, true);
        await tx.query("select id from files where id=$1 for share", [documentId]);
        const source = (
          await tx.query<Record<string, unknown>>(
            `select f.*, ${leadSourceReviewRevisionSql} source_review_revision from files f where f.id=$1 and f.deleted_at is null and
          (f.user_id=$2 or exists(select 1 from partner_offers where lead_id=$3 and document_id=$1)
          or exists(select 1 from partner_offer_imports where lead_id=$3 and document_id=$1)
          or ($4::boolean and f.user_id=$5 and f.managed_profile_id is not distinct from $6))`,
            [
              documentId,
              actor.userId,
              leadId,
              actor.administrator,
              lead.currentClientUserId,
              lead.clientProfileId,
            ],
          )
        ).rows[0];
        if (!source) fail("PARTNER_INVALID_DOCUMENT");
        const parsed = documentAnalysisSchema.safeParse(
            leadSourceSnapshot(source) ? source.analysis : null,
          ),
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
          sourceFingerprint: leadSourceSnapshot(source)?.fingerprint ?? null,
          state: source.state,
          company: insurance?.companyId ?? null,
          product: analysis?.title ?? null,
          annualPremiumMinor:
            premium?.currency === "CHF" && factor ? premium.amountMinor * factor : null,
          premiumOrigin: factor === 1 ? "extracted" : factor ? "calculated" : "missing",
          premiumSource: premium ? JSON.stringify(premium.source) : null,
          reference: insurance?.policyNumber?.value ?? null,
          effectiveDate: insurance?.startsOn?.value ?? null,
          analysisStatus: leadImportAnalysis(source),
          failure: source.failure,
        });
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
            `insert into partner_leads(id,creator_id,responsible_id,client_user_id,client_profile_id,title,category,object,client_name,details,stage,assignment,priority,next_action,due_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
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
          await syncLeadNotifications(tx, id);
          return id;
        },
        (tx, id) => detail(tx, actor, id),
      );
    },
    command(
      actor: PartnerActor,
      id: string,
      rawInput: Parameters<typeof executeLeadCommand>[3],
      key: string,
    ) {
      const input = leadCommandSchema.parse(rawInput);
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
          if (
            actor.wallet
              ? ![
                  "client_choice",
                  "client_interlocutor",
                  "contract_link",
                  "contract_unlink",
                  "final_policy_link",
                  "final_policy_unlink",
                ].includes(input.action)
              : !access.allowedActions?.includes(input.action)
          )
            fail("PARTNER_ACCESS_DENIED", 403);
          if (
            input.action === "note" &&
            input.audience === "client" &&
            !actor.administrator &&
            lead.responsibleId !== actor.userId &&
            !lead.managedAccess &&
            !lead.contributorContact
          )
            fail("PARTNER_ACCESS_DENIED", 403);
          if (!actor.wallet && !ctx.canAdvise && !ctx.canManage && input.action !== "edit")
            fail("PARTNER_ACCESS_DENIED", 403);
          if (
            !actor.wallet &&
            [
              "offer",
              "offer_review",
              "offer_publish",
              "contract_review",
              "final_policy_review",
            ].includes(input.action) &&
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
          await syncLeadNotifications(tx, id);
          await reconcileCollaborations(tx, id, actor);
          return id;
        },
        (tx, target) => detail(tx, actor, target),
      );
    },
  };
}
