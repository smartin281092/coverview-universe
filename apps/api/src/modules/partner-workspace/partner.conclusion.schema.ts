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
  foreignKey,
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { documents } from "../document-intelligence/index.js";
import { partnerLeads, partnerOffers } from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const partnerConclusionCorrespondences = pgTable(
  "partner_conclusion_correspondences",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    subjectKey: text("subject_key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    sharedAt: instant("shared_at").notNull().defaultNow(),
    withdrawnAt: instant("withdrawn_at"),
    invalidatedAt: instant("invalidated_at"),
  },
  (t) => [
    index("partner_correspondence_lead").on(t.leadId, t.sharedAt, t.id),
    uniqueIndex("partner_correspondence_current")
      .on(t.leadId, t.documentId)
      .where(sql`${t.withdrawnAt} is null and ${t.invalidatedAt} is null`),
    check("partner_correspondence_fingerprint", sql`${t.fingerprint} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const partnerConclusions = pgTable(
  "partner_conclusions",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    offerId: text("offer_id")
      .notNull()
      .references(() => partnerOffers.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    subjectKey: text("subject_key").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => identityUsers.id),
    context: text("context").notNull(),
    archive: jsonb("archive").notNull(),
    contentHash: text("content_hash").notNull(),
    validUntil: instant("valid_until").notNull(),
    withdrawnAt: instant("withdrawn_at"),
    invalidatedAt: instant("invalidated_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_conclusion_lead").on(t.leadId, t.createdAt, t.id),
    uniqueIndex("partner_conclusion_offer_open")
      .on(t.offerId)
      .where(sql`${t.withdrawnAt} is null and ${t.invalidatedAt} is null`),
    foreignKey({
      columns: [t.leadId, t.offerId],
      foreignColumns: [partnerOffers.leadId, partnerOffers.id],
      name: "partner_conclusion_exact_offer",
    }),
    check(
      "partner_conclusion_hashes",
      sql`${t.context} ~ '^[a-f0-9]{64}$' and ${t.contentHash} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);
export const partnerOfferSignatures = pgTable(
  "partner_offer_signatures",
  {
    id: text("id").primaryKey(),
    conclusionId: text("conclusion_id")
      .notNull()
      .references(() => partnerConclusions.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    input: jsonb("input").notNull(),
    integrityHash: text("integrity_hash").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_offer_signature_once").on(t.conclusionId),
    check("partner_offer_signature_hash", sql`${t.integrityHash} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const partnerConclusionActions = pgTable(
  "partner_conclusion_actions",
  {
    id: text("id").primaryKey(),
    conclusionId: text("conclusion_id")
      .notNull()
      .references(() => partnerConclusions.id),
    actorId: text("actor_id")
      .notNull()
      .references(() => identityUsers.id),
    revision: integer("revision").notNull(),
    input: jsonb("input").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_conclusion_action_revision").on(t.conclusionId, t.revision),
    check("partner_conclusion_revision", sql`${t.revision}>0`),
  ],
);
