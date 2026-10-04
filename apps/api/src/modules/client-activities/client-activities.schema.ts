import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { ClientActivity } from "@coverview/contracts";
import { identityUsers } from "../identity/index.js";
import { managedProfiles } from "../profiles/index.js";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const clientActivities = pgTable(
  "client_activities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    managedProfileId: text("managed_profile_id"),
    kind: text("kind").$type<ClientActivity["kind"]>().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    state: text("state").$type<ClientActivity["state"]>().notNull(),
    startsAt: instant("starts_at"),
    endsAt: instant("ends_at"),
    timezone: text("timezone").notNull(),
    revision: integer("revision").notNull().default(0),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.managedProfileId],
      foreignColumns: [managedProfiles.userId, managedProfiles.id],
    }),
    check("client_activities_kind", sql`${table.kind} in ('task','note','event','appointment')`),
    check("client_activities_state", sql`${table.state} in ('open','completed','cancelled')`),
    check(
      "client_activities_bounds",
      sql`${table.revision} >= 0 and length(${table.title}) between 1 and 200 and length(${table.description}) <= 8000 and length(${table.timezone}) between 1 and 100`,
    ),
    check(
      "client_activities_schedule",
      sql`(${table.kind} not in ('event','appointment') or ${table.startsAt} is not null) and (${table.endsAt} is null or (${table.startsAt} is not null and ${table.endsAt} >= ${table.startsAt}))`,
    ),
    index("client_activities_profile_list").on(table.userId, table.managedProfileId, table.id),
  ],
);
export const clientActivityCommands = pgTable(
  "client_activity_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    profileId: text("profile_id").notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    activityId: text("activity_id").notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("client_activity_commands_key").on(table.userId, table.key),
    index("client_activity_commands_expiry").on(table.expiresAt),
  ],
);
export const clientActivityAudit = pgTable(
  "client_activity_audit",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    profileId: text("profile_id").notNull(),
    activityId: text("activity_id").notNull(),
    administratorUserId: text("administrator_user_id").notNull(),
    sessionId: text("session_id").notNull(),
    action: text("action").$type<"created" | "updated">().notNull(),
    revision: integer("revision").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [index("client_activity_audit_owner").on(table.userId, table.createdAt, table.id)],
);
