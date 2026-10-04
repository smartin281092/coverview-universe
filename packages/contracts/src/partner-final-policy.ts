import { z } from "zod";
import { contractCandidateSchema } from "./partner-contract.js";

export const finalPolicyFields = [
  "identity",
  "premium",
  "dates",
  "coverage",
  "conditions",
] as const;
const citation = z
  .object({ page: z.number().int().min(1).max(200), quote: z.string().trim().min(1).max(1000) })
  .strict();
export const finalPolicyCheckSchema = z
  .object({
    field: z.enum(finalPolicyFields),
    result: z.enum(["same", "difference", "to_verify"]),
    note: z.string().trim().min(2).max(1000),
    offerSource: citation.nullable(),
    policySource: citation.nullable(),
  })
  .strict()
  .refine((value) => value.result === "to_verify" || !!(value.offerSource && value.policySource));
export const finalPolicyReviewSchema = z
  .object({
    policyId: z.string().min(1).max(100),
    checks: z.array(finalPolicyCheckSchema).min(1).max(5),
  })
  .strict()
  .refine(
    (value) => new Set(value.checks.map((check) => check.field)).size === value.checks.length,
  );
export const finalPolicySchema = z.object({
  id: z.string(),
  offer: z.object({
    id: z.string(),
    version: z.number().int(),
    company: z.string(),
    product: z.string(),
    active: z.boolean(),
    sourceStatus: z.enum(["current", "changed", "unavailable", "unbound"]),
  }),
  documentId: z.string(),
  linkedAt: z.iso.datetime(),
  withdrawnAt: z.iso.datetime().nullable(),
  active: z.boolean(),
  status: z.enum(["available", "source_changed", "unavailable", "withdrawn"]),
  source: contractCandidateSchema.nullable(),
  review: z
    .object({
      version: z.number().int(),
      reviewedAt: z.iso.datetime(),
      checks: z.array(finalPolicyCheckSchema),
    })
    .nullable(),
  reviewState: z.enum(["to_verify", "differences", "checked", "invalidated"]),
  missingChecks: z.array(z.enum(finalPolicyFields)),
  premium: z.object({
    offerAnnualMinor: z.number().int().nullable(),
    policyAnnualMinor: z.number().int().nullable(),
    factor: z.number().int().nullable(),
    differenceMinor: z.number().int().nullable(),
  }),
  signatureEvidence: z.literal("missing"),
  insurerAcceptanceEvidence: z.literal("missing"),
  canDownload: z.boolean(),
  canReview: z.boolean(),
});
export const finalPoliciesSchema = z.object({
  leadRevision: z.number().int(),
  items: z.array(finalPolicySchema).max(20),
  nextCursor: z.string().nullable(),
});
export type FinalPolicy = z.infer<typeof finalPolicySchema>;
export type FinalPolicyReview = z.infer<typeof finalPolicyReviewSchema>;
