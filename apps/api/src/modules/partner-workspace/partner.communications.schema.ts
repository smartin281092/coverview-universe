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
import { partnerLeads, partnerTasks } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const partnerCommunicationPreferences = pgTable(
  "partner_communication_preferences",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    subjectKey: text("subject_key").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    revision: integer("revision").notNull(),
    input: jsonb("input").notNull(),
    invalidatedAt: instant("invalidated_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_communication_preference_revision").on(t.leadId, t.revision),
    check("partner_communication_preference_positive", sql`${t.revision}>0`),
  ],
);
export const partnerCommunicationRecords = pgTable(
  "partner_communication_records",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    ownerId: text("owner_id").references(() => identityUsers.id),
    invalidatedAt: instant("invalidated_at"),
    authorId: text("author_id")
      .notNull()
      .references(() => identityUsers.id),
    subjectKey: text("subject_key").notNull(),
    input: jsonb("input").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [index("partner_communication_record_lead").on(t.leadId, t.createdAt, t.id)],
);
export const partnerRecordingRequests = pgTable(
  "partner_recording_requests",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    advisorId: text("advisor_id")
      .notNull()
      .references(() => identityUsers.id),
    advisorRevision: integer("advisor_revision").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    subjectKey: text("subject_key").notNull(),
    scopeRevision: integer("scope_revision").notNull(),
    input: jsonb("input").notNull(),
    invalidatedAt: instant("invalidated_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [index("partner_recording_lead").on(t.leadId, t.createdAt, t.id)],
);
export const partnerRecordingDecisions = pgTable(
  "partner_recording_decisions",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => partnerRecordingRequests.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    revision: integer("revision").notNull(),
    decision: text("decision").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_recording_decision_revision").on(t.requestId, t.revision),
    check(
      "partner_recording_decision_values",
      sql`${t.revision}>0 and ${t.decision} in ('allow','decline','withdraw')`,
    ),
  ],
);
export const partnerTranscripts = pgTable(
  "partner_transcripts",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => partnerRecordingRequests.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    revision: integer("revision").notNull(),
    input: jsonb("input").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_transcript_revision").on(t.requestId, t.revision),
    check("partner_transcript_positive", sql`${t.revision}>0`),
  ],
);
export const partnerTranscriptActions = pgTable(
  "partner_transcript_actions",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id")
      .notNull()
      .references(() => partnerTranscripts.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    segmentIndex: integer("segment_index").notNull(),
    quote: text("quote").notNull(),
    taskId: text("task_id")
      .notNull()
      .references(() => partnerTasks.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_transcript_task").on(t.taskId),
    check("partner_transcript_segment", sql`${t.segmentIndex} between 0 and 99`),
  ],
);
export const partnerTranscriptAccesses = pgTable(
  "partner_transcript_accesses",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id")
      .notNull()
      .references(() => partnerRecordingRequests.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [index("partner_transcript_access_request").on(t.requestId, t.createdAt, t.id)],
);
