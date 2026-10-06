import { sql } from "drizzle-orm";
import { pgTable, text, integer, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { documents } from "../document-intelligence/index.js";
import { partnerMembers, partnerOrganizations } from "./partner.schema.js";
import { partnerSurveys } from "./partner.quality.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
// A picture through the professional proof circuit (C8c): both columns set, or neither.
const picture = (document: string, checksum: string) =>
  sql`(${sql.identifier(document)} is null)=(${sql.identifier(checksum)} is null) and (${sql.identifier(checksum)} is null or ${sql.identifier(checksum)} ~ '^[a-f0-9]{64}$')`;

// Versions submitted by the person; published only after a CoverView review. Append-only.
export const partnerProfileVersions = pgTable(
  "partner_profile_versions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => partnerMembers.userId),
    organizationId: text("organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    revision: integer("revision").notNull(),
    professionalRevision: integer("professional_revision").notNull(),
    declaredName: text("declared_name").notNull(),
    declaredOrganization: text("declared_organization").notNull(),
    presentation: text("presentation").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    // Optional photo (C8c), kept from the previous version unless replaced or removed.
    photoDocumentId: text("photo_document_id").references(() => documents.id),
    photoChecksum: text("photo_checksum"),
  },
  (t) => [
    uniqueIndex("partner_profile_revision").on(t.userId, t.revision),
    check(
      "partner_profile_shape",
      sql`${t.revision}>0 and ${t.professionalRevision}>0 and length(trim(${t.presentation})) between 40 and 1200 and length(trim(${t.declaredName})) between 2 and 160 and length(trim(${t.declaredOrganization})) between 2 and 160`,
    ),
    check("partner_profile_photo", picture("photo_document_id", "photo_checksum")),
  ],
);
// Organisation profile (C8c): presentation and optional logo, submitted by a manager of the
// organisation and published only after a CoverView review by someone outside it. Append-only.
export const partnerOrganizationProfileVersions = pgTable(
  "partner_organization_profile_versions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    revision: integer("revision").notNull(),
    declaredName: text("declared_name").notNull(),
    presentation: text("presentation").notNull(),
    logoDocumentId: text("logo_document_id").references(() => documents.id),
    logoChecksum: text("logo_checksum"),
    submittedBy: text("submitted_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_organization_profile_revision").on(t.organizationId, t.revision),
    check(
      "partner_organization_profile_shape",
      sql`${t.revision}>0 and length(trim(${t.presentation})) between 40 and 1200 and length(trim(${t.declaredName})) between 2 and 160`,
    ),
    check("partner_organization_profile_logo", picture("logo_document_id", "logo_checksum")),
  ],
);
export const partnerOrganizationProfileReviews = pgTable(
  "partner_organization_profile_reviews",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id")
      .notNull()
      .references(() => partnerOrganizationProfileVersions.id),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    decidedBy: text("decided_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_organization_profile_review_version").on(t.versionId, t.createdAt),
    check(
      "partner_organization_profile_review_shape",
      sql`${t.decision} in ('published','rejected','withdrawn') and length(trim(${t.reason})) between 5 and 2000`,
    ),
  ],
);
export const partnerProfileReviews = pgTable(
  "partner_profile_reviews",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id")
      .notNull()
      .references(() => partnerProfileVersions.id),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    decidedBy: text("decided_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_profile_review_version").on(t.versionId, t.createdAt),
    check(
      "partner_profile_review_shape",
      sql`${t.decision} in ('published','rejected','withdrawn') and length(trim(${t.reason})) between 5 and 2000`,
    ),
  ],
);
// Responsible and referrer at the moment the survey was created, so a later transfer never
// moves a client's rating to someone who did not serve them.
export const partnerSurveyAttributions = pgTable(
  "partner_survey_attributions",
  {
    surveyId: text("survey_id")
      .primaryKey()
      .references(() => partnerSurveys.id),
    advisorId: text("advisor_id").references(() => identityUsers.id),
    referrerId: text("referrer_id").references(() => identityUsers.id),
    category: text("category").notNull(),
    backfilled: integer("backfilled").notNull().default(0),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_survey_attribution_advisor").on(t.advisorId, t.createdAt),
    check("partner_survey_attribution_backfill", sql`${t.backfilled} in (0,1)`),
  ],
);
export const partnerEvaluationContests = pgTable(
  "partner_evaluation_contests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    subjectKind: text("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    reason: text("reason").notNull(),
    decision: text("decision"),
    decisionReason: text("decision_reason"),
    decidedBy: text("decided_by").references(() => identityUsers.id),
    decidedAt: instant("decided_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_evaluation_contest_user").on(t.userId, t.createdAt, t.id),
    uniqueIndex("partner_evaluation_contest_open")
      .on(t.userId, t.subjectKind, t.subjectId)
      .where(sql`${t.decision} is null`),
    check(
      "partner_evaluation_contest_shape",
      sql`${t.subjectKind} in ('survey','quality_case') and length(trim(${t.reason})) between 10 and 2000 and ((${t.decision} is null and ${t.decisionReason} is null and ${t.decidedBy} is null and ${t.decidedAt} is null) or (${t.decision} in ('accepted','rejected') and length(trim(${t.decisionReason})) between 5 and 2000 and ${t.decidedBy} is not null and ${t.decidedBy}<>${t.userId} and ${t.decidedAt} is not null))`,
    ),
  ],
);
