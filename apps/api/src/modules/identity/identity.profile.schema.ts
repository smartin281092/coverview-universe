import type { Profile, ProfileDraft, ProfileStep, ProfileValues } from "@coverview/contracts";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { identityProfiles, identitySessions, identityUsers } from "./identity.schema.js";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

export const profileDrafts = pgTable(
  "profile_drafts",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull().unique(),
    fields: jsonb("fields").$type<ProfileValues>().notNull().default({}),
    revision: integer("revision").notNull().default(0),
    step: text("step", { enum: ["information", "contact", "address", "review"] })
      .notNull()
      .default("information"),
    createdAt: instant("created_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
    claimedBy: text("claimed_by").references(() => identityUsers.id),
    claimedAt: instant("claimed_at"),
    renewedAt: instant("renewed_at"),
  },
  (table) => [
    check("profile_drafts_hash", sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check("profile_drafts_fields", sql`jsonb_typeof(${table.fields}) = 'object'`),
    check("profile_drafts_revision", sql`${table.revision} >= 0`),
    check(
      "profile_drafts_step",
      sql`${table.step} in ('information', 'contact', 'address', 'review')`,
    ),
    check("profile_drafts_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
    check("profile_drafts_claim", sql`(${table.claimedBy} is null) = (${table.claimedAt} is null)`),
    index("profile_drafts_expiry").on(table.expiresAt, table.id),
    index("profile_drafts_claimant").on(table.claimedBy, table.id),
  ],
);

export const profileChoices = pgTable(
  "profile_choices",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    profileId: text("profile_id")
      .notNull()
      .references(() => identityProfiles.id),
    sessionId: text("session_id")
      .notNull()
      .references(() => identitySessions.id),
    purpose: text("purpose", { enum: ["profile.prefill"] }).notNull(),
    version: text("version", { enum: ["1"] }).notNull(),
    enabled: boolean("enabled").notNull(),
    decidedAt: instant("decided_at").notNull(),
  },
  (table) => [
    check("profile_choices_purpose", sql`${table.purpose} = 'profile.prefill'`),
    check("profile_choices_version", sql`${table.version} = '1'`),
    index("profile_choices_owner_list").on(table.userId, table.decidedAt, table.id),
  ],
);

type CommandResponse = Profile | ProfileDraft | { profile: Profile; resumeStep: ProfileStep };
export const profileCommands = pgTable(
  "profile_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => identityUsers.id),
    draftId: text("draft_id").references(() => profileDrafts.id),
    endpoint: text("endpoint", { enum: ["save", "confirm", "save_draft", "attach"] }).notNull(),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status").notNull().default(200),
    // Private retry snapshots have a technical TTL and never enter logs or audit.
    response: jsonb("response").$type<CommandResponse>().notNull(),
    createdAt: instant("created_at").notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [
    check("profile_commands_owner", sql`(${table.userId} is null) <> (${table.draftId} is null)`),
    check(
      "profile_commands_scope",
      sql`(${table.draftId} is not null and ${table.endpoint} = 'save_draft') or (${table.userId} is not null and ${table.endpoint} in ('save', 'confirm', 'attach'))`,
    ),
    check("profile_commands_hash", sql`${table.requestHash} ~ '^[0-9a-f]{64}$'`),
    check(
      "profile_commands_key",
      sql`${table.key} ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'`,
    ),
    check(
      "profile_commands_response",
      sql`${table.responseStatus} = 200 and jsonb_typeof(${table.response}) = 'object'`,
    ),
    check("profile_commands_expiration", sql`${table.expiresAt} > ${table.createdAt}`),
    uniqueIndex("profile_commands_user_key")
      .on(table.userId, table.endpoint, table.key)
      .where(sql`${table.userId} is not null`),
    uniqueIndex("profile_commands_draft_key")
      .on(table.draftId, table.endpoint, table.key)
      .where(sql`${table.draftId} is not null`),
    index("profile_commands_user_expiry").on(table.userId, table.expiresAt, table.id),
    index("profile_commands_draft_expiry").on(table.draftId, table.expiresAt, table.id),
  ],
);

export const profileAuditEvents = pgTable(
  "profile_audit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => identityUsers.id),
    sessionId: text("session_id").references(() => identitySessions.id),
    profileId: text("profile_id").references(() => identityProfiles.id),
    draftId: text("draft_id").references(() => profileDrafts.id),
    // The expiring retry cache must not own the audit lifecycle.
    commandId: text("command_id").notNull().unique(),
    action: text("action", {
      enum: [
        "profile.saved.v1",
        "profile.confirmed.v1",
        "profile.draft_saved.v1",
        "profile.draft_attached.v1",
        "profile.document_enriched.v1",
      ],
    }).notNull(),
    revision: integer("revision").notNull(),
    createdAt: instant("created_at").notNull(),
  },
  (table) => [
    check("profile_audit_actor", sql`${table.userId} is not null or ${table.draftId} is not null`),
    check("profile_audit_session", sql`${table.sessionId} is null or ${table.userId} is not null`),
    check(
      "profile_audit_action",
      sql`${table.action} in ('profile.saved.v1', 'profile.confirmed.v1', 'profile.draft_saved.v1', 'profile.draft_attached.v1', 'profile.document_enriched.v1')`,
    ),
    check("profile_audit_revision", sql`${table.revision} >= 0`),
    index("profile_audit_owner_list").on(table.userId, table.createdAt, table.id),
    index("profile_audit_draft_list").on(table.draftId, table.createdAt, table.id),
  ],
);
