import { z } from "zod";

// Stable identifiers for the companies named in the supplied LSA45 information.
// Membership in this directory conveys no customer relationship or authorization.
export const insuranceCompanyIdSchema = z.enum([
  "allianz",
  "assura",
  "automate",
  "axa",
  "baloise",
  "css",
  "generali",
  "groupe-mutuel",
  "helsana",
  "liechtenstein-life",
  "tsm",
]);
export const insuranceCompanyIdsSchema = z
  .array(insuranceCompanyIdSchema)
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, { message: "Duplicate company" });
export const documentCompaniesSchema = z.object({ companyIds: insuranceCompanyIdsSchema });
export type InsuranceCompanyId = z.infer<typeof insuranceCompanyIdSchema>;
