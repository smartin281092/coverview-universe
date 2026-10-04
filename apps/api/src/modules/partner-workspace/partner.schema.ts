import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { managedProfiles } from "../profiles/index.js";
import { documents } from "../document-intelligence/index.js";
import { insuranceRequests } from "../insurance-requests/index.js";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const partnerReferentSelections = pgTable(
  "partner_referent_selections",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id").notNull(),
    selfUserId: text("self_user_id").references(() => identityUsers.id),
    profileId: text("profile_id").references(() => managedProfiles.id),
    subjectRevision: integer("subject_revision").notNull(),
    category: text("category").notNull(),
    revision: integer("revision").notNull(),
    advisorId: text("advisor_id").references(() => identityUsers.id),
    confirmedBy: text("confirmed_by")
      .notNull()
      .references(() => identityUsers.id),
    confirmationVersion: integer("confirmation_version").notNull().default(1),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_referent_revision").on(t.subjectId, t.category, t.revision),
    check(
      "partner_referent_subject",
      sql`(${t.profileId} is not null and ${t.selfUserId} is null and ${t.subjectId}='profile:'||${t.profileId}) or (${t.profileId} is null and ${t.selfUserId} is not null and ${t.subjectId}='self:'||${t.selfUserId} and ${t.confirmedBy}=${t.selfUserId} and ${t.subjectRevision}=0)`,
    ),
    check(
      "partner_referent_bounds",
      sql`${t.revision}>0 and ${t.subjectRevision}>=0 and ${t.confirmationVersion}=1 and ${t.category} in ('health','vehicle','pension','household','legal','business','other')`,
    ),
  ],
);
export const partnerOfferImports = pgTable(
  "partner_offer_imports",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    checksum: text("checksum").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => identityUsers.id),
    offerId: text("offer_id").references(() => partnerOffers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_import_content").on(t.leadId, t.checksum),
    uniqueIndex("partner_import_document").on(t.documentId),
    index("partner_import_history").on(t.leadId, t.createdAt, t.id),
    check("partner_import_checksum", sql`${t.checksum} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const partnerContractReferences = pgTable(
  "partner_contract_references",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    fingerprint: text("fingerprint").notNull(),
    confirmedBy: text("confirmed_by")
      .notNull()
      .references(() => identityUsers.id),
    consentVersion: integer("consent_version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("partner_contract_active")
      .on(table.leadId)
      .where(sql`${table.active}`),
    check(
      "partner_contract_fingerprint",
      sql`${table.fingerprint} ~ '^[a-f0-9]{64}$' and ${table.consentVersion}=1`,
    ),
  ],
);
export const partnerContractReviews = pgTable(
  "partner_contract_reviews",
  {
    id: text("id").primaryKey(),
    referenceId: text("reference_id")
      .notNull()
      .references(() => partnerContractReferences.id),
    version: integer("version").notNull(),
    premiumVerified: boolean("premium_verified").notNull(),
    features: jsonb("features").notNull(),
    reviewedBy: text("reviewed_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("partner_contract_review_version").on(table.referenceId, table.version),
    check(
      "partner_contract_review_bounds",
      sql`${table.version}>0 and jsonb_typeof(${table.features})='array' and jsonb_array_length(${table.features})<=80`,
    ),
  ],
);
export const partnerContinuityPolicies = pgTable(
  "partner_continuity_policies",
  {
    revision: integer("revision").primaryKey(),
    policy: jsonb("policy").notNull(),
    changedBy: text("changed_by")
      .notNull()
      .references(() => identityUsers.id),
    reason: text("reason").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("partner_continuity_policy_revision", sql`${t.revision} > 0`),
    check(
      "partner_continuity_policy_shape",
      sql`coalesce(jsonb_typeof(${t.policy}) = 'object' and jsonb_typeof(${t.policy}->'acceptanceHours') = 'number' and (${t.policy}->>'acceptanceHours')::int between 1 and 24 and jsonb_typeof(${t.policy}->'calendar') = 'object', false)`,
    ),
  ],
);
export const partnerOrganizations = pgTable(
  "partner_organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    state: text("state").notNull().default("submitted"),
    reviewedBy: text("reviewed_by").references(() => identityUsers.id),
    reviewReason: text("review_reason"),
    reviewedAt: instant("reviewed_at"),
  },
  (t) => [
    check(
      "partner_org_state",
      sql`${t.state} in ('draft','submitted','needs_information','approved','rejected','suspended','closed')`,
    ),
  ],
);
export const partnerMembers = pgTable(
  "partner_members",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => identityUsers.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    state: text("state").notNull().default("submitted"),
    application: jsonb("application").notNull(),
    roles: jsonb("roles").$type<string[]>().notNull().default([]),
    revision: integer("revision").notNull().default(0),
    reviewedBy: text("reviewed_by").references(() => identityUsers.id),
    reviewReason: text("review_reason"),
    reviewedAt: instant("reviewed_at"),
    reviewDueAt: instant("review_due_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_members_org").on(t.organizationId, t.state),
    check(
      "partner_member_state",
      sql`${t.state} in ('draft','submitted','needs_information','approved','rejected','suspended','closed')`,
    ),
    check("partner_member_revision", sql`${t.revision} >= 0`),
  ],
);
export const partnerLeads = pgTable(
  "partner_leads",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => identityUsers.id),
    responsibleId: text("responsible_id").references(() => identityUsers.id),
    clientUserId: text("client_user_id").references(() => identityUsers.id),
    clientProfileId: text("client_profile_id").references(() => managedProfiles.id),
    title: text("title").notNull(),
    category: text("category").notNull(),
    object: text("object").notNull(),
    clientName: text("client_name").notNull(),
    details: jsonb("details").notNull(),
    stage: text("stage").notNull().default("new"),
    assignment: text("assignment").notNull().default("unassigned"),
    priority: text("priority").notNull(),
    nextAction: text("next_action").notNull(),
    dueAt: instant("due_at"),
    waiting: jsonb("waiting"),
    result: text("result"),
    reason: text("reason"),
    estimatedCommissionMinor: integer("estimated_commission_minor"),
    revision: integer("revision").notNull().default(0),
    notifiedAt: instant("notified_at"),
    firstActionDueAt: instant("first_action_due_at"),
    acceptanceDueAt: instant("acceptance_due_at"),
    continuityPolicyRevision: integer("continuity_policy_revision").references(
      () => partnerContinuityPolicies.revision,
    ),
    notificationCycle: integer("notification_cycle").notNull().default(0),
    continuityCheckedAt: instant("continuity_checked_at"),
    firstUsefulAt: instant("first_useful_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
    stageChangedAt: instant("stage_changed_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_leads_assignee").on(t.responsibleId, t.createdAt, t.id),
    index("partner_leads_creator").on(t.creatorId, t.createdAt, t.id),
    index("partner_leads_client").on(t.clientUserId, t.clientProfileId),
    index("partner_leads_profile").on(t.clientProfileId),
    index("partner_leads_continuity")
      .on(t.continuityCheckedAt, t.id)
      .where(sql`${t.stage} not in ('draft','completed')`),
    check(
      "partner_lead_bounds",
      sql`${t.revision} >= 0 and (${t.estimatedCommissionMinor} is null or ${t.estimatedCommissionMinor} >= 0)`,
    ),
    check(
      "partner_lead_deadlines",
      sql`(${t.acceptanceDueAt} is null and ${t.firstActionDueAt} is null) or (${t.acceptanceDueAt} is not null and ${t.firstActionDueAt} is not null and ${t.acceptanceDueAt} <= ${t.firstActionDueAt})`,
    ),
    check(
      "partner_lead_stage",
      sql`${t.stage} in ('draft','new','qualifying','ready_to_assign','to_contact','contacted','appointment_needed','appointment_scheduled','appointment_completed','analysis','offer_requested','offer_received','offer_presented','client_decision','signing','signed','awaiting_insurer','contract_issued','completed')`,
    ),
    check(
      "partner_lead_assignment",
      sql`${t.assignment} in ('unassigned','proposed','accepted','marketplace','reassign','coverview')`,
    ),
    check("partner_lead_priority", sql`${t.priority} in ('normal','high','urgent')`),
    check(
      "partner_lead_closure",
      sql`(${t.stage} = 'completed') = (${t.result} is not null and ${t.reason} is not null)`,
    ),
    check(
      "partner_lead_profile",
      sql`${t.clientProfileId} is null or ${t.clientUserId} is not null`,
    ),
  ],
);
export const partnerInsuranceSources = pgTable(
  "partner_insurance_sources",
  {
    leadId: text("lead_id")
      .primaryKey()
      .references(() => partnerLeads.id),
    requestId: text("request_id")
      .notNull()
      .references(() => insuranceRequests.id),
    personId: text("person_id").notNull(),
    profileId: text("profile_id")
      .notNull()
      .references(() => managedProfiles.id),
    consentUserId: text("consent_user_id")
      .notNull()
      .references(() => identityUsers.id),
    consentVersion: text("consent_version").notNull(),
    requestRevision: integer("request_revision").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_insurance_source_person").on(t.requestId, t.personId),
    check(
      "partner_insurance_source_consent",
      sql`${t.consentVersion} = 'insurance-partner-v1' and ${t.requestRevision} >= 0`,
    ),
    check(
      "partner_insurance_source_snapshot",
      sql`coalesce(${t.snapshot}->>'id'=${t.personId} and ${t.snapshot}->>'profileId'=${t.profileId}, false)`,
    ),
  ],
);
export const partnerCollaborations = pgTable(
  "partner_collaborations",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    proposerId: text("proposer_id")
      .notNull()
      .references(() => identityUsers.id),
    targetId: text("target_id")
      .notNull()
      .references(() => identityUsers.id),
    previousResponsibleId: text("previous_responsible_id")
      .notNull()
      .references(() => identityUsers.id),
    category: text("category").notNull(),
    terms: jsonb("terms").notNull(),
    state: text("state").notNull().default("proposed"),
    revision: integer("revision").notNull().default(0),
    response: text("response").notNull().default(""),
    createdAt: instant("created_at").notNull().defaultNow(),
    decidedAt: instant("decided_at"),
    endedAt: instant("ended_at"),
  },
  (t) => [
    index("partner_collaboration_inbox").on(t.targetId, t.state, t.createdAt),
    index("partner_collaboration_lead").on(t.leadId, t.createdAt),
    uniqueIndex("partner_collaboration_pending")
      .on(t.leadId, t.targetId)
      .where(sql`${t.state} = 'proposed'`),
    check(
      "partner_collaboration_state",
      sql`${t.state} in ('proposed','accepted','declined','cancelled','ended') and ${t.revision} >= 0`,
    ),
    check(
      "partner_collaboration_people",
      sql`${t.targetId} <> ${t.previousResponsibleId} and ${t.targetId} <> ${t.proposerId}`,
    ),
    check(
      "partner_collaboration_terms",
      sql`coalesce(jsonb_typeof(${t.terms})='object' and ${t.terms}->>'targetId'=${t.targetId} and ${t.terms}->>'mode' in ('one_off','co_advice','transfer') and ${t.terms}->>'access' in ('read','contribute') and ${t.terms}->>'communication' in ('referent_only','client_direct') and ${t.terms}->'existingRightsPreserved'='true'::jsonb and ${t.terms}->'transmissionConfirmed'='true'::jsonb, false)`,
    ),
  ],
);
export const partnerContributors = pgTable(
  "partner_contributors",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    canEdit: boolean("can_edit").notNull().default(false),
    accessScope: text("access_scope").notNull().default("advice"),
    canContact: boolean("can_contact").notNull().default(true),
    collaborationId: text("collaboration_id").references(() => partnerCollaborations.id),
    revokedAt: instant("revoked_at"),
  },
  (t) => [
    check(
      "partner_contributor_scope",
      sql`${t.accessScope} in ('advice','progress') and (${t.accessScope} <> 'progress' or (not ${t.canEdit} and not ${t.canContact}))`,
    ),
    uniqueIndex("partner_contributor_active")
      .on(t.leadId, t.userId)
      .where(sql`${t.revokedAt} is null`),
  ],
);
export const partnerTasks = pgTable(
  "partner_tasks",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    responsibleId: text("responsible_id")
      .notNull()
      .references(() => identityUsers.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    dueAt: instant("due_at").notNull(),
    priority: text("priority").notNull(),
    reminderAt: instant("reminder_at"),
    state: text("state").notNull().default("open"),
    completedAt: instant("completed_at"),
  },
  (t) => [
    index("partner_tasks_lead").on(t.leadId, t.state),
    index("partner_tasks_assignee").on(t.responsibleId, t.dueAt),
    check("partner_task_state", sql`${t.state} in ('open','done','cancelled')`),
  ],
);
export const partnerAppointments = pgTable(
  "partner_appointments",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    advisorId: text("advisor_id")
      .notNull()
      .references(() => identityUsers.id),
    startsAt: instant("starts_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    mode: text("mode").notNull(),
    location: text("location").notNull(),
    timezone: text("timezone").notNull(),
    state: text("state").notNull().default("scheduled"),
  },
  (t) => [
    index("partner_appointment_lead").on(t.leadId),
    index("partner_appointment_advisor").on(t.advisorId, t.startsAt),
    check("partner_appointment_duration", sql`${t.durationMinutes} between 15 and 240`),
    check(
      "partner_appointment_state",
      sql`${t.state} in ('scheduled','completed','cancelled','client_absent','advisor_absent')`,
    ),
  ],
);
export const partnerEvents = pgTable(
  "partner_events",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").references(() => partnerLeads.id),
    actorId: text("actor_id").references(() => identityUsers.id),
    systemActor: text("system_actor"),
    subjectId: text("subject_id"),
    kind: text("kind").notNull(),
    audience: text("audience").notNull(),
    text: text("text").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_event_lead").on(t.leadId, t.createdAt, t.id),
    check(
      "partner_event_actor",
      sql`(${t.actorId} is not null and ${t.systemActor} is null) or (${t.actorId} is null and ${t.systemActor} is not null and ${t.systemActor} = 'partner-continuity-v1')`,
    ),
    check(
      "partner_event_audience",
      sql`${t.audience} in ('private','assigned','client','coverview')`,
    ),
  ],
);
export const partnerOffers = pgTable(
  "partner_offers",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    data: jsonb("data").notNull(),
    sourceSnapshot: jsonb("source_snapshot"),
    reviewedBy: text("reviewed_by").references(() => identityUsers.id),
    publishedBy: text("published_by").references(() => identityUsers.id),
    version: integer("version").notNull(),
    familyId: text("family_id").notNull(),
    active: boolean("active").notNull().default(true),
    state: text("state").notNull().default("to_verify"),
    reviewedAt: instant("reviewed_at"),
    publishedAt: instant("published_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_offer_lead").on(t.leadId),
    uniqueIndex("partner_offer_lead_id").on(t.leadId, t.id),
    index("partner_offer_history").on(t.leadId, t.createdAt, t.id),
    uniqueIndex("partner_offer_version").on(t.familyId, t.version),
    uniqueIndex("partner_offer_active")
      .on(t.familyId)
      .where(sql`${t.active}`),
    check(
      "partner_offer_state",
      sql`${t.state} in ('received','to_verify','ready','published','viewed','selected','refused','expired','replaced','to_sign','signed','cancelled')`,
    ),
  ],
);
export const partnerFinalPolicies = pgTable(
  "partner_final_policies",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    offerId: text("offer_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    fingerprint: text("fingerprint").notNull(),
    sourceSnapshot: jsonb("source_snapshot").notNull(),
    confirmedBy: text("confirmed_by")
      .notNull()
      .references(() => identityUsers.id),
    consentVersion: text("consent_version").notNull().default("final-policy-v1"),
    active: boolean("active").notNull().default(true),
    createdAt: instant("created_at").notNull().defaultNow(),
    withdrawnAt: instant("withdrawn_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.leadId, t.offerId],
      foreignColumns: [partnerOffers.leadId, partnerOffers.id],
    }),
    uniqueIndex("partner_final_policy_offer_active")
      .on(t.offerId)
      .where(sql`${t.active}`),
    uniqueIndex("partner_final_policy_document_active")
      .on(t.documentId)
      .where(sql`${t.active}`),
    index("partner_final_policy_history").on(t.leadId, t.createdAt, t.id),
    check("partner_final_policy_fingerprint", sql`${t.fingerprint} ~ '^[a-f0-9]{64}$'`),
    check(
      "partner_final_policy_withdrawal",
      sql`(${t.active} and ${t.withdrawnAt} is null) or (not ${t.active} and ${t.withdrawnAt} is not null)`,
    ),
  ],
);
export const partnerFinalPolicyReviews = pgTable(
  "partner_final_policy_reviews",
  {
    id: text("id").primaryKey(),
    policyId: text("policy_id")
      .notNull()
      .references(() => partnerFinalPolicies.id),
    version: integer("version").notNull(),
    checks: jsonb("checks").notNull(),
    reviewedBy: text("reviewed_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_final_policy_review_version").on(t.policyId, t.version),
    check("partner_final_policy_review_positive", sql`${t.version}>0`),
  ],
);

export const partnerCommands = pgTable(
  "partner_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    key: text("key").notNull(),
    operation: text("operation").notNull(),
    hash: text("hash").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_command_key").on(t.userId, t.key),
    index("partner_command_expiry").on(t.createdAt),
  ],
);

export const partnerNotifications = pgTable(
  "partner_notifications",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    recipientId: text("recipient_id").references(() => identityUsers.id),
    collaborationId: text("collaboration_id").references(() => partnerCollaborations.id),
    audience: text("audience").notNull(),
    kind: text("kind").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    action: text("action"),
    priority: text("priority").notNull(),
    dueAt: instant("due_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
    resolvedAt: instant("resolved_at"),
  },
  (t) => [
    index("partner_notification_inbox").on(t.recipientId, t.createdAt, t.id),
    index("partner_notification_lead").on(t.leadId, t.resolvedAt),
    check(
      "partner_notification_recipient",
      sql`(${t.audience} = 'coverview' and ${t.recipientId} is null) or (${t.audience} in ('partner','wallet') and ${t.recipientId} is not null)`,
    ),
    check("partner_notification_priority", sql`${t.priority} in ('normal','high','urgent')`),
  ],
);
export const partnerNotificationReads = pgTable(
  "partner_notification_reads",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => partnerNotifications.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    readAt: instant("read_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("partner_notification_read_once").on(t.notificationId, t.userId)],
);
