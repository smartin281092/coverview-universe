import { z } from "zod";
import { leadAppointmentModeSchema } from "./partner-advice.js";

export const appointmentTermsSchema = z
  .object({
    startsAt: z.iso.datetime({ offset: true }),
    durationMinutes: z.number().int().min(15).max(240),
    mode: leadAppointmentModeSchema,
    location: z.string().trim().min(3).max(1000),
    timezone: z.literal("Europe/Zurich"),
  })
  .strict();

export const appointmentTimeInputSchema = z
  .object({
    basis: z.string().regex(/^[a-f0-9]{64}$/u),
    preparationMinutes: z.number().int().min(0).max(240),
    travelBeforeMinutes: z.number().int().min(0).max(240),
    travelAfterMinutes: z.number().int().min(0).max(240),
    confirmed: z.literal(true),
  })
  .strict();
export type AppointmentTimeInput = z.infer<typeof appointmentTimeInputSchema>;
export const appointmentTimeRecordSchema = appointmentTimeInputSchema
  .omit({ confirmed: true })
  .extend({
    revision: z.number().int().positive(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    recordedAt: z.iso.datetime(),
    rescheduling: z
      .object({
        previous: appointmentTermsSchema,
        next: appointmentTermsSchema,
      })
      .optional(),
  });

// A private, point-in-time reading of an existing commitment, never a booking token.
export const appointmentAssessmentSchema = z.object({
  leadId: z.string(),
  appointmentId: z.string(),
  checkedAt: z.iso.datetime(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  mode: leadAppointmentModeSchema,
  timezone: z.string(),
  timeProtection: z
    .object({
      basis: z.string(),
      canConfirm: z.boolean(),
      current: appointmentTimeRecordSchema.nullable(),
      history: z.array(appointmentTimeRecordSchema).max(20),
      startsAt: z.iso.datetime(),
      endsAt: z.iso.datetime(),
    })
    .optional(),
  status: z.enum(["attention", "incomplete", "consistent"]),
  responsibility: z.enum(["current", "review_required"]),
  declaration: z.object({
    revision: z.number().int().positive().nullable(),
    professionalRevision: z.number().int().positive().nullable(),
    scope: z.enum(["current", "changed", "missing"]),
    mode: z.enum(["offered", "not_offered", "unspecified", "unknown"]),
    period: z.enum(["covered", "absence", "unreported", "unknown"]),
  }),
  overlappingCommitment: z.boolean(),
  client: z.object({
    preferenceRevision: z.number().int().positive().nullable(),
    mode: z.enum(["matches", "differs", "unspecified", "confirmation_required", "unlinked"]),
    requestedMode: leadAppointmentModeSchema.nullable(),
    changeRequested: z.boolean(),
  }),
  unverifiedChecks: z
    .array(
      z.enum([
        "preparation",
        "travel",
        "external_commitments",
        "capacity",
        "client_agreement",
        "eligibility",
      ]),
    )
    .max(6),
});
export type AppointmentAssessment = z.infer<typeof appointmentAssessmentSchema>;
