import { z } from "zod";
import { profileValuesSchema } from "./profile.js";

export const managedProfileIdSchema = z.union([
  z.literal("self"),
  z.string().regex(/^prf_[0-9a-f-]{36}$/),
]);
export const managedProfileKindSchema = z.enum(["person", "legal_entity"]);
export const profileSectionNameSchema = z.enum(["general", "finances", "health"]);
export const profileSectionStepSchema = z.enum(["information", "details", "review"]);
const money = z.number().int().nonnegative().max(1000000000000);
const note = z.string().trim().min(1).max(1000);
export const entityProfileValuesSchema = z
  .object({
    companyName: z.string().trim().min(1).max(160).optional(),
    registrationNumber: z.string().trim().min(1).max(100).optional(),
    ...profileValuesSchema.pick({
      phone: true,
      contactEmail: true,
      street: true,
      postalCode: true,
      city: true,
      country: true,
    }).shape,
  })
  .strict();
export const financialProfileValuesSchema = z
  .object({
    annualIncomeMinor: money.optional(),
    monthlyExpensesMinor: money.optional(),
    savingsMinor: money.optional(),
    debtsMinor: money.optional(),
    currency: z.enum(["CHF", "EUR", "USD"]).optional(),
  })
  .strict();
export const healthProfileValuesSchema = z
  .object({
    insurer: z.string().trim().min(1).max(160).optional(),
    primaryDoctorName: z.string().trim().min(1).max(160).optional(),
    deductibleMinor: money.optional(),
    accidentCoverage: z.enum(["yes", "no", "unknown"]).optional(),
    heightCm: z.number().positive().max(300).optional(),
    weightKg: z.number().positive().max(1000).optional(),
    smokingStatus: z.enum(["never", "former", "current"]).optional(),
    allergies: note.optional(),
    chronicConditions: note.optional(),
    ongoingTreatments: note.optional(),
  })
  .strict();
// The endpoint validates these fields again against the selected section and subject kind.
export const profileSectionValuesSchema = z
  .object({
    ...profileValuesSchema.shape,
    ...entityProfileValuesSchema.shape,
    ...financialProfileValuesSchema.shape,
    ...healthProfileValuesSchema.shape,
  })
  .strict();
const patchShape = Object.fromEntries(
  Object.entries(profileSectionValuesSchema.shape).map(([key, schema]) => [
    key,
    schema.unwrap().nullable().optional(),
  ]),
) as {
  [K in keyof typeof profileSectionValuesSchema.shape]: z.ZodOptional<
    z.ZodNullable<ReturnType<(typeof profileSectionValuesSchema.shape)[K]["unwrap"]>>
  >;
};
export const profileSectionSaveInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    step: profileSectionStepSchema,
    fields: z.object(patchShape).strict(),
    confirm: z.boolean().optional(),
  })
  .strict();
export const managedProfileSchema = z.object({
  id: managedProfileIdSchema,
  kind: managedProfileKindSchema,
  displayName: z.string().min(1).max(160),
  isSelf: z.boolean(),
  revision: z.number().int().nonnegative(),
  completion: z.object({
    general: z.number().int().min(0).max(100),
    finances: z.number().int().min(0).max(100),
    health: z.number().int().min(0).max(100).nullable(),
  }),
});
export const managedProfilesSchema = z.object({ profiles: z.array(managedProfileSchema).max(50) });
export const managedProfileCreateInputSchema = z
  .object({ kind: managedProfileKindSchema, displayName: z.string().trim().min(1).max(160) })
  .strict();
export const profileSectionSchema = z.object({
  profileId: managedProfileIdSchema,
  section: profileSectionNameSchema,
  revision: z.number().int().nonnegative(),
  step: profileSectionStepSchema,
  values: profileSectionValuesSchema,
  documentSources: z
    .record(
      z.string().max(100),
      z.object({
        documentId: z.string().regex(/^doc_[0-9a-f-]{36}$/),
        extractionId: z.uuid(),
        extractedAt: z.iso.datetime(),
      }),
    )
    .optional(),
  confirmedAt: z.iso.datetime().nullable(),
  completion: z.number().int().min(0).max(100),
});
export const managedProfileErrorCodes = [
  "MANAGED_PROFILE_NOT_FOUND",
  "MANAGED_PROFILE_CONFLICT",
  "MANAGED_PROFILE_IDEMPOTENCY_REUSED",
  "MANAGED_PROFILE_LIMIT_REACHED",
  "MANAGED_PROFILE_SECTION_UNAVAILABLE",
  "MANAGED_PROFILE_INVALID_FIELDS",
] as const;
export type ManagedProfile = z.infer<typeof managedProfileSchema>;
export type ProfileSection = z.infer<typeof profileSectionSchema>;
export type ProfileSectionValues = z.infer<typeof profileSectionValuesSchema>;
export type ProfileSectionSaveInput = z.infer<typeof profileSectionSaveInputSchema>;
export type ManagedProfileCreateInput = z.infer<typeof managedProfileCreateInputSchema>;
export type ProfileSectionName = z.infer<typeof profileSectionNameSchema>;
