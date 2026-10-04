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
import { partnerOrganizations } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const partnerGoals = pgTable(
  "partner_goals",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => identityUsers.id),
    scopeKind: text("scope_kind").notNull(),
    organizationId: text("organization_id").references(() => partnerOrganizations.id),
    userIds: jsonb("user_ids").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_goal_creator").on(t.creatorId, t.createdAt, t.id),
    index("partner_goal_organization").on(t.organizationId),
    check(
      "partner_goal_scope",
      sql`${t.scopeKind} in ('individual','team','organization','network')`,
    ),
  ],
);
export const partnerGoalVersions = pgTable(
  "partner_goal_versions",
  {
    id: text("id").primaryKey(),
    goalId: text("goal_id")
      .notNull()
      .references(() => partnerGoals.id),
    revision: integer("revision").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => identityUsers.id),
    input: jsonb("input").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_goal_version").on(t.goalId, t.revision),
    check("partner_goal_revision", sql`${t.revision}>0`),
  ],
);
