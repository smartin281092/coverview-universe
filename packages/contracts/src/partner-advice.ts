import { z } from "zod";
import { professionalLanguageSchema, swissCantonSchema } from "./professional-practice.js";

// The same modes describe a preference and an actual appointment; neither implies the other.
export const leadAppointmentModeSchema = z.enum(["phone", "video", "office", "home"]);
const values = z.object({
  languageCode: professionalLanguageSchema.nullable(),
  mode: leadAppointmentModeSchema.nullable(),
  canton: swissCantonSchema.nullable(),
});
export const advicePreferencesInputSchema = values
  .extend({
    revision: z.number().int().nonnegative(),
    scopeRevision: z.number().int().positive(),
    profileRevision: z.number().int().nonnegative(),
    confirmed: z.literal(true),
  })
  .strict()
  .refine((input) => input.canton === null || input.mode === "office" || input.mode === "home", {
    path: ["canton"],
    message: "PARTNER_ACTION_REQUIRED",
  });
const scope = z.object({
  title: z.string(),
  category: z.string(),
  object: z.string(),
  context: z.string(),
});
const confirmation = values.extend({
  revision: z.number().int().positive(),
  scopeRevision: z.number().int().positive(),
  profileRevision: z.number().int().nonnegative(),
  confirmedAt: z.iso.datetime(),
  currentOwnerConfirmation: z.boolean(),
  scope,
});
export const advicePreferencesSchema = z.object({
  leadId: z.string(),
  profileName: z.string(),
  profileRevision: z.number().int().nonnegative().nullable(),
  scopeRevision: z.number().int().positive(),
  scope,
  revision: z.number().int().nonnegative(),
  canConfirm: z.boolean(),
  status: z.enum(["unlinked", "unset", "confirmed", "confirmation_required"]),
  current: confirmation.nullable(),
  history: z.array(confirmation).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
});
export type AdvicePreferences = z.infer<typeof advicePreferencesSchema>;
export type AdvicePreferencesInput = z.infer<typeof advicePreferencesInputSchema>;
