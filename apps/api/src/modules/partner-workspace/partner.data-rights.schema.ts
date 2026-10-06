import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { managedProfiles } from "../profiles/index.js";
import { partnerLeads } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
// Proof that a person exported their Partner data (C7a): who, from which session and surface, the
// manifest version and counts. Never the content, which is generated on demand and not stored.
export const partnerDataExports = pgTable(
  "partner_data_exports",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    sessionId: text("session_id").notNull(),
    surface: text("surface").notNull(),
    manifestVersion: text("manifest_version").notNull(),
    complete: boolean("complete").notNull().default(false),
    counts: jsonb("counts").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_data_export_user").on(t.userId, t.createdAt, t.id),
    check("partner_data_export_surface", sql`${t.surface} in ('wallet','partner')`),
  ],
);
// A request about one's data (C7b): rectification, erasure, complete access or another question,
// answered by CoverView. It moves forward only and is frozen once answered or withdrawn.
export const partnerDataRequests = pgTable(
  "partner_data_requests",
  {
    id: text("id").primaryKey(),
    requesterId: text("requester_id")
      .notNull()
      .references(() => identityUsers.id),
    surface: text("surface").notNull(),
    subjectKey: text("subject_key").notNull(),
    profileId: text("profile_id").references(() => managedProfiles.id),
    kind: text("kind").notNull(),
    category: text("category"),
    leadId: text("lead_id").references(() => partnerLeads.id),
    message: text("message").notNull(),
    state: text("state").notNull().default("received"),
    outcome: text("outcome"),
    answer: text("answer"),
    accessUntil: instant("access_until"),
    erasure: jsonb("erasure"),
    takenBy: text("taken_by").references(() => identityUsers.id),
    takenAt: instant("taken_at"),
    answeredBy: text("answered_by").references(() => identityUsers.id),
    answeredAt: instant("answered_at"),
    withdrawnAt: instant("withdrawn_at"),
    revision: integer("revision").notNull().default(0),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_data_request_requester").on(t.requesterId, t.createdAt, t.id),
    index("partner_data_request_queue").on(t.state, t.createdAt, t.id),
    check(
      "partner_data_request_kind",
      sql`${t.surface} in ('wallet','partner') and ${t.kind} in ('rectification','erasure','complete_access','other') and (${t.surface}='wallet' or ${t.kind}<>'complete_access')`,
    ),
    check(
      "partner_data_request_subject",
      sql`(${t.surface}='partner' and ${t.subjectKey}='member:'||${t.requesterId} and ${t.profileId} is null and ${t.leadId} is null)
        or (${t.surface}='wallet' and (${t.subjectKey}='self:'||${t.requesterId} and ${t.profileId} is null or ${t.subjectKey}='profile:'||${t.profileId}))`,
    ),
    check(
      "partner_data_request_text",
      sql`length(trim(${t.message})) between 10 and 2000 and (${t.answer} is null or length(trim(${t.answer})) between 10 and 2000)`,
    ),
    check(
      "partner_data_request_state",
      sql`${t.state} in ('received','in_progress','answered','withdrawn') and ${t.revision}>=0
        and ((${t.state}='answered') = (${t.outcome} is not null and ${t.answer} is not null and ${t.answeredBy} is not null and ${t.answeredAt} is not null))
        and ((${t.state}='withdrawn') = (${t.withdrawnAt} is not null))
        and ((${t.takenBy} is null) = (${t.takenAt} is null))
        and (${t.accessUntil} is null or ${t.outcome}='granted')`,
    ),
    check(
      "partner_data_request_outcome",
      sql`${t.outcome} is null
        or ${t.kind}='rectification' and ${t.outcome} in ('done','partially_done','refused')
        or ${t.kind}='erasure' and ${t.surface}='wallet' and ${t.outcome} in ('done','partially_done','refused')
        or ${t.kind}='erasure' and ${t.surface}='partner' and ${t.outcome} in ('answered','refused')
        or ${t.kind}='complete_access' and (${t.outcome}='granted' and ${t.accessUntil} is not null or ${t.outcome}='refused')
        or ${t.kind}='other' and ${t.outcome} in ('answered','refused')`,
    ),
    // Only an executed erasure (C7c) carries its summary, and an executed erasure always does.
    check(
      "partner_data_request_erasure",
      sql`(${t.erasure} is not null) = (${t.kind}='erasure' and ${t.surface}='wallet' and ${t.outcome} in ('done','partially_done'))`,
    ),
  ],
);
