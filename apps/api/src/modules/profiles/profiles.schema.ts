import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  check,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import type { ManagedProfile, ProfileSection, ProfileSectionValues } from "@coverview/contracts";
import { identityUsers } from "../identity/index.js";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const managedProfiles = pgTable(
  "managed_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    kind: text("kind").$type<ManagedProfile["kind"]>().notNull(),
    displayName: text("display_name").notNull(),
    revision: integer("revision").notNull().default(0),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check("managed_profiles_kind", sql`${table.kind} in ('person','legal_entity')`),
    check(
      "managed_profiles_bounds",
      sql`${table.revision} >= 0 and length(${table.displayName}) between 1 and 160`,
    ),
    uniqueIndex("managed_profiles_owner_id").on(table.userId, table.id),
    index("managed_profiles_owner_list").on(table.userId, table.createdAt, table.id),
  ],
);
export const managedProfileSections = pgTable(
  "managed_profile_sections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    // Null denotes the owner's canonical profile; its general fields are never copied here.
    managedProfileId: text("managed_profile_id"),
    section: text("section").$type<ProfileSection["section"]>().notNull(),
    revision: integer("revision").notNull().default(0),
    step: text("step").$type<ProfileSection["step"]>().notNull().default("information"),
    values: jsonb("values").$type<ProfileSectionValues>().notNull().default({}),
    documentSources: jsonb("document_sources")
      .$type<NonNullable<ProfileSection["documentSources"]>>()
      .notNull()
      .default({}),
    confirmedAt: instant("confirmed_at"),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.managedProfileId],
      foreignColumns: [managedProfiles.userId, managedProfiles.id],
    }),
    check(
      "managed_profile_sections_kind",
      sql`${table.section} in ('general','finances','health') and (${table.managedProfileId} is not null or ${table.section} <> 'general')`,
    ),
    check(
      "managed_profile_sections_bounds",
      sql`${table.revision} >= 0 and jsonb_typeof(${table.values}) = 'object'`,
    ),
    check(
      "managed_profile_sections_step",
      sql`${table.step} in ('information','contact','details','review') and (${table.step} <> 'contact' or ${table.section} = 'general')`,
    ),
    uniqueIndex("managed_profile_sections_managed")
      .on(table.userId, table.managedProfileId, table.section)
      .where(sql`${table.managedProfileId} is not null`),
    uniqueIndex("managed_profile_sections_self")
      .on(table.userId, table.section)
      .where(sql`${table.managedProfileId} is null`),
  ],
);
export const managedProfileCommands = pgTable(
  "managed_profile_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    operation: text("operation").$type<"create" | "save_section">().notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    // A command retains its target, never a copy of personal or medical values.
    response: jsonb("response")
      .$type<{ profileId: string; section?: ProfileSection["section"] }>()
      .notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [
    check(
      "managed_profile_commands_operation",
      sql`${table.operation} in ('create','save_section')`,
    ),
    check("managed_profile_commands_hash", sql`${table.requestHash} ~ '^[0-9a-f]{64}$'`),
    check("managed_profile_commands_response", sql`jsonb_typeof(${table.response}) = 'object'`),
    uniqueIndex("managed_profile_commands_key").on(table.userId, table.operation, table.key),
    index("managed_profile_commands_expiry").on(table.userId, table.expiresAt, table.id),
  ],
);
export const managedProfileAudit = pgTable(
  "managed_profile_audit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    sessionId: text("session_id").notNull(),
    profileId: text("profile_id").notNull(),
    section: text("section").$type<ProfileSection["section"]>(),
    action: text("action").$type<"profile.created.v1" | "profile.section_saved.v1">().notNull(),
    revision: integer("revision").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "managed_profile_audit_action",
      sql`${table.action} in ('profile.created.v1','profile.section_saved.v1')`,
    ),
    check("managed_profile_audit_revision", sql`${table.revision} >= 0`),
    index("managed_profile_audit_owner").on(table.userId, table.createdAt, table.id),
  ],
);
