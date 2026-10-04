import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

// Public reference data only. No household, identity or medical answers in this module.
export const healthDatasets = pgTable(
  "health_datasets",
  {
    id: text("id").primaryKey(),
    year: integer("year").notNull(),
    active: boolean("active").notNull().default(false),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    sources: jsonb("sources").notNull(),
    counts: jsonb("counts").notNull(),
    insurerIdentities: jsonb("insurer_identities")
      .notNull()
      .default(sql`'[]'::jsonb`),
  },
  (t) => [
    uniqueIndex("health_one_active_year")
      .on(t.year)
      .where(sql`${t.active} = true`),
  ],
);
export const healthInsurers = pgTable("health_insurers", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
});
export const healthModels = pgTable(
  "health_models",
  {
    id: text("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => healthDatasets.id),
    insurerId: integer("insurer_id")
      .notNull()
      .references(() => healthInsurers.id),
    tariffCode: text("tariff_code").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
  },
  (t) => [uniqueIndex("health_model_tariff").on(t.datasetId, t.insurerId, t.tariffCode)],
);
export const healthRegions = pgTable(
  "health_regions",
  {
    id: text("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => healthDatasets.id),
    regionId: text("region_id").notNull(),
    canton: text("canton").notNull(),
    number: integer("number").notNull(),
  },
  (t) => [uniqueIndex("health_region_key").on(t.datasetId, t.regionId)],
);
export const healthLocalities = pgTable(
  "health_localities",
  {
    id: text("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => healthDatasets.id),
    regionKey: text("region_key")
      .notNull()
      .references(() => healthRegions.id),
    municipalityId: integer("municipality_id").notNull(),
    municipality: text("municipality").notNull(),
    postalCode: text("postal_code").notNull(),
    locality: text("locality").notNull(),
    searchText: text("search_text").notNull(),
  },
  (t) => [
    index("health_locality_postal").on(t.datasetId, t.postalCode),
    index("health_locality_municipality").on(t.datasetId, t.municipalityId),
  ],
);
export const healthEligibility = pgTable(
  "health_eligibility",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id")
      .notNull()
      .references(() => healthModels.id),
    regionKey: text("region_key")
      .notNull()
      .references(() => healthRegions.id),
    restricted: boolean("restricted").notNull(),
    municipalityIds: integer("municipality_ids").array().notNull(),
  },
  (t) => [uniqueIndex("health_eligibility_key").on(t.modelId, t.regionKey)],
);
export const healthPremiums = pgTable(
  "health_premiums",
  {
    id: text("id").primaryKey(),
    datasetId: text("dataset_id")
      .notNull()
      .references(() => healthDatasets.id),
    modelId: text("model_id")
      .notNull()
      .references(() => healthModels.id),
    regionKey: text("region_key")
      .notNull()
      .references(() => healthRegions.id),
    ageGroup: text("age_group").notNull(),
    ageSubgroup: text("age_subgroup").notNull(),
    accident: boolean("accident").notNull(),
    deductible: integer("deductible").notNull(),
    monthlyPremiumMinor: integer("monthly_premium_minor").notNull(),
    currency: text("currency").notNull().default("CHF"),
    raw: jsonb("raw").notNull(),
  },
  (t) => [
    uniqueIndex("health_premium_grain").on(
      t.datasetId,
      t.modelId,
      t.regionKey,
      t.ageGroup,
      t.ageSubgroup,
      t.accident,
      t.deductible,
    ),
    index("health_premium_compare").on(
      t.datasetId,
      t.ageGroup,
      t.ageSubgroup,
      t.accident,
      t.deductible,
      t.regionKey,
      t.monthlyPremiumMinor,
    ),
    // Cover offer reads without loading the much larger archived source JSON on cold caches.
    index("health_premium_offer_cover").on(
      t.datasetId,
      t.ageGroup,
      t.ageSubgroup,
      t.accident,
      t.deductible,
      t.regionKey,
      t.monthlyPremiumMinor,
      t.modelId,
      t.id,
    ),
    check(
      "health_premium_money",
      sql`${t.monthlyPremiumMinor} >= 0 and ${t.deductible} >= 0 and ${t.currency} = 'CHF'`,
    ),
  ],
);
export const healthBenefits = pgTable(
  "health_benefits",
  {
    active: boolean("active").notNull().default(true),
    id: text("id").primaryKey(),
    insurerId: integer("insurer_id")
      .notNull()
      .references(() => healthInsurers.id),
    tariffCode: text("tariff_code"),
    kind: text("kind").notNull(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    value: boolean("value"),
    amountMinor: integer("amount_minor"),
    currency: text("currency").notNull().default("CHF"),
    period: text("period"),
    conditions: text("conditions").notNull(),
    sourceUrl: text("source_url").notNull(),
    verifiedAt: text("verified_at").notNull(),
    validFrom: text("valid_from"),
    validUntil: text("valid_until"),
    yearConfirmed: boolean("year_confirmed").notNull(),
    requiresSupplementary: boolean("requires_supplementary"),
  },
  (t) => [
    index("health_benefit_model").on(t.insurerId, t.tariffCode),
    check("health_benefit_money", sql`${t.amountMinor} is null or ${t.amountMinor} >= 0`),
  ],
);
