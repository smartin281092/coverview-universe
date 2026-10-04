import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { partnerLeads } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const partnerLeadRelationships = pgTable(
  "partner_lead_relationships",
  {
    id: text("id").primaryKey(),
    sourceLeadId: text("source_lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    targetLeadId: text("target_lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    sourceRevision: integer("source_revision").notNull(),
    targetRevision: integer("target_revision").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    subjectKey: text("subject_key").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    kind: text("kind").notNull(),
    reason: text("reason").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    invalidatedAt: instant("invalidated_at"),
    withdrawnAt: instant("withdrawn_at"),
    withdrawnBy: text("withdrawn_by").references(() => identityUsers.id),
    withdrawalReason: text("withdrawal_reason"),
  },
  (t) => [
    index("partner_relationship_source_history").on(t.sourceLeadId, t.createdAt, t.id),
    index("partner_relationship_target_history").on(t.targetLeadId, t.createdAt, t.id),
    uniqueIndex("partner_relationship_one_parent")
      .on(t.sourceLeadId)
      .where(sql`${t.withdrawnAt} is null and ${t.invalidatedAt} is null`),
    check(
      "partner_relationship_shape",
      sql`${t.sourceLeadId}<>${t.targetLeadId} and ${t.sourceRevision}>=0 and ${t.targetRevision}>=0 and ${t.kind} in ('related','duplicate') and length(trim(${t.reason})) between 5 and 2000`,
    ),
    check(
      "partner_relationship_withdrawal",
      sql`(${t.withdrawnAt} is null and ${t.withdrawnBy} is null and ${t.withdrawalReason} is null)
    or (${t.withdrawnAt} is not null and ${t.withdrawnBy} is not null and length(trim(${t.withdrawalReason})) between 5 and 2000)`,
    ),
  ],
);
