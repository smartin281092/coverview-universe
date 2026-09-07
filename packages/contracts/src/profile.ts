import { z } from "zod";

export const profileStepSchema = z.enum(["information", "address", "review"]);
export const profileFieldSchema = z.enum([
  "firstName",
  "lastName",
  "birthDate",
  "nationality",
  "street",
  "postalCode",
  "city",
  "country",
]);
const shortText = z.string().trim().min(1).max(160);
export const profileValuesSchema = z
  .object({
    firstName: shortText.optional(),
    lastName: shortText.optional(),
    birthDate: z.iso.date().optional(),
    nationality: shortText.optional(),
    street: z.string().trim().min(1).max(240).optional(),
    postalCode: z.string().trim().min(1).max(24).optional(),
    city: shortText.optional(),
    country: shortText.optional(),
  })
  .strict();
export const profileFieldValueSchema = z.object({
  value: z.string().max(240),
  source: z.enum(["user_entered", "user_confirmed", "document_extracted"]),
  documentSource: z.object({ documentId: z.string().max(200), extractionId: z.uuid() }).optional(),
  confidence: z.null(),
  confirmedAt: z.iso.datetime().nullable(),
  proposal: z
    .object({ value: z.string().max(240), source: z.literal("anonymous_draft") })
    .nullable(),
});
export const profileSchema = z.object({
  id: z.string().min(1).max(200),
  userId: z.string().min(1).max(200),
  revision: z.number().int().nonnegative(),
  step: profileStepSchema,
  fields: z.partialRecord(profileFieldSchema, profileFieldValueSchema),
  prefill: z.object({
    enabled: z.boolean(),
    version: z.literal("1"),
    decidedAt: z.iso.datetime().nullable(),
  }),
});
export const profileSaveInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    step: profileStepSchema,
    // Only supplied fields change. Null is an explicit owner correction/removal.
    fields: z
      .object({
        firstName: shortText.nullable().optional(),
        lastName: shortText.nullable().optional(),
        birthDate: z.iso.date().nullable().optional(),
        nationality: shortText.nullable().optional(),
        street: z.string().trim().min(1).max(240).nullable().optional(),
        postalCode: z.string().trim().min(1).max(24).nullable().optional(),
        city: shortText.nullable().optional(),
        country: shortText.nullable().optional(),
      })
      .strict(),
  })
  .strict();
export const profileConfirmInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    prefill: z.boolean(),
    version: z.literal("1"),
  })
  .strict();
export const profileDraftSchema = z.object({
  id: z.string().min(1).max(200),
  revision: z.number().int().nonnegative(),
  step: profileStepSchema,
  fields: profileValuesSchema,
  expiresAt: z.iso.datetime(),
});
export const profileDraftEntrySchema = z.object({
  csrfToken: z.string().min(1).max(512),
  draft: profileDraftSchema.nullable(),
  state: z.enum(["empty", "active", "expired", "attached"]),
});
export const profileAttachInputSchema = z
  .object({
    draftRevision: z.number().int().nonnegative(),
  })
  .strict();
export const profileAttachSchema = z.object({
  profile: profileSchema,
  resumeStep: profileStepSchema,
});
export const profileChoicesSchema = z.object({
  choices: z
    .array(
      z.object({
        purpose: z.literal("profile.prefill"),
        version: z.literal("1"),
        enabled: z.boolean(),
        decidedAt: z.iso.datetime(),
      }),
    )
    .max(20),
  nextCursor: z.string().max(200).nullable(),
});
export type Profile = z.infer<typeof profileSchema>;
export type ProfileValues = z.infer<typeof profileValuesSchema>;
export type ProfileStep = z.infer<typeof profileStepSchema>;
export type ProfileSaveInput = z.infer<typeof profileSaveInputSchema>;
export type ProfileConfirmInput = z.infer<typeof profileConfirmInputSchema>;
export type ProfileDraft = z.infer<typeof profileDraftSchema>;
