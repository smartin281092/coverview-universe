import { z } from "zod";
import { avsNumberSchema } from "./profile.js";

// Searches for forgotten occupational pension assets (LPP), ordered from the public site and
// followed in Wallet (4 November 2026). The search itself is free; nothing is paid here.
export const pensionSearchErrorCodes = [
  "PENSION_SEARCH_NOT_FOUND",
  "PENSION_SEARCH_CONFLICT",
  "PENSION_SEARCH_EMAIL_REQUIRED",
  "PENSION_SEARCH_IDEMPOTENCY_REUSED",
  "PENSION_SEARCH_CODE_EXPIRED",
] as const;
export const pensionSearchIdSchema = z.string().regex(/^lpp_[0-9a-f-]{36}$/);
export const pensionSearchStateSchema = z.enum([
  "submitted",
  "reviewing",
  "search_sent",
  "results_received",
  "completed",
  "cancelled",
]);
// The steps a search moves through, in order; cancelled can end any step before completed.
export const pensionSearchStages = [
  "submitted",
  "reviewing",
  "search_sent",
  "results_received",
  "completed",
] as const;
export const pensionSearchSituationSchema = z.enum([
  "job_change",
  "unemployment",
  "break",
  "leaving_switzerland",
  "retirement",
  "self_employed",
  "home",
  "divorce",
  "other",
]);
const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).default("");
const year = z.number().int().min(1950).max(2100);
export const pensionSearchEmployerSchema = z
  .object({
    name: text(160),
    city: optionalText(120),
    fromYear: year.nullable().default(null),
    toYear: year.nullable().default(null),
  })
  .strict()
  .refine(
    (value) => value.fromYear === null || value.toYear === null || value.fromYear <= value.toYear,
    "invalid_period",
  );
const phone = z
  .string()
  .trim()
  .max(40)
  .regex(/^(\+?[\d\s()./-]{6,40})?$/)
  .default("");
export const pensionSearchDetailsSchema = z
  .object({
    firstName: text(80),
    lastName: text(80),
    // Names used before, for example before a marriage: funds may know them only under these.
    previousNames: optionalText(160),
    birthDate: z.iso.date(),
    sex: z.enum(["female", "male"]),
    nationality: text(80),
    avsNumber: avsNumberSchema,
    street: text(160),
    postalCode: text(16),
    city: text(120),
    country: text(80),
    phone,
    situation: pensionSearchSituationSchema,
    employers: z.array(pensionSearchEmployerSchema).max(10).default([]),
  })
  .strict()
  .refine((value) => {
    const born = Date.parse(value.birthDate);
    return born >= Date.parse("1920-01-01") && born <= Date.now() - 15 * 365.25 * 86400000;
  }, "invalid_birth_date");
export const pensionSearchSubmitInputSchema = z
  .object({
    details: pensionSearchDetailsSchema,
    // The explicit mandate box of the last step; the server records the version it showed.
    mandate: z.literal(true),
  })
  .strict();
export const pensionSearchEmailInputSchema = z.object({ email: z.email().max(240) }).strict();
export const pensionSearchCodeInputSchema = z
  .object({ code: z.string().regex(/^\d{6}$/) })
  .strict();
export const pensionSearchBrowserSchema = z.object({
  csrfToken: z.string(),
  authEnabled: z.boolean(),
  walletUrl: z.url(),
  accountEmail: z.email().nullable().default(null),
});
export const pensionSearchEmailResultSchema = z.object({
  codeStatus: z.enum(["sent", "unavailable", "not_requested"]),
  verified: z.boolean(),
});
export const pensionSearchVerifyResultSchema = z.object({
  verified: z.literal(true),
  email: z.email(),
});
export const pensionSearchSchema = z.object({
  id: pensionSearchIdSchema,
  email: z.email(),
  state: pensionSearchStateSchema,
  revision: z.number().int().nonnegative(),
  details: pensionSearchDetailsSchema,
  mandateVersion: z.string(),
  history: z.array(z.object({ state: pensionSearchStateSchema, at: z.iso.datetime() })).max(100),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const pensionSearchListSchema = z.object({
  searches: z.array(pensionSearchSchema).max(25),
  nextCursor: z.string().nullable(),
});
export const pensionSearchListQuerySchema = z
  .object({
    state: pensionSearchStateSchema.optional(),
    cursor: z.string().max(500).optional(),
  })
  .strict();
export const pensionSearchTransitionInputSchema = z
  .object({
    state: pensionSearchStateSchema.exclude(["submitted"]),
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type PensionSearch = z.infer<typeof pensionSearchSchema>;
export type PensionSearchState = z.infer<typeof pensionSearchStateSchema>;
export type PensionSearchDetails = z.infer<typeof pensionSearchDetailsSchema>;
export type PensionSearchDetailsInput = z.input<typeof pensionSearchDetailsSchema>;
export type PensionSearchEmployer = z.infer<typeof pensionSearchEmployerSchema>;
export type PensionSearchSituation = z.infer<typeof pensionSearchSituationSchema>;
export type PensionSearchSubmitInput = z.infer<typeof pensionSearchSubmitInputSchema>;
export type PensionSearchListQuery = z.infer<typeof pensionSearchListQuerySchema>;
export type PensionSearchTransitionInput = z.infer<typeof pensionSearchTransitionInputSchema>;
