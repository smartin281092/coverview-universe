import { z } from "zod";
import { benefitCategorySchema } from "./partner-benefits.js";

// Automatic initial orientation (orientation-v1, brief I.13): derived at read time from verified
// and sourced comparison cells only, always labelled as not validated, never a recommendation.
export const orientationVersion = "orientation-v1";
export const offerOrientationStatusSchema = z.enum([
  "incomplete",
  "advantage",
  "keep_current",
  "tradeoff",
  "comparable",
]);
export const leadOrientationKindSchema = z.enum([
  "insufficient",
  "offer_advantage",
  "keep_current",
  "tradeoff",
  "offers_only",
]);
const rowRef = z.object({
  key: z.string(),
  category: benefitCategorySchema,
  label: z.string().nullable(),
});
export const offerOrientationSchema = z.object({
  offerId: z.string(),
  offerVersion: z.number().int().positive(),
  status: offerOrientationStatusSchema,
  // Offer minus current contract, both premiums verified; negative is a saving.
  annualDifferenceMinor: z.number().int().nullable(),
  improves: z.array(rowRef),
  loses: z.array(rowRef),
  // Different exclusions, values that differ without numeric comparison, conditions to read.
  notes: z.array(rowRef),
  toVerify: z.array(rowRef),
  missing: z.array(rowRef),
  premiumVerified: z.boolean(),
  // Market presence is known (an offer was received); admission and distribution are not.
  availability: z.object({
    present: z.literal(true),
    admission: z.literal("not_established"),
    distribution: z.literal("not_established"),
  }),
});
export const leadOrientationSchema = z.object({
  version: z.literal(orientationVersion),
  kind: leadOrientationKindSchema,
  reference: z.enum(["current_contract", "none"]),
  // The single offer an advisor would deviate from, or keeping the current contract; null when the
  // orientation does not point to one option.
  suggestion: z
    .discriminatedUnion("kind", [
      z.object({
        kind: z.literal("offer"),
        offerId: z.string(),
        offerVersion: z.number().int().positive(),
      }),
      z.object({ kind: z.literal("keep_current") }),
    ])
    .nullable(),
  offers: z.array(offerOrientationSchema).max(20),
  transparency: z.object({
    // Date of the most recent data used (offer reviews, current contract confirmation), so the
    // same data always yields the same orientation.
    asOf: z.iso.datetime({ offset: true }).nullable(),
    currentReviewVersion: z.number().int().nonnegative().nullable(),
    annualFactor: z.number().int().nullable(),
    offers: z.array(
      z.object({
        offerId: z.string(),
        offerVersion: z.number().int().positive(),
        company: z.string(),
        reviewedAt: z.iso.datetime({ offset: true }).nullable(),
      }),
    ),
    // Scope of the market covered: the offers received in this request, nothing else.
    companies: z.number().int().nonnegative(),
    assumptions: z.array(
      z.enum([
        "chf_only",
        "annualized_current_premium",
        "structured_amounts_only",
        "verified_sources_only",
      ]),
    ),
  }),
});
export type LeadOrientation = z.infer<typeof leadOrientationSchema>;
