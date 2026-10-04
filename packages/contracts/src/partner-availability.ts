import { z } from "zod";
import { leadAppointmentModeSchema } from "./partner-advice.js";

// Match PostgreSQL timestamp(3) precision; finer inputs could round two distinct
// instants into an empty interval only after validation.
const instant = z.iso.datetime({ offset: true }).refine((value) => !/\.\d{4}/u.test(value));
export const professionalAvailabilityPeriodSchema = z
  .object({
    kind: z.enum(["available", "absent"]),
    startsAt: instant,
    endsAt: instant,
  })
  .strict()
  .refine(
    (period) => {
      const duration = Date.parse(period.endsAt) - Date.parse(period.startsAt);
      return duration > 0 && duration <= 366 * 86400000;
    },
    { message: "PARTNER_ACTION_REQUIRED" },
  );
const values = z.object({
  modes: z
    .array(leadAppointmentModeSchema)
    .max(4)
    .refine((modes) => new Set(modes).size === modes.length),
  timezone: z.literal("Europe/Zurich"),
  periods: z
    .array(professionalAvailabilityPeriodSchema)
    .max(60)
    .refine(
      (periods) =>
        !periods.some((period, index) =>
          periods
            .slice(index + 1)
            .some(
              (other) =>
                period.kind === other.kind &&
                Date.parse(period.startsAt) < Date.parse(other.endsAt) &&
                Date.parse(other.startsAt) < Date.parse(period.endsAt),
            ),
        ),
      { message: "PARTNER_APPOINTMENT_CONFLICT" },
    ),
});
export const professionalAvailabilityInputSchema = values
  .extend({
    revision: z.number().int().nonnegative(),
    professionalRevision: z.number().int().positive(),
    confirmed: z.literal(true),
  })
  .strict();
const declaration = values.extend({
  revision: z.number().int().positive(),
  professionalRevision: z.number().int().positive(),
  declaredName: z.string(),
  declaredOrganization: z.string(),
  declaredAt: z.iso.datetime(),
  professionalScope: z.enum(["current", "changed"]),
});
export const professionalAvailabilityDossierSchema = z.object({
  userId: z.string(),
  name: z.string(),
  organization: z.string(),
  professionalRevision: z.number().int().positive(),
  canDeclare: z.boolean(),
  current: declaration.nullable(),
  history: z.array(declaration).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
});
export type ProfessionalAvailabilityInput = z.infer<typeof professionalAvailabilityInputSchema>;
export type ProfessionalAvailabilityDossier = z.infer<typeof professionalAvailabilityDossierSchema>;
