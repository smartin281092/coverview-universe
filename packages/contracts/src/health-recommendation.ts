import { z } from "zod";
import {
  benefitFamilySchema,
  healthCompareInputSchema,
  healthOfferSchema,
} from "./health-insurance.js";

const money = z.number().int().min(0).max(100_000_000);
export const recommendationAnswerSchema = z
  .object({
    version: z.literal(2),
    confirmedAtVersion: z.number().int().nonnegative().optional(),
    status: z.enum(["answered", "unknown", "skipped", "declined"]),
    values: z.array(z.string().max(100)).max(12).default([]),
    amountMinor: money.optional(),
    upperMinor: money.nullable().optional(),
  })
  .strict();
export const recommendationInputSchema = z
  .object({
    profileVersion: z.number().int().nonnegative(),
    tariff: healthCompareInputSchema,
    tariffKnown: z
      .object({ birth: z.boolean(), locality: z.boolean(), region: z.boolean().optional() })
      .strict(),
    sex: z.enum(["female", "male", "other", "declined"]).nullable().optional(),
    scope: z.enum(["same_deductible", "optimize_deductible"]),
    answers: z
      .record(z.string().regex(/^[a-zA-Z0-9_:-]{1,120}$/), recommendationAnswerSchema)
      .refine((value) => Object.keys(value).length <= 100),
    legacyAnswers: z
      .array(
        z
          .object({ version: z.literal(1), key: z.string().max(50), value: z.string().max(100) })
          .strict(),
      )
      .max(20)
      .default([]),
    optIn: z.boolean().default(false),
    explore: z
      .array(
        z.enum([
          "prevention",
          "medication",
          "supplementary",
          "lifestyle",
          "household",
          "maternity",
          "subsidy",
          "treatment",
        ]),
      )
      .max(8)
      .default([]),
    stop: z.boolean().default(false),
  })
  .strict();
export const evidenceSourceSchema = z
  .object({
    id: z.string().max(100),
    url: z.url(),
    title: z.string().max(300),
    passage: z.string().max(3000),
    page: z.number().int().positive().nullable(),
    checkedAt: z.iso.date(),
    quality: z.enum(["contract", "official", "marketing", "unavailable"]),
    yearExplicit: z.boolean(),
  })
  .strict();
// Canonical benefit taxonomy: insurers name the same advantage differently; every fact of a
// catalogue declaring this taxonomy points to exactly one key. The key is also a compare filter.
export const benefitTypeSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z_]{1,59}$/),
    family: benefitFamilySchema,
    label: z.string().min(2).max(120),
    description: z.string().max(600),
    synonyms: z.array(z.string().max(160)).max(80),
    // service/financial types can be preferred by the visitor; condition/none are informative only.
    valuation: z.enum(["service", "financial", "condition", "none"]),
  })
  .strict();
