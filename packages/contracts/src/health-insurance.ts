import { z } from "zod";

export const healthYear = 2027;
export const healthCategorySchema = z.enum(["BASE", "PRAXIS", "TEL_DIG", "FLEX", "PHARM"]);
export const healthRegionIdSchema = z.string().regex(/^(?:[A-Z]{2}-[0-3]|EU-[A-Z]{2})$/);
export const healthCompareInputSchema = z
  .object({
    year: z.literal(healthYear).default(healthYear),
    birthYear: z.number().int().min(1900).max(healthYear),
    accident: z.boolean(),
    deductible: z.number().int().min(0).max(2500),
    regionId: healthRegionIdSchema.optional(),
    municipalityId: z.number().int().positive().optional(),
    categories: z.array(healthCategorySchema).max(5).default([]),
    insurerIds: z.array(z.number().int().positive()).max(40).default([]),
    benefitKeys: z
      .array(z.string().regex(/^[a-z_]{2,60}$/))
      .max(12)
      .default([]),
    offset: z.number().int().min(0).max(500).default(0),
  })
  .strict();
export const healthOfferSchema = z.object({
  id: z.string(),
  modelId: z.string(),
  insurerId: z.number().int(),
  insurerName: z.string(),
  insurerBrand: z.string().trim().min(1).optional(),
  firstContacts: z
    .array(z.enum(["free", "gp", "network", "phone", "video", "pharmacy"]))
    .max(6)
    .optional(),
  contactsVerified: z.boolean().optional(),
  redistribution: z
    .object({
      year: z.number().int(),
      monthlyMinor: z.number().int().positive(),
      annualMinor: z.number().int().positive(),
      sourceUrl: z.url(),
    })
    .nullable()
    .optional(),
  residenceCountry: z.string().length(2).optional(),
  name: z.string(),
  category: healthCategorySchema,
  regionId: healthRegionIdSchema,
  monthlyPremiumMinor: z.number().int().nonnegative(),
  deductible: z.number().int(),
  accident: z.boolean(),
  ageGroup: z.enum(["child", "young_adult", "adult"]),
  restricted: z.boolean(),
  eligibility: z.enum(["region", "municipality_required", "municipality_confirmed"]),
});
export const healthLocalitySchema = z.object({
  id: z.string(),
  postalCode: z.string(),
  locality: z.string(),
  municipality: z.string(),
  municipalityId: z.number().int().nullable(),
  country: z.string().length(2).optional(),
  canton: z.string(),
  regionId: healthRegionIdSchema,
});
export const healthLocalitiesSchema = z.object({ items: z.array(healthLocalitySchema).max(20) });
export const healthLocateInputSchema = z
  .object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().nonnegative().max(1000000),
  })
  .strict();
