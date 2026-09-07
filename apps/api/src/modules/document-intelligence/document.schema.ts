import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  check,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import type { DocumentAnalysis, DocumentRecord, DocumentSummary } from "@coverview/contracts";
import { identityUsers } from "../identity/index.js";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const documents = pgTable(
  "files",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    declaredMime: text("declared_mime").notNull(),
    size: integer("size").notNull(),
    checksum: text("checksum").notNull(),
    objectKey: text("object_key").notNull().unique(),
    state: text("state").$type<DocumentSummary["state"]>().notNull().default("pending"),
    category: text("category").$type<DocumentSummary["category"]>().notNull().default("unknown"),
    categoryCorrected: boolean("category_corrected").notNull().default(false),
    analysisRequested: boolean("analysis_requested").notNull().default(false),
    revision: integer("revision").notNull().default(0),
    generation: integer("generation").notNull().default(0),
    analysis: jsonb("analysis").$type<DocumentAnalysis>(),
    failure: text("failure"),
    scanVersion: text("scan_version"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    deletedAt: instant("deleted_at"),
  },
  (table) => [
    check(
      "files_state",
      sql`${table.state} in ('pending','queued','scanning','reading','ready','failed','quarantined','deleting','deleted')`,
    ),
    check(
      "files_category",
      sql`${table.category} in ('identity','insurance','pension','invoice','correspondence','unknown')`,
    ),
    check(
      "files_bounds",
      sql`${table.size} between 0 and 20971520 and ${table.revision} >= 0 and ${table.generation} >= 0`,
    ),
    check("files_checksum", sql`${table.checksum} ~ '^[0-9a-f]{64}$'`),
    index("files_owner_list").on(table.userId, table.createdAt, table.id),
    uniqueIndex("files_owner_id").on(table.userId, table.id),
    index("files_pending").on(table.state, table.updatedAt, table.id),
  ],
);
export const documentChangeRequests = pgTable(
  "document_change_requests",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    extractionId: text("extraction_id").notNull(),
    field: text("field").notNull(),
    previousValue: text("previous_value").notNull(),
    requestedValue: text("requested_value").notNull(),
    insurer: text("insurer").notNull(),
    state: text("state").$type<"prepared" | "cancelled">().notNull().default("prepared"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.documentId],
      foreignColumns: [documents.userId, documents.id],
    }),
    check("document_change_requests_state", sql`${table.state} in ('prepared','cancelled')`),
    check(
      "document_change_requests_field",
      sql`${table.field} in ('firstName','lastName','birthDate','nationality','street','postalCode','city','country')`,
    ),
    check(
      "document_change_requests_bounds",
      sql`length(${table.previousValue}) between 1 and 240 and length(${table.requestedValue}) between 1 and 240 and length(${table.insurer}) between 1 and 160`,
    ),
    uniqueIndex("document_change_requests_pending")
      .on(table.userId, table.documentId, table.extractionId)
      .where(sql`${table.state} = 'prepared'`),
    index("document_change_requests_owner_list").on(table.userId, table.createdAt, table.id),
  ],
);
export const documentIdentityAttachments = pgTable(
  "document_identity_attachments",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => identityUsers.id),
    revision: integer("revision").notNull().default(0),
    combinedId: text("combined_id"),
    frontId: text("front_id"),
    backId: text("back_id"),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId, table.combinedId],
      foreignColumns: [documents.userId, documents.id],
    }),
    foreignKey({
      columns: [table.userId, table.frontId],
      foreignColumns: [documents.userId, documents.id],
    }),
    foreignKey({
      columns: [table.userId, table.backId],
      foreignColumns: [documents.userId, documents.id],
    }),
    check("document_identity_attachment_revision", sql`${table.revision} >= 0`),
    check(
      "document_identity_attachment_mode",
      sql`${table.combinedId} is null or (${table.frontId} is null and ${table.backId} is null)`,
    ),
    check(
      "document_identity_attachment_faces",
      sql`${table.frontId} is null or ${table.backId} is null or ${table.frontId} <> ${table.backId}`,
    ),
  ],
);
export const documentIdentityAttachmentCommands = pgTable(
  "document_identity_attachment_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    key: text("key").notNull(),
    hash: text("hash").notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("document_identity_attachment_commands_key").on(table.userId, table.key),
    index("document_identity_attachment_commands_expiry").on(table.expiresAt, table.id),
  ],
);
export const documentDecisions = pgTable(
  "document_decisions",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    sessionId: text("session_id").notNull(),
    revision: integer("revision").notNull(),
    decision: jsonb("decision").$type<DocumentRecord["decisions"][number]>().notNull(),
    createdAt: instant("created_at").notNull(),
  },
  (table) => [
    index("document_decisions_owner").on(table.userId, table.documentId, table.createdAt, table.id),
  ],
);
export const documentCommands = pgTable(
  "document_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    operation: text("operation").notNull(),
    key: text("key").notNull(),
    hash: text("hash").notNull(),
    response: jsonb("response").$type<unknown>().notNull(),
    expiresAt: instant("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("document_commands_idempotency").on(table.userId, table.operation, table.key),
    index("document_commands_expiry").on(table.expiresAt, table.id),
  ],
);
export const documentOutbox = pgTable(
  "document_outbox",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    type: text("type")
      .$type<
        "document.uploaded.v1" | "document.retry_requested.v1" | "document.deletion_requested.v1"
      >()
      .notNull(),
    generation: integer("generation").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    publishedAt: instant("published_at"),
  },
  (table) => [index("document_outbox_pending").on(table.publishedAt, table.createdAt, table.id)],
);
export const documentAudit = pgTable(
  "document_audit_events",
  {
    id: text("id").primaryKey(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    revision: integer("revision").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("document_audit_owner").on(table.userId, table.documentId, table.createdAt, table.id),
  ],
);
export const documentAiCalls = pgTable(
  "document_ai_calls",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    createdAt: instant("created_at").notNull().defaultNow(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    model: text("model").notNull(),
  },
  (table) => [index("document_ai_owner_budget").on(table.userId, table.createdAt, table.id)],
);
