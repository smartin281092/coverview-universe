import { z } from "zod";
import {
  benefitCatalogVersion,
  benefitCategorySchema,
  benefitLimitSchema,
} from "./partner-benefits.js";

// One comparison for a Lead (brief III.6–9): the reviewed current contract, when one is linked, is
// the reference column; offers follow. Every cell keeps its own label, value, conditions and source.
export const comparisonChangeSchema = z.enum([
  "identical",
  "added",
  "removed",
  "better",
  "worse",
  "exclusions_changed",
  "changed",
  "to_verify",
  "missing",
]);
export const comparisonCellSchema = z.object({
  label: z.string(),
  value: z.string(),
  limit: benefitLimitSchema.nullable(),
  coverage: z.enum(["included", "excluded", "unknown"]),
  conditions: z.string(),
  exclusions: z.string(),
  verification: z.enum(["verified", "to_verify", "missing"]),
  source: z.string(),
  page: z.number().int().nullable(),
  // Versus the reference column; null for the reference itself or without reference.
  change: comparisonChangeSchema.nullable(),
  // Best comparable structured amount of the row among offers, when at least two compare.
  best: z.boolean(),
});
export const comparisonColumnSchema = z.object({
  kind: z.enum(["current", "offer"]),
  offerId: z.string().nullable(),
  offerVersion: z.number().int().positive().nullable(),
  company: z.string(),
  product: z.string(),
  annualPremiumMinor: z.number().int().nullable(),
  // Factor applied to the current contract's premium (month ×12…); offers are annual already.
  annualFactor: z.number().int().nullable(),
  premiumStatus: z.enum(["verified", "to_verify", "missing"]),
  // Offer minus current contract, both verified; negative is a saving.
  annualDifferenceMinor: z.number().int().nullable(),
  // What I gain and what I lose versus the reference: both are always shown together.
  summary: z
    .object({
      gains: z.number().int().nonnegative(),
      losses: z.number().int().nonnegative(),
      exclusionsChanged: z.number().int().nonnegative(),
      toVerify: z.number().int().nonnegative(),
      missing: z.number().int().nonnegative(),
    })
    .nullable(),
});
export const comparisonRowSchema = z.object({
  key: z.string(),
  category: benefitCategorySchema,
  // Shown for "other" rows, grouped by normalized label; categories are translated by the client.
  label: z.string().nullable(),
  // Rows with a gain, a loss or differing exclusions lead the synthetic view.
  primary: z.boolean(),
  cells: z.array(comparisonCellSchema.nullable()),
});
export const offerComparisonSchema = z.object({
  catalog: z.literal(benefitCatalogVersion),
  reference: z.enum(["current_contract", "none"]),
  columns: z.array(comparisonColumnSchema).max(21),
  rows: z.array(comparisonRowSchema).max(200),
});
export type OfferComparison = z.infer<typeof offerComparisonSchema>;
export type ComparisonChange = z.infer<typeof comparisonChangeSchema>;
