import { sql } from "drizzle-orm";
import {
  swissCantonSchema,
  professionalLanguageSchema,
  leadCategorySchema,
} from "@coverview/contracts/partner";
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import { identityUsers } from "../identity/index.js";
import { managedProfiles } from "../profiles/index.js";
import { documents } from "../document-intelligence/index.js";
import { insuranceRequests } from "../insurance-requests/index.js";

const instant = (name: string) => timestamp(name, { withTimezone: true, precision: 3 });
export const partnerBookingProposals = pgTable(
  "partner_booking_proposals",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    advisorId: text("advisor_id")
      .notNull()
      .references(() => identityUsers.id),
    advisorName: text("advisor_name").notNull(),
    subjectKey: text("subject_key").notNull(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    fingerprint: text("fingerprint").notNull(),
    input: jsonb("input").notNull(),
    expiresAt: instant("expires_at").notNull(),
    state: text("state").notNull().default("offered"),
    invalidatedAt: instant("invalidated_at"),
    appointmentId: text("appointment_id").references(() => partnerAppointments.id),
    selectedSlot: integer("selected_slot"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_booking_history").on(t.leadId, t.createdAt, t.id),
    uniqueIndex("partner_booking_active")
      .on(t.leadId)
      .where(sql`${t.state}='offered' and ${t.invalidatedAt} is null`),
    uniqueIndex("partner_booking_appointment").on(t.appointmentId),
    check("partner_booking_state", sql`${t.state} in ('offered','booked','withdrawn')`),
    check(
      "partner_booking_selection",
      sql`(${t.state}='booked' and ${t.appointmentId} is not null and ${t.selectedSlot} is not null and ${t.selectedSlot} between 0 and 4) or (${t.state}<>'booked' and ${t.appointmentId} is null and ${t.selectedSlot} is null)`,
    ),
    check("partner_booking_fingerprint", sql`${t.fingerprint} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const partnerDistributionReviews = pgTable(
  "partner_distribution_reviews",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    offerId: text("offer_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    organizationId: text("organization_id").references(() => partnerOrganizations.id),
    companyId: text("company_id").notNull(),
    subjectKey: text("subject_key").notNull(),
    revision: integer("revision").notNull(),
    scopeFingerprint: text("scope_fingerprint").notNull(),
    scope: jsonb("scope").notNull(),
    clausesRevision: integer("clauses_revision").notNull(),
    bindingRevision: integer("binding_revision").notNull(),
    conventionReference: jsonb("convention_reference"),
    action: text("action").notNull(),
    review: jsonb("review"),
    reason: text("reason").notNull(),
    validUntil: instant("valid_until"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.leadId, t.offerId],
      foreignColumns: [partnerOffers.leadId, partnerOffers.id],
    }),
    uniqueIndex("partner_distribution_reviews_revision").on(
      t.userId,
      t.offerId,
      t.companyId,
      t.revision,
    ),
    index("partner_distribution_reviews_subject").on(
      t.userId,
      t.offerId,
      t.companyId,
      t.subjectKey,
      t.revision,
    ),
    check(
      "partner_distribution_reviews_revision_positive",
      sql`${t.revision}>0 and ${t.bindingRevision}>=0 and ${t.clausesRevision}>=0`,
    ),
    check(
      "partner_distribution_reviews_fingerprint",
      sql`${t.scopeFingerprint} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "partner_distribution_reviews_reason",
      sql`length(trim(${t.reason})) between 10 and 1000`,
    ),
    check("partner_distribution_reviews_scope", sql`jsonb_typeof(${t.scope})='object'`),
    check(
      "partner_distribution_reviews_company",
      sql`${t.companyId} in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm')`,
    ),
    check(
      "partner_distribution_reviews_values",
      sql`coalesce(
      (${t.action}='record' and ${t.validUntil}>${t.createdAt} and ${t.bindingRevision}>0 and ${t.clausesRevision}>0
       and jsonb_typeof(${t.conventionReference})='object' and jsonb_typeof(${t.review})='object'
       and ${t.review}->>'position' in ('undetermined','needs_information','cannot_proceed')
       and jsonb_typeof(${t.review}->'aspects')='array' and jsonb_array_length(${t.review}->'aspects') between 1 and 6
       and (${t.review}->'aspects') <@ '["parties","distribution","product","limitations","exclusions","dates"]'::jsonb
       and length(trim(${t.review}->>'examinedScope')) between 10 and 500
       and length(trim(${t.review}->>'limitations')) between 10 and 1000
       and length(trim(${t.review}->>'nextStep')) between 10 and 1000)
      or (${t.action}='withdraw' and ${t.review} is null and ${t.validUntil} is null),false)`,
    ),
  ],
);
export const partnerSolutionClauses = pgTable(
  "partner_solution_clauses",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    offerId: text("offer_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    organizationId: text("organization_id").references(() => partnerOrganizations.id),
    companyId: text("company_id").notNull(),
    subjectKey: text("subject_key").notNull(),
    revision: integer("revision").notNull(),
    scopeFingerprint: text("scope_fingerprint").notNull(),
    scope: jsonb("scope").notNull(),
    bindingRevision: integer("binding_revision").notNull(),
    conventionReference: jsonb("convention_reference"),
    action: text("action").notNull(),
    clauses: jsonb("clauses"),
    reason: text("reason").notNull(),
    validUntil: instant("valid_until"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.leadId, t.offerId],
      foreignColumns: [partnerOffers.leadId, partnerOffers.id],
    }),
    uniqueIndex("partner_solution_clauses_revision").on(
      t.userId,
      t.offerId,
      t.companyId,
      t.revision,
    ),
    index("partner_solution_clauses_subject").on(
      t.userId,
      t.offerId,
      t.companyId,
      t.subjectKey,
      t.revision,
    ),
    check(
      "partner_solution_clauses_revision_positive",
      sql`${t.revision}>0 and ${t.bindingRevision}>=0`,
    ),
    check("partner_solution_clauses_fingerprint", sql`${t.scopeFingerprint} ~ '^[a-f0-9]{64}$'`),
    check("partner_solution_clauses_reason", sql`length(trim(${t.reason})) between 10 and 1000`),
    check("partner_solution_clauses_scope", sql`jsonb_typeof(${t.scope})='object'`),
    check(
      "partner_solution_clauses_company",
      sql`${t.companyId} in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm')`,
    ),
    check(
      "partner_solution_clauses_values",
      sql`coalesce(
      (${t.action}='record' and ${t.validUntil}>${t.createdAt} and ${t.bindingRevision}>0
       and jsonb_typeof(${t.conventionReference})='object' and jsonb_typeof(${t.clauses})='object'
       and ${t.clauses} ?& array['parties','distribution','product','limitations','exclusions','dates']
       and jsonb_strip_nulls(${t.clauses}) <> '{}'::jsonb)
      or (${t.action}='withdraw' and ${t.clauses} is null and ${t.validUntil} is null),false)`,
    ),
  ],
);
export const partnerSolutionBindings = pgTable(
  "partner_solution_bindings",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    offerId: text("offer_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    organizationId: text("organization_id").references(() => partnerOrganizations.id),
    subjectKey: text("subject_key").notNull(),
    revision: integer("revision").notNull(),
    scopeFingerprint: text("scope_fingerprint").notNull(),
    scope: jsonb("scope").notNull(),
    sourceReference: jsonb("source_reference"),
    action: text("action").notNull(),
    companyId: text("company_id"),
    mentions: jsonb("mentions"),
    reason: text("reason").notNull(),
    validUntil: instant("valid_until"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.leadId, t.offerId],
      foreignColumns: [partnerOffers.leadId, partnerOffers.id],
    }),
    uniqueIndex("partner_solution_binding_revision").on(t.userId, t.offerId, t.revision),
    index("partner_solution_binding_subject").on(t.userId, t.offerId, t.subjectKey, t.revision),
    check("partner_solution_binding_revision_positive", sql`${t.revision}>0`),
    check("partner_solution_binding_fingerprint", sql`${t.scopeFingerprint} ~ '^[a-f0-9]{64}$'`),
    check("partner_solution_binding_reason", sql`length(trim(${t.reason})) between 10 and 1000`),
    check("partner_solution_binding_scope", sql`jsonb_typeof(${t.scope})='object'`),
    check(
      "partner_solution_binding_company",
      sql`${t.companyId} is null or ${t.companyId} in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm')`,
    ),
    check(
      "partner_solution_binding_values",
      sql`coalesce(
      (${t.action}='record' and ${t.validUntil}>${t.createdAt}
       and jsonb_typeof(${t.sourceReference})='object' and jsonb_typeof(${t.mentions})='object'
       and ${t.mentions} ?& array['company','legalParty','product','variant','productVersion']
       and (${t.companyId} is null or jsonb_typeof(${t.mentions}->'company')='object'))
      or (${t.action}='withdraw' and ${t.companyId} is null and ${t.mentions} is null and ${t.validUntil} is null),false)`,
    ),
  ],
);
export const partnerNeedCapacityDecisions = pgTable(
  "partner_need_capacity_decisions",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    organizationId: text("organization_id").references(() => partnerOrganizations.id),
    subjectKey: text("subject_key").notNull(),
    revision: integer("revision").notNull(),
    scopeFingerprint: text("scope_fingerprint").notNull(),
    scope: jsonb("scope").notNull(),
    basis: jsonb("basis").notNull(),
    action: text("action").notNull(),
    position: text("position"),
    reason: text("reason").notNull(),
    validUntil: instant("valid_until"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_need_capacity_revision").on(t.userId, t.leadId, t.revision),
    index("partner_need_capacity_subject").on(t.userId, t.leadId, t.subjectKey, t.revision),
    check("partner_need_capacity_revision_positive", sql`${t.revision}>0`),
    check("partner_need_capacity_fingerprint", sql`${t.scopeFingerprint} ~ '^[a-f0-9]{64}$'`),
    check("partner_need_capacity_reason", sql`length(trim(${t.reason})) between 10 and 1000`),
    check(
      "partner_need_capacity_json",
      sql`jsonb_typeof(${t.scope})='object' and jsonb_typeof(${t.basis})='object'`,
    ),
    check(
      "partner_need_capacity_values",
      sql`coalesce((${t.action}='decide' and ${t.position} in ('capacity_confirmed','capacity_insufficient','clarification_needed') and ${t.validUntil}>${t.createdAt}) or (${t.action}='withdraw' and ${t.position} is null and ${t.validUntil} is null),false)`,
    ),
  ],
);
export const partnerNeedConflictReviews = pgTable(
  "partner_need_conflict_reviews",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    organizationId: text("organization_id").references(() => partnerOrganizations.id),
    subjectKey: text("subject_key").notNull(),
    revision: integer("revision").notNull(),
    scopeFingerprint: text("scope_fingerprint").notNull(),
    scope: jsonb("scope").notNull(),
    basis: jsonb("basis").notNull(),
    action: text("action").notNull(),
    position: text("position"),
    reviewedScope: text("reviewed_scope"),
    reason: text("reason").notNull(),
    validUntil: instant("valid_until"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_need_conflict_revision").on(t.userId, t.leadId, t.revision),
    index("partner_need_conflict_subject").on(t.userId, t.leadId, t.subjectKey, t.revision),
    check("partner_need_conflict_revision_positive", sql`${t.revision}>0`),
    check("partner_need_conflict_fingerprint", sql`${t.scopeFingerprint} ~ '^[a-f0-9]{64}$'`),
    check("partner_need_conflict_reason", sql`length(trim(${t.reason})) between 10 and 1000`),
    check(
      "partner_need_conflict_json",
      sql`jsonb_typeof(${t.scope})='object' and jsonb_typeof(${t.basis})='object'`,
    ),
    check(
      "partner_need_conflict_values",
      sql`coalesce((${t.action}='decide' and ${t.position} in ('none_declared','blocking_conflict_declared','clarification_needed') and length(trim(${t.reviewedScope})) between 10 and 500 and ${t.validUntil}>${t.createdAt}) or (${t.action}='withdraw' and ${t.position} is null and ${t.validUntil} is null and ${t.reviewedScope} is null),false)`,
    ),
  ],
);
export const partnerNeedExpertiseReviews = pgTable(
  "partner_need_expertise_reviews",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    organizationId: text("organization_id").references(() => partnerOrganizations.id),
    subjectKey: text("subject_key").notNull(),
    revision: integer("revision").notNull(),
    scopeFingerprint: text("scope_fingerprint").notNull(),
    scope: jsonb("scope").notNull(),
    basis: jsonb("basis").notNull(),
    action: text("action").notNull(),
    position: text("position"),
    reviewedScope: text("reviewed_scope"),
    limitations: text("limitations"),
    nextStep: text("next_step"),
    reason: text("reason").notNull(),
    validUntil: instant("valid_until"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_need_expertise_revision").on(t.userId, t.leadId, t.revision),
    index("partner_need_expertise_subject").on(t.userId, t.leadId, t.subjectKey, t.revision),
    check("partner_need_expertise_revision_positive", sql`${t.revision}>0`),
    check("partner_need_expertise_fingerprint", sql`${t.scopeFingerprint} ~ '^[a-f0-9]{64}$'`),
    check("partner_need_expertise_reason", sql`length(trim(${t.reason})) between 10 and 1000`),
    check(
      "partner_need_expertise_json",
      sql`jsonb_typeof(${t.scope})='object' and jsonb_typeof(${t.basis})='object'`,
    ),
    check(
      "partner_need_expertise_values",
      sql`coalesce((${t.action}='decide' and ${t.position} in ('expertise_confirmed_within_scope','specialist_required','clarification_needed') and length(trim(${t.reviewedScope})) between 10 and 500 and length(trim(${t.limitations})) between 10 and 1000 and length(trim(${t.nextStep})) between 10 and 1000 and ${t.validUntil}>${t.createdAt}) or (${t.action}='withdraw' and ${t.position} is null and ${t.validUntil} is null and ${t.reviewedScope} is null and ${t.limitations} is null and ${t.nextStep} is null),false)`,
    ),
  ],
);
export const partnerAdvicePreferences = pgTable(
  "partner_advice_preferences",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    subjectId: text("subject_id").notNull(),
    selfUserId: text("self_user_id").references(() => identityUsers.id),
    profileId: text("profile_id").references(() => managedProfiles.id),
    profileRevision: integer("profile_revision").notNull(),
    scopeRevision: integer("scope_revision").notNull(),
    scope: jsonb("scope").notNull(),
    revision: integer("revision").notNull(),
    languageCode: text("language_code"),
    mode: text("mode"),
    canton: text("canton"),
    confirmedBy: text("confirmed_by")
      .notNull()
      .references(() => identityUsers.id),
    confirmationVersion: integer("confirmation_version").notNull().default(1),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_advice_revision").on(t.leadId, t.revision),
    index("partner_advice_subject_history").on(t.leadId, t.subjectId, t.revision),
    check(
      "partner_advice_subject",
      sql`(${t.profileId} is not null and ${t.selfUserId} is null and ${t.subjectId}='profile:'||${t.profileId}) or (${t.profileId} is null and ${t.selfUserId} is not null and ${t.subjectId}='self:'||${t.selfUserId} and ${t.confirmedBy}=${t.selfUserId} and ${t.profileRevision}=0)`,
    ),
    check(
      "partner_advice_bounds",
      sql`${t.revision}>0 and ${t.scopeRevision}>0 and ${t.profileRevision}>=0 and ${t.confirmationVersion}=1`,
    ),
    check(
      "partner_advice_language",
      sql`${t.languageCode} is null or ${t.languageCode} in (${sql.raw(professionalLanguageSchema.options.map((code) => `'${code}'`).join(", "))})`,
    ),
    check(
      "partner_advice_mode",
      sql`${t.mode} is null or ${t.mode} in ('phone','video','office','home')`,
    ),
    check(
      "partner_advice_canton",
      sql`${t.canton} is null or (${t.mode} is not null and ${t.mode} in ('office','home') and ${t.canton} in (${sql.raw(swissCantonSchema.options.map((code) => `'${code}'`).join(", "))}))`,
    ),
  ],
);
export const partnerCapacityDeclarations = pgTable(
  "partner_capacity_declarations",
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
    categories: text("categories").array().notNull(),
    action: text("action").notNull(),
    position: text("position"),
    validUntil: instant("valid_until"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_capacity_declarations_revision").on(t.userId, t.revision),
    check(
      "partner_capacity_declarations_scope",
      sql`${t.revision}>0 and ${t.professionalRevision}>0 and length(trim(${t.declaredName})) between 2 and 160 and length(trim(${t.declaredOrganization})) between 2 and 160`,
    ),
    check(
      "partner_capacity_declarations_values",
      sql`coalesce((${t.action}='declare' and ${t.position} in ('open','case_by_case','unavailable') and ${t.validUntil}>${t.createdAt}) or (${t.action}='withdraw' and ${t.position} is null and ${t.validUntil} is null),false)`,
    ),
    check(
      "partner_capacity_declarations_categories",
      sql`cardinality(${t.categories}) between 1 and 7 and array_position(${t.categories},null) is null and ${t.categories}<@array[${sql.raw(leadCategorySchema.options.map((code) => `'${code}'`).join(", "))}]::text[]`,
    ),
  ],
);
export const partnerSharedModes = pgTable(
  "partner_shared_modes",
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
    categories: text("categories").array().notNull(),
    action: text("action").notNull(),
    modes: text("modes").array().notNull(),
    audience: text("audience").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_shared_modes_revision").on(t.userId, t.revision),
    check(
      "partner_shared_modes_scope",
      sql`${t.revision}>0 and ${t.professionalRevision}>0 and length(trim(${t.declaredName})) between 2 and 160 and length(trim(${t.declaredOrganization})) between 2 and 160`,
    ),
    check(
      "partner_shared_modes_values",
      sql`cardinality(${t.modes})<=4 and array_position(${t.modes},null) is null and ${t.modes}<@array['phone','video','office','home']::text[] and ((${t.action}='publish' and cardinality(${t.modes})>0) or (${t.action}='withdraw' and cardinality(${t.modes})=0))`,
    ),
    check("partner_shared_modes_audience", sql`${t.audience}='confirmed-referent-leads-v1'`),
    check(
      "partner_shared_modes_categories",
      sql`cardinality(${t.categories}) between 1 and 7 and array_position(${t.categories},null) is null and ${t.categories}<@array[${sql.raw(leadCategorySchema.options.map((code) => `'${code}'`).join(", "))}]::text[]`,
    ),
  ],
);
export const partnerAvailabilityDeclarations = pgTable(
  "partner_availability_declarations",
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
    modes: text("modes").array().notNull(),
    timezone: text("timezone").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_availability_revision").on(t.userId, t.revision),
    check(
      "partner_availability_scope",
      sql`${t.revision}>0 and ${t.professionalRevision}>0 and length(trim(${t.declaredName})) between 2 and 160 and length(trim(${t.declaredOrganization})) between 2 and 160`,
    ),
    check(
      "partner_availability_modes",
      sql`cardinality(${t.modes})<=4 and array_position(${t.modes},null) is null and ${t.modes}<@array['phone','video','office','home']::text[]`,
    ),
    check("partner_availability_timezone", sql`${t.timezone}='Europe/Zurich'`),
  ],
);
export const partnerAvailabilityPeriods = pgTable(
  "partner_availability_periods",
  {
    declarationId: text("declaration_id")
      .notNull()
      .references(() => partnerAvailabilityDeclarations.id),
    position: integer("position").notNull(),
    kind: text("kind").notNull(),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
  },
  (t) => [
    uniqueIndex("partner_availability_period_position").on(t.declarationId, t.position),
    check(
      "partner_availability_period_bounds",
      sql`${t.position}>=0 and ${t.position}<60 and ${t.endsAt}>${t.startsAt} and ${t.endsAt}-${t.startsAt}<=interval '366 days'`,
    ),
    check("partner_availability_period_kind", sql`${t.kind} in ('available','absent')`),
  ],
);
export const partnerPracticeDeclarations = pgTable(
  "partner_practice_declarations",
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
    languageCodes: text("language_codes").array().notNull(),
    cantons: text("cantons").array().notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_practice_revision").on(t.userId, t.revision),
    check(
      "partner_practice_scope",
      sql`${t.revision}>0 and ${t.professionalRevision}>0 and length(trim(${t.declaredName})) between 2 and 160 and length(trim(${t.declaredOrganization})) between 2 and 160`,
    ),
    check(
      "partner_practice_languages",
      sql`cardinality(${t.languageCodes})<=20 and array_position(${t.languageCodes},null) is null and ${t.languageCodes}<@array[${sql.raw(professionalLanguageSchema.options.map((code) => `'${code}'`).join(", "))}]::text[]`,
    ),
    check(
      "partner_practice_cantons",
      sql`cardinality(${t.cantons})<=26 and array_position(${t.cantons},null) is null and ${t.cantons}<@array[${sql.raw(swissCantonSchema.options.map((code) => `'${code}'`).join(", "))}]::text[]`,
    ),
  ],
);
export const partnerCompetenceDeclarations = pgTable(
  "partner_competence_declarations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    category: text("category").notNull(),
    professionalRevision: integer("professional_revision"),
    declaredName: text("declared_name").notNull().default(""),
    declaredOrganization: text("declared_organization").notNull().default(""),
    declaration: text("declaration").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    checksum: text("checksum").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_competence_document").on(t.documentId),
    check("partner_competence_professional_revision", sql`${t.professionalRevision}>0`),
    uniqueIndex("partner_competence_subject").on(t.id, t.userId, t.category),
    check(
      "partner_competence_declaration_bounds",
      sql`${t.category} in ('health','vehicle','pension','household','legal','business','other') and length(trim(${t.declaration})) between 1 and 2000 and ${t.checksum} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);
export const partnerCompetenceDecisions = pgTable(
  "partner_competence_decisions",
  {
    id: text("id").primaryKey(),
    declarationId: text("declaration_id").notNull(),
    userId: text("user_id").notNull(),
    category: text("category").notNull(),
    revision: integer("revision").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason").notNull().default(""),
    scope: text("scope").notNull().default(""),
    coverage: text("coverage"),
    validUntil: instant("valid_until"),
    documentRevision: integer("document_revision").notNull(),
    decidedBy: text("decided_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "partner_competence_decision_subject",
      columns: [t.declarationId, t.userId, t.category],
      foreignColumns: [
        partnerCompetenceDeclarations.id,
        partnerCompetenceDeclarations.userId,
        partnerCompetenceDeclarations.category,
      ],
    }),
    uniqueIndex("partner_competence_revision").on(t.userId, t.category, t.revision),
    check(
      "partner_competence_decision_bounds",
      sql`${t.revision}>0 and ${t.documentRevision}>=0 and ${t.decision} in ('submitted','reviewed','needs_information','rejected','withdrawn') and length(${t.reason})<=2000 and length(${t.scope})<=2000 and (${t.decision}='submitted' or length(trim(${t.reason}))>0)`,
    ),
    check(
      "partner_competence_review_scope",
      sql`case when ${t.decision}='reviewed' then (${t.decidedBy}<>${t.userId} and length(trim(${t.scope}))>0 and ${t.coverage} is not null and ${t.coverage} in ('category','limited') and ${t.validUntil} is not null and ${t.validUntil}>${t.createdAt}) else (${t.coverage} is null and ${t.validUntil} is null and ${t.scope}='') end`,
    ),
  ],
);
export const partnerConventionDeclarations = pgTable(
  "partner_convention_declarations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    category: text("category").notNull(),
    professionalRevision: integer("professional_revision"),
    companyId: text("company_id").notNull(),
    declaredName: text("declared_name").notNull().default(""),
    declaredOrganization: text("declared_organization").notNull().default(""),
    declaration: text("declaration").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    checksum: text("checksum").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_convention_document").on(t.documentId),
    check("partner_convention_professional_revision", sql`${t.professionalRevision}>0`),
    uniqueIndex("partner_convention_subject").on(t.id, t.userId, t.category, t.companyId),
    check(
      "partner_convention_declaration_bounds",
      sql`${t.companyId} in ('allianz','assura','automate','axa','baloise','css','generali','groupe-mutuel','helsana','liechtenstein-life','tsm') and ${t.category} in ('health','vehicle','pension','household','legal','business','other') and length(trim(${t.declaration})) between 1 and 2000 and ${t.checksum} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);
export const partnerConventionDecisions = pgTable(
  "partner_convention_decisions",
  {
    id: text("id").primaryKey(),
    declarationId: text("declaration_id").notNull(),
    userId: text("user_id").notNull(),
    category: text("category").notNull(),
    companyId: text("company_id").notNull(),
    revision: integer("revision").notNull(),
    decision: text("decision").notNull(),
    reason: text("reason").notNull().default(""),
    scope: text("scope").notNull().default(""),
    coverage: text("coverage"),
    validUntil: instant("valid_until"),
    validFrom: instant("valid_from"),
    memberCovered: boolean("member_covered").notNull().default(false),
    documentRevision: integer("document_revision").notNull(),
    decidedBy: text("decided_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "partner_convention_decision_subject",
      columns: [t.declarationId, t.userId, t.category, t.companyId],
      foreignColumns: [
        partnerConventionDeclarations.id,
        partnerConventionDeclarations.userId,
        partnerConventionDeclarations.category,
        partnerConventionDeclarations.companyId,
      ],
    }),
    uniqueIndex("partner_convention_revision").on(t.userId, t.category, t.companyId, t.revision),
    check(
      "partner_convention_decision_bounds",
      sql`${t.revision}>0 and ${t.documentRevision}>=0 and ${t.decision} in ('submitted','reviewed','needs_information','rejected','withdrawn') and length(${t.reason})<=2000 and length(${t.scope})<=2000 and (${t.decision}='submitted' or length(trim(${t.reason}))>0)`,
    ),
    check(
      "partner_convention_review_scope",
      sql`case when ${t.decision}='reviewed' then (${t.decidedBy}<>${t.userId} and length(trim(${t.scope}))>0 and ${t.coverage} is not null and ${t.coverage} in ('category','limited') and ${t.memberCovered}=true and ${t.validFrom} is not null and ${t.validUntil} is not null and ${t.validUntil}>${t.validFrom} and ${t.validUntil}>${t.createdAt}) else (${t.coverage} is null and ${t.memberCovered}=false and ${t.validFrom} is null and ${t.validUntil} is null and ${t.scope}='') end`,
    ),
  ],
);
export const partnerReferentSelections = pgTable(
  "partner_referent_selections",
  {
    id: text("id").primaryKey(),
    subjectId: text("subject_id").notNull(),
    selfUserId: text("self_user_id").references(() => identityUsers.id),
    profileId: text("profile_id").references(() => managedProfiles.id),
    subjectRevision: integer("subject_revision").notNull(),
    category: text("category").notNull(),
    revision: integer("revision").notNull(),
    advisorId: text("advisor_id").references(() => identityUsers.id),
    confirmedBy: text("confirmed_by")
      .notNull()
      .references(() => identityUsers.id),
    confirmationVersion: integer("confirmation_version").notNull().default(1),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_referent_revision").on(t.subjectId, t.category, t.revision),
    check(
      "partner_referent_subject",
      sql`(${t.profileId} is not null and ${t.selfUserId} is null and ${t.subjectId}='profile:'||${t.profileId}) or (${t.profileId} is null and ${t.selfUserId} is not null and ${t.subjectId}='self:'||${t.selfUserId} and ${t.confirmedBy}=${t.selfUserId} and ${t.subjectRevision}=0)`,
    ),
    check(
      "partner_referent_bounds",
      sql`${t.revision}>0 and ${t.subjectRevision}>=0 and ${t.confirmationVersion}=1 and ${t.category} in ('health','vehicle','pension','household','legal','business','other')`,
    ),
  ],
);
export const partnerOfferImports = pgTable(
  "partner_offer_imports",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    checksum: text("checksum").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => identityUsers.id),
    offerId: text("offer_id").references(() => partnerOffers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_import_content").on(t.leadId, t.checksum),
    uniqueIndex("partner_import_document").on(t.documentId),
    index("partner_import_history").on(t.leadId, t.createdAt, t.id),
    check("partner_import_checksum", sql`${t.checksum} ~ '^[a-f0-9]{64}$'`),
  ],
);
export const partnerContractReferences = pgTable(
  "partner_contract_references",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    fingerprint: text("fingerprint").notNull(),
    confirmedBy: text("confirmed_by")
      .notNull()
      .references(() => identityUsers.id),
    consentVersion: integer("consent_version").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("partner_contract_active")
      .on(table.leadId)
      .where(sql`${table.active}`),
    check(
      "partner_contract_fingerprint",
      sql`${table.fingerprint} ~ '^[a-f0-9]{64}$' and ${table.consentVersion}=1`,
    ),
  ],
);
export const partnerContractReviews = pgTable(
  "partner_contract_reviews",
  {
    id: text("id").primaryKey(),
    referenceId: text("reference_id")
      .notNull()
      .references(() => partnerContractReferences.id),
    version: integer("version").notNull(),
    premiumVerified: boolean("premium_verified").notNull(),
    features: jsonb("features").notNull(),
    reviewedBy: text("reviewed_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("partner_contract_review_version").on(table.referenceId, table.version),
    check(
      "partner_contract_review_bounds",
      sql`${table.version}>0 and jsonb_typeof(${table.features})='array' and jsonb_array_length(${table.features})<=80`,
    ),
  ],
);
export const partnerContinuityPolicies = pgTable(
  "partner_continuity_policies",
  {
    revision: integer("revision").primaryKey(),
    policy: jsonb("policy").notNull(),
    changedBy: text("changed_by")
      .notNull()
      .references(() => identityUsers.id),
    reason: text("reason").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    check("partner_continuity_policy_revision", sql`${t.revision} > 0`),
    check(
      "partner_continuity_policy_shape",
      sql`coalesce(jsonb_typeof(${t.policy}) = 'object' and jsonb_typeof(${t.policy}->'acceptanceHours') = 'number' and (${t.policy}->>'acceptanceHours')::int between 1 and 24 and jsonb_typeof(${t.policy}->'calendar') = 'object', false)`,
    ),
  ],
);
export const partnerOrganizations = pgTable(
  "partner_organizations",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    state: text("state").notNull().default("submitted"),
    reviewedBy: text("reviewed_by").references(() => identityUsers.id),
    reviewReason: text("review_reason"),
    reviewedAt: instant("reviewed_at"),
  },
  (t) => [
    check(
      "partner_org_state",
      sql`${t.state} in ('draft','submitted','needs_information','approved','rejected','suspended','closed')`,
    ),
  ],
);
export const partnerMembers = pgTable(
  "partner_members",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => identityUsers.id),
    organizationId: text("organization_id")
      .notNull()
      .references(() => partnerOrganizations.id),
    state: text("state").notNull().default("submitted"),
    application: jsonb("application").notNull(),
    roles: jsonb("roles").$type<string[]>().notNull().default([]),
    revision: integer("revision").notNull().default(0),
    professionalRevision: integer("professional_revision").notNull().default(1),
    reviewedBy: text("reviewed_by").references(() => identityUsers.id),
    reviewReason: text("review_reason"),
    reviewedAt: instant("reviewed_at"),
    reviewDueAt: instant("review_due_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_members_org").on(t.organizationId, t.state),
    check("partner_member_professional_revision", sql`${t.professionalRevision}>0`),
    check(
      "partner_member_state",
      sql`${t.state} in ('draft','submitted','needs_information','approved','rejected','suspended','closed')`,
    ),
    check("partner_member_revision", sql`${t.revision} >= 0`),
  ],
);
export const partnerLeads = pgTable(
  "partner_leads",
  {
    id: text("id").primaryKey(),
    creatorId: text("creator_id")
      .notNull()
      .references(() => identityUsers.id),
    responsibleId: text("responsible_id").references(() => identityUsers.id),
    clientUserId: text("client_user_id").references(() => identityUsers.id),
    clientProfileId: text("client_profile_id").references(() => managedProfiles.id),
    title: text("title").notNull(),
    category: text("category").notNull(),
    object: text("object").notNull(),
    clientName: text("client_name").notNull(),
    details: jsonb("details").notNull(),
    stage: text("stage").notNull().default("new"),
    assignment: text("assignment").notNull().default("unassigned"),
    priority: text("priority").notNull(),
    nextAction: text("next_action").notNull(),
    dueAt: instant("due_at"),
    waiting: jsonb("waiting"),
    result: text("result"),
    reason: text("reason"),
    estimatedCommissionMinor: integer("estimated_commission_minor"),
    revision: integer("revision").notNull().default(0),
    adviceScopeRevision: integer("advice_scope_revision").notNull().default(1),
    notifiedAt: instant("notified_at"),
    firstActionDueAt: instant("first_action_due_at"),
    acceptanceDueAt: instant("acceptance_due_at"),
    continuityPolicyRevision: integer("continuity_policy_revision").references(
      () => partnerContinuityPolicies.revision,
    ),
    notificationCycle: integer("notification_cycle").notNull().default(0),
    continuityCheckedAt: instant("continuity_checked_at"),
    firstUsefulAt: instant("first_useful_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
    stageChangedAt: instant("stage_changed_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_leads_assignee").on(t.responsibleId, t.createdAt, t.id),
    index("partner_leads_creator").on(t.creatorId, t.createdAt, t.id),
    index("partner_leads_client").on(t.clientUserId, t.clientProfileId),
    index("partner_leads_profile").on(t.clientProfileId),
    check("partner_lead_advice_scope", sql`${t.adviceScopeRevision}>0`),
    index("partner_leads_continuity")
      .on(t.continuityCheckedAt, t.id)
      .where(sql`${t.stage} not in ('draft','completed')`),
    check(
      "partner_lead_bounds",
      sql`${t.revision} >= 0 and (${t.estimatedCommissionMinor} is null or ${t.estimatedCommissionMinor} >= 0)`,
    ),
    check(
      "partner_lead_deadlines",
      sql`(${t.acceptanceDueAt} is null and ${t.firstActionDueAt} is null) or (${t.acceptanceDueAt} is not null and ${t.firstActionDueAt} is not null and ${t.acceptanceDueAt} <= ${t.firstActionDueAt})`,
    ),
    check(
      "partner_lead_stage",
      sql`${t.stage} in ('draft','new','qualifying','ready_to_assign','to_contact','contacted','appointment_needed','appointment_scheduled','appointment_completed','analysis','offer_requested','offer_received','offer_presented','client_decision','signing','signed','awaiting_insurer','contract_issued','completed')`,
    ),
    check(
      "partner_lead_assignment",
      sql`${t.assignment} in ('unassigned','proposed','accepted','marketplace','reassign','coverview')`,
    ),
    check("partner_lead_priority", sql`${t.priority} in ('normal','high','urgent')`),
    check(
      "partner_lead_closure",
      sql`(${t.stage} = 'completed') = (${t.result} is not null and ${t.reason} is not null)`,
    ),
    check(
      "partner_lead_profile",
      sql`${t.clientProfileId} is null or ${t.clientUserId} is not null`,
    ),
  ],
);
export const partnerInsuranceSources = pgTable(
  "partner_insurance_sources",
  {
    leadId: text("lead_id")
      .primaryKey()
      .references(() => partnerLeads.id),
    requestId: text("request_id")
      .notNull()
      .references(() => insuranceRequests.id),
    personId: text("person_id").notNull(),
    profileId: text("profile_id")
      .notNull()
      .references(() => managedProfiles.id),
    consentUserId: text("consent_user_id")
      .notNull()
      .references(() => identityUsers.id),
    consentVersion: text("consent_version").notNull(),
    requestRevision: integer("request_revision").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_insurance_source_person").on(t.requestId, t.personId),
    check(
      "partner_insurance_source_consent",
      sql`${t.consentVersion} = 'insurance-partner-v1' and ${t.requestRevision} >= 0`,
    ),
    check(
      "partner_insurance_source_snapshot",
      sql`coalesce(${t.snapshot}->>'id'=${t.personId} and ${t.snapshot}->>'profileId'=${t.profileId}, false)`,
    ),
  ],
);
export const partnerCollaborations = pgTable(
  "partner_collaborations",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    proposerId: text("proposer_id")
      .notNull()
      .references(() => identityUsers.id),
    targetId: text("target_id")
      .notNull()
      .references(() => identityUsers.id),
    previousResponsibleId: text("previous_responsible_id")
      .notNull()
      .references(() => identityUsers.id),
    category: text("category").notNull(),
    terms: jsonb("terms").notNull(),
    state: text("state").notNull().default("proposed"),
    revision: integer("revision").notNull().default(0),
    response: text("response").notNull().default(""),
    createdAt: instant("created_at").notNull().defaultNow(),
    decidedAt: instant("decided_at"),
    endedAt: instant("ended_at"),
  },
  (t) => [
    index("partner_collaboration_inbox").on(t.targetId, t.state, t.createdAt),
    index("partner_collaboration_lead").on(t.leadId, t.createdAt),
    uniqueIndex("partner_collaboration_pending")
      .on(t.leadId, t.targetId)
      .where(sql`${t.state} = 'proposed'`),
    check(
      "partner_collaboration_state",
      sql`${t.state} in ('proposed','accepted','declined','cancelled','ended') and ${t.revision} >= 0`,
    ),
    check(
      "partner_collaboration_people",
      sql`${t.targetId} <> ${t.previousResponsibleId} and ${t.targetId} <> ${t.proposerId}`,
    ),
    check(
      "partner_collaboration_terms",
      sql`coalesce(jsonb_typeof(${t.terms})='object' and ${t.terms}->>'targetId'=${t.targetId} and ${t.terms}->>'mode' in ('one_off','co_advice','transfer') and ${t.terms}->>'access' in ('read','contribute') and ${t.terms}->>'communication' in ('referent_only','client_direct') and ${t.terms}->'existingRightsPreserved'='true'::jsonb and ${t.terms}->'transmissionConfirmed'='true'::jsonb, false)`,
    ),
  ],
);
export const partnerContributors = pgTable(
  "partner_contributors",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    canEdit: boolean("can_edit").notNull().default(false),
    accessScope: text("access_scope").notNull().default("advice"),
    canContact: boolean("can_contact").notNull().default(true),
    collaborationId: text("collaboration_id").references(() => partnerCollaborations.id),
    revokedAt: instant("revoked_at"),
  },
  (t) => [
    check(
      "partner_contributor_scope",
      sql`${t.accessScope} in ('advice','progress') and (${t.accessScope} <> 'progress' or (not ${t.canEdit} and not ${t.canContact}))`,
    ),
    uniqueIndex("partner_contributor_active")
      .on(t.leadId, t.userId)
      .where(sql`${t.revokedAt} is null`),
  ],
);
export const partnerTasks = pgTable(
  "partner_tasks",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    responsibleId: text("responsible_id")
      .notNull()
      .references(() => identityUsers.id),
    title: text("title").notNull(),
    description: text("description").notNull(),
    dueAt: instant("due_at").notNull(),
    priority: text("priority").notNull(),
    reminderAt: instant("reminder_at"),
    state: text("state").notNull().default("open"),
    completedAt: instant("completed_at"),
  },
  (t) => [
    index("partner_tasks_lead").on(t.leadId, t.state),
    index("partner_tasks_assignee").on(t.responsibleId, t.dueAt),
    check("partner_task_state", sql`${t.state} in ('open','done','cancelled')`),
  ],
);
export const partnerAppointments = pgTable(
  "partner_appointments",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    advisorId: text("advisor_id")
      .notNull()
      .references(() => identityUsers.id),
    startsAt: instant("starts_at").notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    mode: text("mode").notNull(),
    location: text("location").notNull(),
    timezone: text("timezone").notNull(),
    state: text("state").notNull().default("scheduled"),
    occupiedBeforeMinutes: integer("occupied_before_minutes").notNull().default(0),
    occupiedAfterMinutes: integer("occupied_after_minutes").notNull().default(0),
    linkTermsRevision: integer("link_terms_revision").notNull().default(1),
  },
  (t) => [
    index("partner_appointment_lead").on(t.leadId),
    check("partner_appointment_link_terms_revision", sql`${t.linkTermsRevision}>0`),
    index("partner_appointment_advisor").on(t.advisorId, t.startsAt),
    check("partner_appointment_duration", sql`${t.durationMinutes} between 15 and 240`),
    check(
      "partner_appointment_buffers",
      sql`${t.occupiedBeforeMinutes} between 0 and 480 and ${t.occupiedAfterMinutes} between 0 and 240`,
    ),
    check(
      "partner_appointment_state",
      sql`${t.state} in ('scheduled','completed','cancelled','client_absent','advisor_absent')`,
    ),
  ],
);
export const partnerAppointmentLinks = pgTable(
  "partner_appointment_links",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => partnerAppointments.id),
    sourceLeadId: text("source_lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    ownerId: text("owner_id")
      .notNull()
      .references(() => identityUsers.id),
    subjectKey: text("subject_key").notNull(),
    profileRevision: integer("profile_revision").notNull(),
    revision: integer("revision").notNull(),
    termsRevision: integer("terms_revision").notNull(),
    action: text("action").notNull(),
    terms: jsonb("terms").notNull(),
    sourceBasis: text("source_basis").notNull(),
    targetBasis: text("target_basis").notNull(),
    evidence: jsonb("evidence").notNull(),
    invalidatedAt: instant("invalidated_at"),
    recordedAt: instant("recorded_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_appointment_link_revision").on(t.appointmentId, t.leadId, t.revision),
    index("partner_appointment_link_target").on(t.leadId, t.subjectKey, t.recordedAt),
    index("partner_appointment_link_source").on(t.sourceLeadId),
    index("partner_appointment_link_user").on(t.userId),
    check(
      "partner_appointment_link_bounds",
      sql`${t.revision}>0 and ${t.termsRevision}>0 and ${t.profileRevision}>=0 and ${t.sourceLeadId}<>${t.leadId}`,
    ),
    check("partner_appointment_link_action", sql`${t.action} in ('linked','unlinked')`),
  ],
);
export const partnerAppointmentTimePlans = pgTable(
  "partner_appointment_time_plans",
  {
    id: text("id").primaryKey(),
    appointmentId: text("appointment_id")
      .notNull()
      .references(() => partnerAppointments.id),
    advisorId: text("advisor_id")
      .notNull()
      .references(() => identityUsers.id),
    revision: integer("revision").notNull(),
    basis: text("basis").notNull(),
    preparationMinutes: integer("preparation_minutes").notNull(),
    travelBeforeMinutes: integer("travel_before_minutes").notNull(),
    travelAfterMinutes: integer("travel_after_minutes").notNull(),
    startsAt: instant("starts_at").notNull(),
    endsAt: instant("ends_at").notNull(),
    evidence: jsonb("evidence").notNull(),
    recordedAt: instant("recorded_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_appointment_time_revision").on(t.appointmentId, t.revision),
    check(
      "partner_appointment_time_bounds",
      sql`${t.revision}>0 and ${t.preparationMinutes} between 0 and 240 and ${t.travelBeforeMinutes} between 0 and 240 and ${t.travelAfterMinutes} between 0 and 240 and ${t.endsAt}>${t.startsAt}`,
    ),
  ],
);
export const partnerEvents = pgTable(
  "partner_events",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").references(() => partnerLeads.id),
    actorId: text("actor_id").references(() => identityUsers.id),
    systemActor: text("system_actor"),
    subjectId: text("subject_id"),
    kind: text("kind").notNull(),
    audience: text("audience").notNull(),
    text: text("text").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_event_lead").on(t.leadId, t.createdAt, t.id),
    check(
      "partner_event_actor",
      sql`(${t.actorId} is not null and ${t.systemActor} is null) or (${t.actorId} is null and ${t.systemActor} is not null and ${t.systemActor} = 'partner-continuity-v1')`,
    ),
    check(
      "partner_event_audience",
      sql`${t.audience} in ('private','assigned','client','coverview')`,
    ),
  ],
);
export const partnerOffers = pgTable(
  "partner_offers",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    data: jsonb("data").notNull(),
    sourceSnapshot: jsonb("source_snapshot"),
    reviewedBy: text("reviewed_by").references(() => identityUsers.id),
    publishedBy: text("published_by").references(() => identityUsers.id),
    version: integer("version").notNull(),
    familyId: text("family_id").notNull(),
    active: boolean("active").notNull().default(true),
    state: text("state").notNull().default("to_verify"),
    reviewedAt: instant("reviewed_at"),
    publishedAt: instant("published_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("partner_offer_lead").on(t.leadId),
    uniqueIndex("partner_offer_lead_id").on(t.leadId, t.id),
    index("partner_offer_history").on(t.leadId, t.createdAt, t.id),
    uniqueIndex("partner_offer_version").on(t.familyId, t.version),
    uniqueIndex("partner_offer_active")
      .on(t.familyId)
      .where(sql`${t.active}`),
    check(
      "partner_offer_state",
      sql`${t.state} in ('received','to_verify','ready','published','viewed','selected','refused','expired','replaced','to_sign','signed','cancelled')`,
    ),
  ],
);
export const partnerFinalPolicies = pgTable(
  "partner_final_policies",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    offerId: text("offer_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id),
    fingerprint: text("fingerprint").notNull(),
    sourceSnapshot: jsonb("source_snapshot").notNull(),
    confirmedBy: text("confirmed_by")
      .notNull()
      .references(() => identityUsers.id),
    consentVersion: text("consent_version").notNull().default("final-policy-v1"),
    active: boolean("active").notNull().default(true),
    createdAt: instant("created_at").notNull().defaultNow(),
    withdrawnAt: instant("withdrawn_at"),
  },
  (t) => [
    foreignKey({
      columns: [t.leadId, t.offerId],
      foreignColumns: [partnerOffers.leadId, partnerOffers.id],
    }),
    uniqueIndex("partner_final_policy_offer_active")
      .on(t.offerId)
      .where(sql`${t.active}`),
    uniqueIndex("partner_final_policy_document_active")
      .on(t.documentId)
      .where(sql`${t.active}`),
    index("partner_final_policy_history").on(t.leadId, t.createdAt, t.id),
    check("partner_final_policy_fingerprint", sql`${t.fingerprint} ~ '^[a-f0-9]{64}$'`),
    check(
      "partner_final_policy_withdrawal",
      sql`(${t.active} and ${t.withdrawnAt} is null) or (not ${t.active} and ${t.withdrawnAt} is not null)`,
    ),
  ],
);
export const partnerFinalPolicyReviews = pgTable(
  "partner_final_policy_reviews",
  {
    id: text("id").primaryKey(),
    policyId: text("policy_id")
      .notNull()
      .references(() => partnerFinalPolicies.id),
    version: integer("version").notNull(),
    checks: jsonb("checks").notNull(),
    reviewedBy: text("reviewed_by")
      .notNull()
      .references(() => identityUsers.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_final_policy_review_version").on(t.policyId, t.version),
    check("partner_final_policy_review_positive", sql`${t.version}>0`),
  ],
);

export const partnerCommands = pgTable(
  "partner_commands",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    key: text("key").notNull(),
    operation: text("operation").notNull(),
    hash: text("hash").notNull(),
    targetId: text("target_id").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("partner_command_key").on(t.userId, t.key),
    index("partner_command_expiry").on(t.createdAt),
  ],
);