export const healthLocationSuggestionSchema = z.object({
  regionId: healthRegionIdSchema.nullable(),
  items: z.array(healthLocalitySchema).max(20),
  approximate: z.boolean(),
});
export const healthForeignStatusSchema = z.object({
  premiumCount: z.number().int(),
  insurerCount: z.number().int(),
  importedAt: z.string(),
  sourceUrl: z.url(),
  countries: z
    .array(
      z.object({ code: z.string().length(2), name: z.string(), locality: healthLocalitySchema }),
    )
    .max(35),
});
export const healthRegionSchema = z.object({
  id: healthRegionIdSchema,
  canton: z.string(),
  number: z.number().int(),
});
export const healthStatusSchema = z.object({
  available: z.boolean(),
  year: z.literal(healthYear),
  importedAt: z.string().nullable(),
  premiumCount: z.number().int(),
  modelCount: z.number().int(),
  insurerCount: z.number().int(),
  localityCount: z.number().int(),
  regions: z.array(healthRegionSchema).max(50),
  insurers: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        brand: z.string().trim().min(1).optional(),
      }),
    )
    .max(100),
  sources: z.array(z.object({ url: z.url(), sha256: z.string(), file: z.string() })).max(20),
  foreign: healthForeignStatusSchema.nullable().optional(),
});
export const healthComparisonSchema = z.object({
  year: z.literal(healthYear),
  ageGroup: z.enum(["child", "young_adult", "adult"]),
  regions: z
    .array(z.object({ regionId: healthRegionIdSchema, offers: z.array(healthOfferSchema).max(3) }))
    .max(80),
  offers: z.array(healthOfferSchema).max(15),
  total: z.number().int(),
  nextOffset: z.number().int().nullable(),
});
export const healthBenefitSchema = z.object({
  id: z.string(),
  kind: z.enum(["model", "club"]),
  key: z.string(),
  title: z.string(),
  description: z.string(),
  value: z.boolean().nullable(),
  amountMinor: z.number().int().nonnegative().nullable(),
  currency: z.literal("CHF"),
  period: z.string().nullable(),
  conditions: z.string(),
  sourceUrl: z.url(),
  verifiedAt: z.string(),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  yearConfirmed: z.boolean(),
  requiresSupplementary: z.boolean().nullable(),
});
export const healthModelDetailsSchema = z.object({
  modelId: z.string(),
  insurerId: z.number().int(),
  insurerName: z.string(),
  insurerBrand: z.string().trim().min(1).optional(),
  name: z.string(),
  category: healthCategorySchema,
  tariffCode: z.string(),
  year: z.literal(healthYear),
  benefits: z.array(healthBenefitSchema).max(100),
  coverageStatus: z.enum(["partial", "unknown"]),
  premiumSourceUrl: z.url(),
});

export const healthInsurerIdentitySchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  brand: z.string().min(1),
});
// Historical taxonomy is kept as published; it cannot establish 2027 first-contact rules.
export const healthCurrentOfferSchema = healthOfferSchema.omit({ category: true }).extend({
  category: z.enum(["BASE", "HAM", "HMO", "DIV"]),
});
export const healthCurrentContextSchema = z
  .object({
    year: z.literal(2026).default(2026),
    birthYear: z.number().int().min(1900).max(2026),
    regionId: healthRegionIdSchema,
    municipalityId: z.number().int().positive().optional(),
    accident: z.boolean(),
    deductible: z.number().int().min(0).max(2500),
  })
  .strict();
export const healthCurrentSelectionSchema = healthCurrentContextSchema
  .omit({ birthYear: true })
  .extend({
    modelId: z.string().regex(/^(?:hm_[a-f0-9]{28}|hfm_2026_\d+)$/),
  })
  .strict();
export const healthCurrentOptionsInputSchema = healthCurrentContextSchema
  .extend({
    insurerId: z.number().int().positive().optional(),
  })
  .strict();
export const healthCurrentAvailabilitySchema = z.enum([
  "available",
  "data_unavailable",
  "location_required",
  "invalid_deductible",
  "model_unavailable",
]);
export const healthCurrentOptionsSchema = z.object({
  year: z.literal(2026),
  status: healthCurrentAvailabilitySchema,
  datasetId: z.string().nullable(),
  regionId: healthRegionIdSchema.nullable(),
  municipalityId: z.number().int().positive().nullable(),
  ageGroup: z.enum(["child", "young_adult", "adult"]),
  deductibles: z.array(z.number().int()).max(7),
  insurers: z.array(healthInsurerIdentitySchema).max(100),
  offers: z.array(healthCurrentOfferSchema).max(200),
});
export const healthCurrentComparisonInputSchema = z
  .object({
    birthYear: z.number().int().min(1900).max(2026),
    current: healthCurrentSelectionSchema,
    offerIds: z.array(z.string().regex(/^(?:hp_|hfp_)[a-f0-9]{28}$/)).max(1200),
  })
  .strict();
