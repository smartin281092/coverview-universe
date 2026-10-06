import { sql } from "drizzle-orm";
import { pgTable, text, jsonb, timestamp, index, check } from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { partnerOrganizations } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
// Journal of the decisions about a member or an organisation (C8a, I.4): author or system actor,
// date, reason and, when relevant, the resulting state, roles, restrictions and review date.
// Immutable; it starts with the migration and reconstructs no earlier decision.
export const partnerAccessDecisions = pgTable(
  "partner_access_decisions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    userId: text("user_id").references(() => identityUsers.id),
    kind: text("kind").notNull(),
    state: text("state"),
    roles: jsonb("roles"),
    restrictions: jsonb("restrictions"),
    reason: text("reason"),
    reviewDueAt: instant("review_due_at"),
    actorId: text("actor_id").references(() => identityUsers.id),
    systemActor: text("system_actor"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_access_decisions_user").on(t.userId, t.createdAt, t.id),
    index("partner_access_decisions_organization").on(t.organizationId, t.createdAt, t.id),
    check(
      "partner_access_decision_kind",
      sql`${t.kind} in ('member_review','organization_review','restriction','automatic_review','team_removal')`,
    ),
    check(
      "partner_access_decision_actor",
      sql`(${t.actorId} is not null and ${t.systemActor} is null and ${t.kind}<>'automatic_review') or (${t.actorId} is null and ${t.systemActor}='partner-continuity-v1' and ${t.kind}='automatic_review')`,
    ),
    check(
      "partner_access_decision_subject",
      sql`(${t.kind}='organization_review' and ${t.userId} is null) or (${t.kind} in ('member_review','restriction','team_removal') and ${t.userId} is not null) or ${t.kind}='automatic_review'`,
    ),
    check(
      "partner_access_decision_reason",
      sql`case when ${t.kind}='automatic_review' then ${t.reason} is null else length(trim(${t.reason})) between 5 and 2000 end`,
    ),
    check(
      "partner_access_decision_state",
      sql`${t.state} is null or ${t.state} in ('needs_information','approved','rejected','suspended','closed')`,
    ),
  ],
);