export const partnerNotifications = pgTable(
  "partner_notifications",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id")
      .notNull()
      .references(() => partnerLeads.id),
    recipientId: text("recipient_id").references(() => identityUsers.id),
    collaborationId: text("collaboration_id").references(() => partnerCollaborations.id),
    audience: text("audience").notNull(),
    kind: text("kind").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    action: text("action"),
    priority: text("priority").notNull(),
    dueAt: instant("due_at"),
    createdAt: instant("created_at").notNull().defaultNow(),
    resolvedAt: instant("resolved_at"),
  },
  (t) => [
    index("partner_notification_inbox").on(t.recipientId, t.createdAt, t.id),
    index("partner_notification_lead").on(t.leadId, t.resolvedAt),
    check(
      "partner_notification_recipient",
      sql`(${t.audience} = 'coverview' and ${t.recipientId} is null) or (${t.audience} in ('partner','wallet') and ${t.recipientId} is not null)`,
    ),
    check("partner_notification_priority", sql`${t.priority} in ('normal','high','urgent')`),
  ],
);
export const partnerNotificationReads = pgTable(
  "partner_notification_reads",
  {
    id: text("id").primaryKey(),
    notificationId: text("notification_id")
      .notNull()
      .references(() => partnerNotifications.id),
    userId: text("user_id")
      .notNull()
      .references(() => identityUsers.id),
    readAt: instant("read_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("partner_notification_read_once").on(t.notificationId, t.userId)],
);