export const evidenceBenefitSchema = z
  .object({
    id: z.string().max(100),
    insurerId: z.number().int(),
    modelIds: z.array(z.string()).max(200),
    year: z.number().int(),
    title: z.string().max(300),
    insurerTerm: z.string().max(200).optional(),
    equivalenceGroup: z.string().max(100),
    questionAudience: z.enum(["all", "female", "male"]).optional(),
    classification: z.enum([
      "legal_common",
      "model_condition",
      "base_service",
      "commercial",
      "supplementary",
      "public_service",
      "unknown",
    ]),
    category: benefitFamilySchema,
    effect: z.string().max(4000),
    conditions: z.string().max(5000),
    exclusions: z.string().max(3000),
    activation: z.string().max(1500),
    geography: z.array(z.string()).max(50),
    beneficiary: z.enum(["person", "household"]),
    frequency: z.string().max(600).nullable(),
    capMinor: money.nullable(),
    extraCostMinor: money.nullable(),
    validFrom: z.iso.date().nullable(),
    validUntil: z.iso.date().nullable(),
    yearConfirmed: z.boolean(),
    requiresSameBase: z.boolean().nullable(),
    requiresSupplementary: z.boolean().nullable(),
    supplementaryProducts: z.array(z.string().max(200)).max(30),
    verification: z.enum(["verified", "partial", "contradictory", "inaccessible"]),
    sourceIds: z.array(z.string()).min(1).max(30),
    operatorCaseIds: z.array(z.string()).max(30),
    financial: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("none") }).strict(),
      z.object({ kind: z.literal("copay_cap"), capMinor: money }).strict(),
      z
        .object({
          kind: z.literal("eligible_care_waiver"),
          deductible: z.boolean(),
          copay: z.boolean(),
          careGroup: z.string().max(100),
        })
        .strict(),
      z
        .object({
          kind: z.literal("purchase_discount"),
          basisPoints: z.number().int().min(0).max(10000),
          basket: z.enum(["otc", "parapharmacy", "fitness", "leisure"]),
          capMinor: money.nullable(),
        })
        .strict(),
    ]),
    utility: z.enum(["none", "freedom", "practical", "simplicity", "services"]),
    telemedicine: z.enum([
      "not_applicable",
      "platform_only",
      "triage_only",
      "free_consultation",
      "billed_consultation",
      "deductible_only",
      "unknown",
    ]),
  })
  .strict();
export const researchModelSchema = z
  .object({
    id: z.string(),
    insurerId: z.number().int(),
    insurerName: z.string(),
    name: z.string(),
    tariffCode: z.string(),
    year: z.number().int(),
    category: z.enum(["BASE", "PRAXIS", "TEL_DIG", "FLEX", "PHARM"]),
    regions: z.array(z.string()).max(50),
    status: z.enum([
      "not_researched",
      "researched",
      "partial",
      "inaccessible",
      "verified",
      "review",
    ]),
    sourceIds: z.array(z.string()).max(60),
    confirmed: z.string().max(5000),
    missing: z.string().max(5000),
    access: z
      .object({
        contacts: z.array(z.enum(["free", "gp", "network", "phone", "video", "pharmacy"])).max(6),
        multipleEntry: z.boolean().nullable(),
        mandatory: z.boolean().nullable(),
        verifiedYear: z.boolean(),
        ageScope: z.enum(["all", "adult"]).default("all"),
        obligations: z.string().max(3000),
        networkUrl: z.url().nullable(),
        professionalAdmission: z
          .record(z.string().max(100), z.enum(["compatible", "incompatible", "verify"]))
          .default({}),
      })
      .strict(),
  })
  .strict();
export const operatorCaseSchema = z
  .object({
    id: z.string(),
    insurerId: z.number().int(),
    insurerName: z.string(),
    modelIds: z.array(z.string()).min(1).max(200),
    modelNames: z.array(z.string()).min(1).max(200),
    year: z.number().int(),
    regions: z.array(z.string()).max(50),
    rule: z.string().max(300),
    confirmed: z.string().max(5000),
    missing: z.string().max(5000),
    sourceIds: z.array(z.string()).max(60),
    impact: z.string().max(2000),
    provisionalTreatment: z.string().max(2000),
    question: z.string().max(3000),
    action: z.string().max(2000),
    priority: z.enum(["blocking", "important", "secondary"]),
    status: z.enum(["open", "in_review", "resolved", "deferred"]),
    owner: z.string().max(200).nullable(),
    revision: z.number().int().nonnegative(),
    history: z
      .array(
        z.object({
          at: z.iso.datetime(),
          actor: z.string(),
          action: z.string(),
          note: z.string().max(3000),
        }),
      )
      .max(200),
  })
  .strict();
