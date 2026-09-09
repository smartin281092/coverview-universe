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
import type { CompanyActionGroup, CompanyActionValues, ServiceRequest } from "@coverview/contracts";
import { identityUsers } from "../identity/index.js";
import { managedProfiles } from "../profiles/index.js";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const companyServiceRequests = pgTable(
  "company_service_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    managedProfileId: text("managed_profile_id"),
    profileId: text("profile_id").notNull(),
    profileName: text("profile_name").notNull(),
    companyId: text("company_id").$type<ServiceRequest["companyId"]>().notNull(),
    group: text("field_group").$type<CompanyActionGroup>().notNull(),
    values: jsonb("values").$type<CompanyActionValues>().notNull(),
    valuesHash: text("values_hash").notNull(),
    profileRevision: integer("profile_revision").notNull(),
    revision: integer("revision").notNull().default(0),
    state: text("state").$type<ServiceRequest["state"]>().notNull().default("requested"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.managedProfileId],
      foreignColumns: [managedProfiles.userId, managedProfiles.id],
    }),
    check(
      "company_service_requests_target",
      sql`(${table.profileId} = 'self' and ${table.managedProfileId} is null) or (${table.profileId} = ${table.managedProfileId} and ${table.managedProfileId} is not null)`,
    ),
    check(
      "company_service_requests_state",
      sql`${table.state} in ('requested','in_progress','notified','confirmed')`,
    ),
    check(
      "company_service_requests_group",
      sql`${table.group} in ('address','phone','contactEmail','firstName','lastName','birthDate','nationality','companyName','registrationNumber')`,
    ),
    check(
      "company_service_requests_company",
      sql`${table.companyId} in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm')`,
    ),
    check(
      "company_service_requests_bounds",
      sql`${table.revision} >= 0 and ${table.profileRevision} >= 0 and jsonb_typeof(${table.values}) = 'object' and octet_length(${table.values}::text) <= 8192 and ${table.valuesHash} ~ '^[0-9a-f]{64}$' and length(${table.profileName}) between 1 and 160`,
    ),
    uniqueIndex("company_service_requests_owner_id").on(table.userId, table.id),
    uniqueIndex("company_service_requests_active")
      .on(table.userId, table.profileId, table.companyId, table.group, table.valuesHash)
      .where(sql`${table.state} in ('requested','in_progress')`),
    index("company_service_requests_owner_list").on(table.userId, table.createdAt, table.id),
    index("company_service_requests_admin_list").on(table.state, table.createdAt, table.id),
  ],
);
export const companyActionEvidence = pgTable(
  "company_action_evidence",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    requestId: text("request_id").notNull(),
    kind: text("kind").$type<"notified" | "confirmed">().notNull(),
    occurredAt: instant("occurred_at").notNull(),
    recordedAt: instant("recorded_at").notNull().defaultNow(),
    reference: text("reference").notNull(),
    administratorUserId: text("administrator_user_id")
      .notNull()
      .references(() => identityUsers.id),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.requestId],
      foreignColumns: [companyServiceRequests.userId, companyServiceRequests.id],
    }),
    check("company_action_evidence_kind", sql`${table.kind} in ('notified','confirmed')`),
    check(
      "company_action_evidence_bounds",
      sql`length(${table.reference}) between 1 and 500 and ${table.occurredAt} <= ${table.recordedAt}`,
    ),
    uniqueIndex("company_action_evidence_request_kind").on(
      table.userId,
      table.requestId,
      table.kind,
    ),
  ],
);
export const companyActionCommands = pgTable(
  "company_action_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => identityUsers.id),
    sessionId: text("session_id").notNull(),
    operation: text("operation").$type<"request" | "transition">().notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    response: jsonb("response").$type<ServiceRequest>().notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("company_action_commands_key").on(
      table.userId,
      table.actorUserId,
      table.operation,
      table.key,
    ),
    index("company_action_commands_expiry").on(table.expiresAt, table.id),
    check(
      "company_action_commands_bounds",
      sql`${table.operation} in ('request','transition') and ${table.requestHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
export const companyActionAudit = pgTable(
  "company_action_audit",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    requestId: text("request_id").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => identityUsers.id),
    sessionId: text("session_id").notNull(),
    state: text("state").notNull(),
    revision: integer("revision").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.requestId],
      foreignColumns: [companyServiceRequests.userId, companyServiceRequests.id],
    }),
    index("company_action_audit_owner").on(table.userId, table.requestId, table.createdAt),
    check(
      "company_action_audit_bounds",
      sql`${table.revision} >= 0 and ${table.state} in ('requested','in_progress','notified','confirmed')`,
    ),
  ],
);
