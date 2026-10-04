import { z } from "zod";
import { documentInsuranceSchema, insuranceContractSchema } from "./documents.js";
import { benefitCategorySchema, benefitLimitSchema } from "./partner-benefits.js";

export const contractCandidateSchema = z.object({
  documentId: z.string(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
  generation: z.number().int().nonnegative(),
  contract: insuranceContractSchema,
  facts: documentInsuranceSchema,
});
export const contractCandidatesSchema = z.object({
  items: z.array(contractCandidateSchema).max(200),
  truncated: z.boolean(),
  // Policies whose insurance domain fits the need, listed first.
  compatible: z.array(z.string()).max(200).default([]),
  // A single exact match on the request's object reference; the owner still confirms.
  proposal: z
    .object({ documentId: z.string(), reason: z.enum(["policy_number", "insured_object"]) })
    .nullable()
    .default(null),
});
export const contractFeatureSchema = z
  .object({
    key: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(160),
    value: z.string().trim().max(500),
    conditions: z.string().trim().max(1000),
    exclusions: z.string().trim().max(1000),
    coverage: z.enum(["included", "excluded", "unknown"]),
    verification: z.enum(["verified", "to_verify", "missing"]),
    page: z.number().int().positive().max(200).nullable(),
    quote: z.string().trim().max(1000),
    category: benefitCategorySchema.optional(),
    limit: benefitLimitSchema.nullable().optional(),
  })
  .strict();
export const contractReviewInputSchema = z
  .object({
    referenceId: z.string().min(1).max(100),
    premiumVerified: z.boolean(),
    features: z.array(contractFeatureSchema).max(80),
  })
  .strict()
  .refine(
    (value) =>
      new Set(
        value.features.map((f) => (f.key === "other" ? `other:${f.label.toLowerCase()}` : f.key)),
      ).size === value.features.length,
  );
export const currentContractSchema = z.object({
  referenceId: z.string(),
  documentId: z.string(),
  fingerprint: z.string(),
  confirmedAt: z.iso.datetime(),
  status: z.enum(["available", "source_changed", "unavailable"]),
  source: contractCandidateSchema.nullable(),
  reviewVersion: z.number().int().nonnegative(),
  premiumVerified: z.boolean(),
  features: z.array(contractFeatureSchema),
});
export const contractComparisonSchema = z.object({
  offerId: z.string(),
  offerVersion: z.number().int().positive(),
  annualDifferenceMinor: z.number().int().nullable(),
  currentAnnualMinor: z.number().int().nullable(),
  annualFactor: z.number().int().nullable(),
  premiumStatus: z.enum(["calculated", "to_verify", "missing", "unavailable"]),
  rows: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      current: contractFeatureSchema.nullable(),
      proposed: z
        .object({
          value: z.string(),
          conditions: z.string(),
          exclusions: z.string(),
          coverage: z.enum(["included", "excluded", "unknown"]),
          origin: z.enum(["extracted", "manual", "calculated", "missing"]),
          verification: z.enum(["verified", "to_verify", "missing"]),
          source: z.string(),
          page: z.number().int().nullable(),
        })
        .nullable(),
      change: z.enum(["gain", "loss", "same", "changed", "to_verify", "missing"]),
    }),
  ),
});
export type ContractCandidate = z.infer<typeof contractCandidateSchema>;
export type CurrentContract = z.infer<typeof currentContractSchema>;
export type ContractReviewInput = z.infer<typeof contractReviewInputSchema>;
export type ContractComparison = z.infer<typeof contractComparisonSchema>;
