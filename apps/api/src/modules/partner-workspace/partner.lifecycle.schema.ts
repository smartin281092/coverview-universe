import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { partnerLeads } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const partnerLeadReopenings = pgTable(
  "partner_lead_reopenings",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    ownerId: text("owner_id").references(() => identityUsers.id),
    subjectKey: text("subject_key").notNull(),
    leadRevision: integer("lead_revision").notNull(),
    closedResult: text("closed_result").notNull(),
    closedReason: text("closed_reason").notNull(),
    closedAt: instant("closed_at").notNull(),
    reopenedAt: instant("reopened_at").notNull().defaultNow(),
    reason: text("reason").notNull(),
    nextAction: text("next_action").notNull(),
    dueAt: instant("due_at").notNull(),
  },
  (t) => [
    index("partner_reopenings_lead").on(t.leadId, t.reopenedAt, t.id),
    uniqueIndex("partner_reopening_once").on(t.leadId, t.leadRevision),
    check("partner_reopening_revision", sql`${t.leadRevision}>=0`),
    check(
      "partner_reopening_dates",
      sql`${t.closedAt}<=${t.reopenedAt} and ${t.reopenedAt}<${t.dueAt}`,
    ),
    check(
      "partner_reopening_reason",
      sql`length(trim(${t.reason})) between 5 and 2000 and length(trim(${t.nextAction})) between 2 and 240`,
    ),
  ],
);