export const evidenceCatalogSchema = z
  .object({
    id: z.string(),
    year: z.number().int(),
    datasetId: z.string(),
    checkedAt: z.iso.date(),
    publication: z
      .object({ at: z.iso.datetime(), actor: z.string(), reason: z.string().max(2000) })
      .nullable()
      .optional(),
    insurers: z
      .array(
        z.object({
          id: z.number().int(),
          legalName: z.string(),
          brand: z.string(),
          groupName: z.string().nullable(),
          aliases: z.array(z.string()).max(30),
        }),
      )
      .max(100),
    models: z.array(researchModelSchema).max(1000),
    benefitTypes: z.array(benefitTypeSchema).max(200).default([]),
    benefits: z.array(evidenceBenefitSchema).max(5000),
    sources: z.array(evidenceSourceSchema).max(3000),
    cases: z.array(operatorCaseSchema).max(2000),
  })
  .strict();
export const recommendationRulesSchema = z
  .object({
    schemaVersion: z.literal(1),
    year: z.number().int().min(2027).max(2100),
    activation: z.enum(["off", "opt_in", "on"]),
    weights: z
      .object({
        freedom: z.number().int().min(0).max(100),
        practical: z.number().int().min(0).max(100),
        simplicity: z.number().int().min(0).max(100),
        services: z.number().int().min(0).max(100),
      })
      .strict(),
    serviceContributionCap: z.number().int().min(1).max(10),
    // Evidence needed for a preferred benefit type to add service utility. Amounts always require
    // verified, year-confirmed contractual evidence, whatever this setting.
    serviceEvidence: z.enum(["official", "verified"]).default("official"),
    meaningfulAnnualDifferenceMinor: money,
    tieAnnualMinor: money,
    researchReviewDays: z.number().int().min(1).max(365),
    rationale: z.string().min(10).max(4000),
  })
  .strict();
export const recommendationQuestionSchema = z
  .object({
    id: z.string(),
    topic: z.string(),
    title: z.string(),
    help: z.string(),
    multiple: z.boolean(),
    options: z
      .array(
        z.object({
          value: z.string(),
          label: z.string(),
          exclusive: z.boolean().default(false),
          group: z.string().max(120).optional(),
          description: z.string().max(600).optional(),
        }),
      )
      .max(80),
    amount: z.enum(["none", "care", "reserve", "extra_cost", "spending"]),
    reason: z.enum([
      "tariff",
      "constraint",
      "ranking_sensitivity",
      "dependent_benefit",
      "cost_sensitivity",
      "requested",
    ]),
    sensitivity: z.object({
      examinedAlternatives: z.number().int(),
      changesLeader: z.boolean(),
      changesCost: z.boolean(),
      changesCompatibility: z.boolean(),
    }),
    subjectId: z.string().nullable(),
  })
  .strict();
export const rankedRecommendationSchema = z
  .object({
    offer: healthOfferSchema,
    year: z.number().int(),
    compatibility: z.enum(["compatible", "incompatible", "verify"]),
    reasons: z.array(z.string()).max(40),
    uncertainties: z.array(z.string()).max(40),
    operatorCaseIds: z.array(z.string()).max(100),
    annualPremiumMinor: money,
    costShareMinor: money.nullable(),
    annualInsuranceCareMinor: money.nullable(),
    costScenarios: z
      .array(z.object({ careMinor: money, costShareMinor: money, annualMinor: money }))
      .max(8),
    ordinaryExposureMinor: money,
    affordability: z.enum(["sufficient", "insufficient", "uncertain", "unknown"]),
    utility: z.object({
      freedom: z.number(),
      practical: z.number(),
      simplicity: z.number(),
      services: z.number(),
      total: z.number(),
    }),
    benefits: z
      .array(
        z.object({
          id: z.string(),
          status: z.enum([
            "available",
            "conditional",
            "ineligible",
            "already_accessible",
            "irrelevant",
          ]),
          certainSavingMinor: money,
          potentialSavingMinor: money.nullable(),
          reason: z.string(),
        }),
      )
      .max(300),
    // One entry per benefit type the visitor said they would use. "Not documented" is not absence.
    preferredBenefits: z
      .array(
        z.object({
          type: z.string(),
          status: z.enum(["counted", "counted_unconfirmed", "conditional", "not_documented"]),
          benefitIds: z.array(z.string()).max(30),
        }),
      )
      .max(60)
      .default([]),
    peripheralSavingMinor: money,
    tied: z.boolean(),
  })
  .strict();