export const healthPremiumDifferenceSchema = z.object({
  offerId: z.string(),
  currentYear: z.literal(2026),
  targetYear: z.literal(2027),
  monthlySavingMinor: z.number().int(),
  annualSavingMinor: z.number().int(),
  direction: z.enum(["saving", "increase", "equal"]),
  deductibleChanged: z.boolean(),
  accidentChanged: z.boolean(),
  ageGroupChanged: z.boolean(),
  regionChanged: z.boolean(),
});
export const healthCurrentComparisonSchema = z.object({
  status: healthCurrentAvailabilitySchema,
  current: healthCurrentOfferSchema.nullable(),
  currentYear: z.literal(2026),
  targetYear: z.literal(2027),
  differences: z.array(healthPremiumDifferenceSchema).max(1200),
});
export const healthGuideInputSchema = healthCompareInputSchema.extend({
  regionId: healthRegionIdSchema,
  municipalityId: z.number().int().positive(),
  annualCareMinor: z.number().int().min(0).max(100_000_000),
  reserveMinor: z.number().int().min(0).max(10_000_000).nullable(),
  preferredAccess: z.enum(["any", "free", "practice", "remote", "flexible"]),
  objective: z.enum(["annual", "premium"]).default("annual"),
  answers: z
    .object({
      doctor: z.enum(["keep", "flexible", "verify"]).optional(),
      treatment: z.enum(["regular", "planned", "none", "private"]).optional(),
      prevention: z.enum(["screening", "pharmacy", "checkup", "none"]).optional(),
      medication: z.enum(["generics", "treatment", "none"]).optional(),
      supplementary: z.enum(["keep", "review", "none", "unknown"]).optional(),
      lifestyle: z.enum(["fitness", "family", "digital", "none"]).optional(),
      household: z.enum(["individual", "children", "maternity", "private"]).optional(),
      employment: z.enum(["covered", "not_covered", "verify"]).optional(),
      subsidy: z.enum(["review", "already", "none", "private"]).optional(),
    })
    .strict()
    .default({}),
});
export const healthGuideResultSchema = z.object({
  scenarios: z
    .array(
      z.object({
        offer: healthOfferSchema,
        annualPremiumMinor: z.number().int(),
        costShareMinor: z.number().int(),
        estimatedAnnualMinor: z.number().int(),
        maxOrdinaryCostShareMinor: z.number().int(),
        reserveSufficient: z.boolean().nullable(),
      }),
    )
    .max(7),
  bestDeductible: z.number().int().nullable(),
  careMinor: z.number().int(),
  objective: z.enum(["annual", "premium"]),
  guidance: z
    .array(
      z.enum([
        "doctor_network",
        "planned_care",
        "prevention",
        "medication",
        "supplementary",
        "club",
        "family",
        "maternity",
        "accident",
        "subsidy",
      ]),
    )
    .max(10),
});
export type HealthCompareInput = z.input<typeof healthCompareInputSchema>;
export type HealthOffer = z.infer<typeof healthOfferSchema>;
export type HealthLocality = z.infer<typeof healthLocalitySchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthComparison = z.infer<typeof healthComparisonSchema>;
export type HealthModelDetails = z.infer<typeof healthModelDetailsSchema>;
export type HealthGuideInput = z.input<typeof healthGuideInputSchema>;
export type HealthGuideResult = z.infer<typeof healthGuideResultSchema>;
export type HealthCurrentSelection = z.infer<typeof healthCurrentSelectionSchema>;
export type HealthCurrentOffer = z.infer<typeof healthCurrentOfferSchema>;
export type HealthCurrentContext = z.infer<typeof healthCurrentContextSchema>;
export type HealthCurrentOptionsInput = z.input<typeof healthCurrentOptionsInputSchema>;
export type HealthCurrentOptions = z.infer<typeof healthCurrentOptionsSchema>;
export type HealthCurrentComparison = z.infer<typeof healthCurrentComparisonSchema>;
export type HealthCurrentComparisonInput = z.infer<typeof healthCurrentComparisonInputSchema>;
export type HealthPremiumDifference = z.infer<typeof healthPremiumDifferenceSchema>;
