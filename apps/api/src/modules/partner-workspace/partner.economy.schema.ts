import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import {
  partnerLeads,
  partnerOrganizations,
  partnerCollaborations,
  partnerFinalPolicies,
} from "./partner.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });

export const partnerCommercialConditions = pgTable(
  "partner_commercial_conditions",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    professionalRevision: integer("professional_revision").notNull(),
    declaredName: text("declared_name").notNull(),
    declaredOrganization: text("declared_organization").notNull(),
    terms: jsonb("terms").notNull(),
    createdAt: instant("created_at")
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("partner_commercial_owner").on(t.ownerId, t.createdAt, t.id),
    check("partner_commercial_revision", sql`${t.professionalRevision}>0`),
  ],
);
export const partnerCommercialReviews = pgTable(
  "partner_commercial_reviews",
  {
    id: text("id").primaryKey(),
    conditionId: text("condition_id")
      .notNull()
      .references(() => partnerCommercialConditions.id),
    authorId: text("author_id")
      .notNull()
      .references(() => identityUsers.id),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    validationReference: text("validation_reference").notNull(),
    createdAt: instant("created_at")
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("partner_commercial_review").on(t.conditionId, t.createdAt, t.id),
    check("partner_commercial_decision", sql`${t.decision} in ('approve','reject','withdraw')`),
  ],
);
export const partnerMarketListings = pgTable(
  "partner_market_listings",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => identityUsers.id),
    conditionId: text("condition_id")
      .notNull()
      .references(() => partnerCommercialConditions.id),
    subjectKey: text("subject_key").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    profileRevision: integer("profile_revision").notNull(),
    adviceScopeRevision: integer("advice_scope_revision").notNull(),
    responsibleId: text("responsible_id")
      .notNull()
      .references(() => identityUsers.id),
    category: text("category").notNull(),
    publication: jsonb("publication").notNull(),
    expiresAt: instant("expires_at").notNull(),
    closedAt: instant("closed_at"),
    invalidatedAt: instant("invalidated_at"),
    createdAt: instant("created_at")
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("partner_market_feed").on(t.createdAt, t.id),
    index("partner_market_lead").on(t.leadId),
    uniqueIndex("partner_market_one_open")
      .on(t.leadId)
      .where(sql`${t.closedAt} is null and ${t.invalidatedAt} is null`),
    check("partner_market_expiry", sql`${t.expiresAt}>${t.createdAt}`),
  ],
);
export const partnerMarketApplications = pgTable(
  "partner_market_applications",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => partnerMarketListings.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    reason: text("reason").notNull(),
    withdrawnAt: instant("withdrawn_at"),
    createdAt: instant("created_at")
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    uniqueIndex("partner_market_application_unique").on(t.listingId, t.userId),
    index("partner_market_applicant").on(t.userId, t.createdAt, t.id),
  ],
);
export const partnerMarketReservations = pgTable(
  "partner_market_reservations",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => partnerMarketListings.id),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    publisherId: text("publisher_id")
      .notNull()
      .references(() => identityUsers.id),
    targetId: text("target_id")
      .notNull()
      .references(() => identityUsers.id),
    conditionId: text("condition_id")
      .notNull()
      .references(() => partnerCommercialConditions.id),
    targetOrganizationId: text("target_organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    targetRevision: integer("target_revision").notNull(),
    targetName: text("target_name").notNull(),
    targetOrganization: text("target_organization").notNull(),
    mission: jsonb("mission").notNull(),
    reason: text("reason").notNull(),
    expiresAt: instant("expires_at").notNull(),
    state: text("state").notNull().default("reserved"),
    response: text("response"),
    decidedAt: instant("decided_at"),
    collaborationId: text("collaboration_id").references(() => partnerCollaborations.id),
    createdAt: instant("created_at")
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    uniqueIndex("partner_market_one_reservation")
      .on(t.leadId)
      .where(sql`${t.state}='reserved'`),
    index("partner_market_target").on(t.targetId, t.createdAt, t.id),
    check(
      "partner_market_reservation_state",
      sql`${t.state} in ('reserved','accepted','declined','cancelled','expired','context_changed')`,
    ),
    check("partner_market_parties", sql`${t.publisherId}<>${t.targetId}`),
    check(
      "partner_market_reservation_expiry",
      sql`${t.expiresAt}>${t.createdAt} and ${t.expiresAt}<=${t.createdAt}+interval '24 hours'`,
    ),
  ],
);
export const partnerMarketMandates = pgTable(
  "partner_market_mandates",
  {
    id: text("id").primaryKey(),
    reservationId: text("reservation_id")
      .notNull()
      .references(() => partnerMarketReservations.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    profileRevision: integer("profile_revision").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason").notNull(),
    createdAt: instant("created_at")
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("partner_market_mandate").on(t.reservationId, t.createdAt, t.id),
    check("partner_market_mandate_decision", sql`${t.decision} in ('accept','decline','withdraw')`),
  ],
);

export const partnerEconomyCases = pgTable(
  "partner_economy_cases",
  {
    id: text("id").primaryKey(),
    agreementId: text("agreement_id")
      .notNull()
      .references(() => partnerMarketReservations.id),
    stream: text("stream").notNull(),
    finalPolicyId: text("final_policy_id").references(() => partnerFinalPolicies.id),
    companyId: text("company_id"),
    reference: text("reference").notNull(),
    scopeReference: text("scope_reference").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at")
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("partner_economy_agreement").on(t.agreementId, t.createdAt, t.id),
    uniqueIndex("partner_economy_fixed_unique")
      .on(t.agreementId)
      .where(sql`${t.stream}='lead_price'`),
    uniqueIndex("partner_economy_contract_unique")
      .on(t.agreementId, t.finalPolicyId)
      .where(sql`${t.stream}='contract_commission'`),
    check(
      "partner_economy_case_stream",
      sql`(${t.stream}='lead_price' and ${t.finalPolicyId} is null and ${t.companyId} is null) or (${t.stream}='contract_commission' and ${t.finalPolicyId} is not null and ${t.companyId} is not null)`,
    ),
  ],
);
export const partnerEconomyEntries = pgTable(
  "partner_economy_entries",
  {
    id: text("id").primaryKey(),
    caseId: text("case_id")
      .notNull()
      .references(() => partnerEconomyCases.id),
    revision: integer("revision").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => identityUsers.id),
    entry: jsonb("entry").notNull(),
    createdAt: instant("created_at")
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    uniqueIndex("partner_economy_entry_revision").on(t.caseId, t.revision),
    check("partner_economy_entry_positive", sql`${t.revision}>0`),
  ],
);