export const recommendationResultSchema = z
  .object({
    profileVersion: z.number().int(),
    rulesVersion: z.string(),
    catalogVersion: z.string(),
    year: z.number().int(),
    scope: z.enum(["same_deductible", "optimize_deductible"]),
    subsidy: z.literal("before_unverified_subsidy"),
    active: z.boolean(),
    outcome: z.enum(["continue", "established", "tradeoff", "provisional", "disabled"]),
    ranked: z.array(rankedRecommendationSchema).max(1200),
    unevaluable: z.array(z.string()).max(1200),
    leaders: z.object({
      premium: z.array(z.string()).max(1200),
      annual: z.array(z.string()).max(1200),
      preferred: z.array(z.string()).max(1200),
    }),
    nextQuestion: recommendationQuestionSchema.nullable(),
    questionStates: z
      .array(
        z.object({
          id: z.string(),
          responseStatus: z.enum(["not_asked", "answered", "unknown", "skipped", "declined"]),
          display: z.enum(["active", "inactive", "available"]),
          question: recommendationQuestionSchema,
        }),
      )
      .max(6000),
    messages: z.array(z.string()).max(40),
    decisiveMissing: z.array(z.string()).max(100),
    examinedCandidateCount: z.number().int(),
    examinedScenarios: z.number().int(),
    evidenceCounts: z.object({
      models: z.number().int(),
      researched: z.number().int(),
      verified: z.number().int(),
      remaining: z.number().int(),
    }),
  })
  .strict();
export const recommendationAdminStateSchema = z.object({
  rules: z.object({
    id: z.string(),
    revision: z.number().int(),
    config: recommendationRulesSchema,
  }),
  history: z
    .array(
      z.object({
        id: z.string(),
        revision: z.number().int(),
        at: z.iso.datetime(),
        actor: z.string(),
        reason: z.string(),
        config: recommendationRulesSchema,
      }),
    )
    .max(100),
  catalog: evidenceCatalogSchema.nullable(),
  catalogHistory: z
    .array(
      z.object({
        id: z.string(),
        at: z.iso.datetime(),
        checkedAt: z.iso.date(),
        reason: z.string(),
        actor: z.string(),
      }),
    )
    .max(100),
  reviewDue: z.object({
    sourceIds: z.array(z.string()).max(3000),
    nextAt: z.iso.date().nullable(),
  }),
});
export const recommendationCatalogPublishSchema = z
  .object({
    catalog: evidenceCatalogSchema,
    expectedCatalogId: z.string().nullable(),
    reason: z.string().min(10).max(2000),
  })
  .strict();
export const recommendationPublishSchema = z
  .object({
    expectedRevision: z.number().int(),
    config: recommendationRulesSchema,
    reason: z.string().min(10).max(2000),
  })
  .strict();
export const operatorCaseUpdateSchema = z
  .object({
    expectedRevision: z.number().int(),
    status: operatorCaseSchema.shape.status,
    owner: z.string().max(200).nullable(),
    note: z.string().min(5).max(3000),
  })
  .strict();
export type RecommendationInput = z.infer<typeof recommendationInputSchema>;
export type RecommendationAnswer = z.infer<typeof recommendationAnswerSchema>;
export type RecommendationResult = z.infer<typeof recommendationResultSchema>;
export type RecommendationQuestion = z.infer<typeof recommendationQuestionSchema>;
export type RecommendationRules = z.infer<typeof recommendationRulesSchema>;
export type EvidenceCatalog = z.infer<typeof evidenceCatalogSchema>;
export type EvidenceBenefit = z.infer<typeof evidenceBenefitSchema>;
export type BenefitType = z.infer<typeof benefitTypeSchema>;
export type ResearchModel = z.infer<typeof researchModelSchema>;
export type RankedRecommendation = z.infer<typeof rankedRecommendationSchema>;
