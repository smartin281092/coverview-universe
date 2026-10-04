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
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { managedProfiles } from "../profiles/index.js";
import { documents } from "../document-intelligence/index.js";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
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
    check(
      "partner_lead_bounds",
      sql`${t.revision} >= 0 and (${t.estimatedCommissionMinor} is null or ${t.estimatedCommissionMinor} >= 0)`,
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
    revokedAt: instant("revoked_at"),
  },
  (t) => [
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
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    subjectId: text("subject_id"),
    kind: text("kind").notNull(),
    audience: text("audience").notNull(),
    text: text("text").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_event_lead").on(t.leadId, t.createdAt, t.id),
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
