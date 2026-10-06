import { sql } from "drizzle-orm";
import { boolean, check, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { partnerLeads } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

// A complement asked of the client to complete the comparative analysis (C8e, brief I.13). The
// request, its single answer and its single closure are written once; the state follows from them.
export const partnerComplementRequests = pgTable(
  "partner_complement_requests",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    subjectKey: text("subject_key").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => identityUsers.id),
    items: jsonb("items").notNull(),
    message: text("message").notNull(),
    dueAt: instant("due_at").notNull(),
    pauseFollowUp: boolean("pause_follow_up").notNull(),
    invalidatedAt: instant("invalidated_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_complement_requests_lead").on(t.leadId, t.createdAt, t.id),
    check(
      "partner_complement_request_shape",
      sql`jsonb_typeof(${t.items})='array' and jsonb_array_length(${t.items}) between 1 and 3 and length(trim(${t.message})) between 10 and 2000`,
    ),
  ],
);
export const partnerComplementAnswers = pgTable(
  "partner_complement_answers",
  {
    requestId: text("request_id")
      .primaryKey()
      .references(() => partnerComplementRequests.id),
    answeredBy: text("answered_by")
      .notNull()
      .references(() => identityUsers.id),
    text: text("text").notNull(),
    documents: jsonb("documents").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "partner_complement_answer_shape",
      sql`length(${t.text})<=2000 and jsonb_typeof(${t.documents})='array' and jsonb_array_length(${t.documents})<=5 and (length(trim(${t.text}))>=10 or jsonb_array_length(${t.documents})>0)`,
    ),
  ],
);
export const partnerComplementClosures = pgTable(
  "partner_complement_closures",
  {
    requestId: text("request_id")
      .primaryKey()
      .references(() => partnerComplementRequests.id),
    closedBy: text("closed_by")
      .notNull()
      .references(() => identityUsers.id),
    outcome: text("outcome").notNull(),
    note: text("note").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    check(
      "partner_complement_closure_shape",
      sql`${t.outcome} in ('completed','unanswered','withdrawn') and length(${t.note})<=2000`,
    ),
  ],
);
