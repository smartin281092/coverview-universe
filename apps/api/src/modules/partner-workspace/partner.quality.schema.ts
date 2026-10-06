import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { partnerLeads } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

export const partnerSurveys = pgTable(
  "partner_surveys",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    subjectKey: text("subject_key").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    completedAt: instant("completed_at").notNull(),
    invalidatedAt: instant("invalidated_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_survey_lead_once").on(t.leadId),
    index("partner_survey_owner").on(t.ownerId, t.createdAt, t.id),
  ],
);
export const partnerSurveyResponses = pgTable(
  "partner_survey_responses",
  {
    surveyId: text("survey_id")
      .primaryKey()
      .references(() => partnerSurveys.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    response: jsonb("response").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "partner_survey_response_branch",
      sql`coalesce(jsonb_typeof(${t.response})='object' and (${t.response}->>'rating')::integer between 1 and 5 and jsonb_typeof(${t.response}->'positives')='array' and jsonb_typeof(${t.response}->'improvements')='array' and ${t.response}->'confirmed'='true'::jsonb and ((${t.response}->>'rating')::integer=5 and jsonb_array_length(${t.response}->'improvements')=0 and ${t.response}->'callbackRequested'='false'::jsonb or (${t.response}->>'rating')::integer<5 and jsonb_array_length(${t.response}->'positives')=0),false)`,
    ),
  ],
);
export const partnerQualityCases = pgTable(
  "partner_quality_cases",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    subjectKey: text("subject_key").notNull(),
    ownerId: text("owner_id").references(() => identityUsers.id),
    invalidatedAt: instant("invalidated_at"),
    authorId: text("author_id")
      .notNull()
      .references(() => identityUsers.id),
    surveyId: text("survey_id").references(() => partnerSurveys.id),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    priority: text("priority").notNull(),
    audience: text("audience").notNull(),
    dueAt: instant("due_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_quality_survey_once").on(t.surveyId),
    index("partner_quality_lead").on(t.leadId, t.createdAt, t.id),
    index("partner_quality_queue").on(t.createdAt, t.id),
    check(
      "partner_quality_values",
      sql`${t.kind} in ('complaint','callback','verification','corrective_action') and ${t.priority} in ('normal','high','urgent') and ${t.audience} in ('client','coverview')`,
    ),
  ],
);
export const partnerQualityActions = pgTable(
  "partner_quality_actions",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => partnerQualityCases.id),
    revision: integer("revision").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    input: jsonb("input").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_quality_action_revision").on(t.caseId, t.revision),
    check("partner_quality_action_positive", sql`${t.revision}>0`),
  ],
);
export const partnerQualitySettings = pgTable(
  "partner_quality_settings",
  {
    revision: integer("revision").primaryKey(),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    input: jsonb("input").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [check("partner_quality_settings_revision", sql`${t.revision}>0`)],
);
// What a client states about a request (C8d, brief I.17.2): from the survey, from Wallet, or as
// CoverView recorded it during a quality call or email. The request's declared state at that
// moment and the differences are kept with it; a difference opens a verification, never a
// complaint. Evidence: written once, only invalidated when the request changes subject.
export const partnerClientConfirmations = pgTable(
  "partner_client_confirmations",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    subjectKey: text("subject_key").notNull(),
    ownerId: text("owner_id").references(() => identityUsers.id),
    channel: text("channel").notNull(),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => identityUsers.id),
    facts: jsonb("facts").notNull(),
    declared: jsonb("declared").notNull(),
    discrepancies: jsonb("discrepancies").notNull(),
    comment: text("comment").notNull().default(""),
    caseId: text("case_id").references(() => partnerQualityCases.id),
    occurredAt: instant("occurred_at"),
    invalidatedAt: instant("invalidated_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_client_confirmations_lead").on(t.leadId, t.createdAt, t.id),
    index("partner_client_confirmations_case").on(t.caseId),
    check(
      "partner_client_confirmation_shape",
      sql`${t.channel} in ('survey','wallet','call','email') and jsonb_typeof(${t.facts})='object' and jsonb_typeof(${t.declared})='object' and jsonb_typeof(${t.discrepancies})='array' and length(${t.comment})<=2000 and (${t.channel} in ('call','email'))=(${t.occurredAt} is not null)`,
    ),
  ],
);
