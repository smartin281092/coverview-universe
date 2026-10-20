import { z } from "zod";
import { healthOfferSchema, healthLocalitySchema, healthYear } from "./health-insurance.js";

export const insuranceRequestIdSchema = z.string().regex(/^inq_[0-9a-f-]{36}$/);
export const insuranceRequestStateSchema = z.enum([
  "draft",
  "submitted",
  "reviewing",
  "insurer_contacted",
  "offer_ready",
  "completed",
  "cancelled",
]);
export const insurancePersonSchema = z
  .object({
    id: z.uuid(),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    sex: z.enum(["female", "male", "other"]),
    birthYear: z.number().int().min(1900).max(2026),
    birthDate: z.iso.date().optional(),
    currentInsurerId: z.number().int().positive().nullable(),
    modelId: z.string().min(1).max(160),
    localityId: z.string().min(1).max(160),
    accident: z.boolean(),
    deductible: z.number().int().min(0).max(2500),
  })
  .strict();
export const insuranceCartSchema = z
  .object({
    items: z.array(insurancePersonSchema).max(12),
    saveInWallet: z.boolean(),
    revision: z.number().int().nonnegative(),
  })
  .strict()
  .refine(
    (value) => new Set(value.items.map((item) => item.id)).size === value.items.length,
    "duplicate_person",
  );
export const insuranceEmailInputSchema = z
  .object({ email: z.email().max(240), access: z.enum(["guest", "wallet"]).default("wallet") })
  .strict();
export const insuranceCodeInputSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
export const insuranceBrowserSchema = z.object({
  csrfToken: z.string(),
  authEnabled: z.boolean(),
  walletUrl: z.url(),
  accountEmail: z.email().nullable().default(null),
});
export const insuranceEmailResultSchema = z.object({
  id: insuranceRequestIdSchema,
  codeStatus: z.enum(["sent", "unavailable", "not_requested"]),
  verified: z.boolean(),
});
export const insuranceItemSchema = insurancePersonSchema.extend({
  offer: healthOfferSchema,
  locality: healthLocalitySchema,
  profileId: z.string().nullable(),
  currentInsurerName: z.string().nullable().default(null),
  currentInsurerBrand: z.string().trim().min(1).optional(),
});
// Each person's 2026 health contract (20 October 2026): one of the person's own documents, or the
// person's statement of having none. Same document identifier as documents.ts, kept local so the
// public comparator does not load the document contracts.
const contractDocumentIdSchema = z.string().regex(/^doc_[0-9a-f-]{36}$/);
export const insurancePreviousContractSchema = z.discriminatedUnion("kind", [
  z.object({
    personId: z.uuid(),
    kind: z.literal("document"),
    documentId: contractDocumentIdSchema,
    at: z.iso.datetime(),
  }),
  z.object({ personId: z.uuid(), kind: z.literal("none"), at: z.iso.datetime() }),
]);
export const insurancePreviousContractInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      personId: z.uuid(),
      kind: z.literal("document"),
      documentId: contractDocumentIdSchema,
    })
    .strict(),
  z.object({ personId: z.uuid(), kind: z.literal("none") }).strict(),
  // Withdraws the answer, for example a "none" given by mistake.
  z.object({ personId: z.uuid(), kind: z.literal("unset") }).strict(),
]);
export const insuranceRequestSchema = z.object({
  id: insuranceRequestIdSchema,
  email: z.email().nullable(),
  emailVerified: z.boolean(),
  state: insuranceRequestStateSchema,
  revision: z.number().int().nonnegative(),
  items: z.array(insuranceItemSchema).max(12),
  totalMonthlyMinor: z.number().int().nonnegative(),
  saveInWallet: z.boolean(),
  createdAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  updatedAt: z.iso.datetime(),
  legalVersion: z.string().nullable(),
  history: z.array(z.object({ state: insuranceRequestStateSchema, at: z.iso.datetime() })).max(100),
  previousContracts: z.array(insurancePreviousContractSchema).max(12).default([]),
  // The premium year the request was quoted on: its name, "Assurance maladie 2027".
  year: z.number().int().min(2027).max(2100).default(healthYear),
});
export const insuranceRequestListSchema = z.object({
  requests: z.array(insuranceRequestSchema).max(25),
  nextCursor: z.string().nullable(),
});
export const insuranceRequestListQuerySchema = z
  .object({
    state: insuranceRequestStateSchema.optional(),
    cursor: z.string().max(500).optional(),
    profileId: z.string().max(100).optional(),
  })
  .strict();
export const insuranceTransitionInputSchema = z
  .object({
    state: insuranceRequestStateSchema.exclude(["draft", "submitted"]),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export { insuranceRequestErrorCodes } from "./insurance-request-errors.js";
export type InsurancePerson = z.infer<typeof insurancePersonSchema>;
export type InsuranceCart = z.infer<typeof insuranceCartSchema>;
export type InsuranceRequest = z.infer<typeof insuranceRequestSchema>;
export type InsuranceRequestState = z.infer<typeof insuranceRequestStateSchema>;
export type InsuranceRequestListQuery = z.infer<typeof insuranceRequestListQuerySchema>;
export type InsuranceTransitionInput = z.infer<typeof insuranceTransitionInputSchema>;
export type InsurancePreviousContract = z.infer<typeof insurancePreviousContractSchema>;
export type InsurancePreviousContractInput = z.infer<typeof insurancePreviousContractInputSchema>;
