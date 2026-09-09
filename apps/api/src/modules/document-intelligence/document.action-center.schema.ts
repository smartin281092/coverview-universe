import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  check,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import type {
  ActionCenterHistoryItem,
  ActionCenterResolveResult,
  ActionCenterManualReview,
} from "@coverview/contracts";
import { identityUsers } from "../identity/index.js";
import { managedProfiles } from "../profiles/index.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const actionCenterResolutions = pgTable(
  "action_center_resolutions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    managedProfileId: text("managed_profile_id"),
    profileId: text("profile_id").notNull(),
    actionId: text("action_id").notNull(),
    topic: text("topic").notNull(),
    observedHash: text("observed_hash").notNull(),
    profileHash: text("profile_hash").notNull(),
    fingerprint: text("fingerprint").notNull(),
    history: jsonb("history").$type<ActionCenterHistoryItem>().notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => identityUsers.id),
    sessionId: text("session_id").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.managedProfileId],
      foreignColumns: [managedProfiles.userId, managedProfiles.id],
    }),
    check(
      "action_center_resolution_target",
      sql`(${table.profileId}='self' and ${table.managedProfileId} is null) or (${table.profileId}=${table.managedProfileId} and ${table.managedProfileId} is not null)`,
    ),
    check(
      "action_center_resolution_bounds",
      sql`${table.actionId} ~ '^act_[0-9a-f]{32}$' and ${table.observedHash} ~ '^[0-9a-f]{64}$' and ${table.profileHash} ~ '^[0-9a-f]{64}$' and ${table.fingerprint} ~ '^[0-9a-f]{64}$' and length(${table.topic}) between 1 and 100 and jsonb_typeof(${table.history})='object'`,
    ),
    uniqueIndex("action_center_resolutions_owner_id").on(table.userId, table.id),
    index("action_center_resolutions_owner_action").on(
      table.userId,
      table.actionId,
      table.createdAt,
      table.id,
    ),
    index("action_center_resolutions_owner_history").on(table.userId, table.createdAt, table.id),
  ],
);
export const actionCenterManualReviews = pgTable(
  "action_center_manual_reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    resolutionId: text("resolution_id").notNull(),
    actionId: text("action_id").notNull(),
    profileId: text("profile_id").notNull(),
    profileName: text("profile_name").notNull(),
    topic: text("topic").notNull(),
    response: text("response").notNull(),
    state: text("state").$type<ActionCenterManualReview["state"]>().notNull().default("requested"),
    revision: integer("revision").notNull().default(0),
    resolution: text("resolution"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.resolutionId],
      foreignColumns: [actionCenterResolutions.userId, actionCenterResolutions.id],
    }),
    uniqueIndex("action_center_manual_resolution").on(table.userId, table.resolutionId),
    index("action_center_manual_owner_action").on(table.userId, table.actionId),
    index("action_center_manual_admin_list").on(table.createdAt, table.id),
    check(
      "action_center_manual_bounds",
      sql`${table.revision} >= 0 and ${table.state} in ('requested','in_progress','resolved') and length(${table.response}) between 1 and 2000 and (${table.state}<>'resolved' or (${table.resolution} is not null and length(${table.resolution}) between 1 and 2000))`,
    ),
  ],
);
export const actionCenterCommands = pgTable(
  "action_center_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => identityUsers.id),
    operation: text("operation").$type<"resolve" | "manual_transition">().notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response")
      .$type<ActionCenterResolveResult | ActionCenterManualReview>()
      .notNull(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("action_center_commands_idempotency").on(
      table.userId,
      table.actorUserId,
      table.operation,
      table.key,
    ),
    index("action_center_commands_expiry").on(table.expiresAt, table.id),
    check(
      "action_center_commands_operation",
      sql`${table.operation} in ('resolve','manual_transition') and ${table.requestHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
