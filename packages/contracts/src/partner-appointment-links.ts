import { z } from "zod";
import { appointmentTermsSchema } from "./partner-appointment-assessment.js";

const ids = z
  .array(z.string().min(1).max(100))
  .min(1)
  .max(9)
  .refine((value) => new Set(value).size === value.length);
const basis = z.string().regex(/^[a-f0-9]{64}$/u);
export const appointmentLinksSelectionSchema = z.object({ leadIds: ids }).strict();
export const appointmentLinksConfirmSchema = appointmentLinksSelectionSchema
  .extend({
    basis,
    clientAgreementConfirmed: z.literal(true),
    sharedTermsConfirmed: z.literal(true),
  })
  .strict();
export const appointmentUnlinkSchema = z
  .object({
    leadId: z.string().min(1).max(100),
    revision: z.number().int().positive(),
    confirmed: z.literal(true),
  })
  .strict();
const status = z.enum(["linked", "review_required", "unlinked", "superseded"]);
export const appointmentLinksManagementSchema = z.object({
  appointment: appointmentTermsSchema,
  canLink: z.boolean(),
  candidates: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        revision: z.number().int().nonnegative(),
        status: status.nullable(),
      }),
    )
    .max(50),
  candidatesTruncated: z.boolean(),
});
export const appointmentLinksPreviewSchema = z.object({
  appointment: appointmentTermsSchema,
  targets: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        assessment: z.enum(["consistent", "incomplete", "attention"]),
      }),
    )
    .min(1)
    .max(9),
  basis,
  canConfirm: z.boolean(),
});
const record = z.object({
  id: z.string(),
  revision: z.number().int().positive(),
  status,
  recordedAt: z.iso.datetime(),
  appointment: appointmentTermsSchema,
  outcome: z
    .enum(["scheduled", "completed", "cancelled", "client_absent", "advisor_absent"])
    .nullable(),
});
// Deliberately no originating Lead, other participants, private buffers or internal evidence.
export const sharedAppointmentsSchema = z.object({
  items: z.array(record).max(100),
  history: z.array(record).max(20),
  itemsTruncated: z.boolean(),
  historyTruncated: z.boolean(),
});
export type AppointmentLinksSelection = z.infer<typeof appointmentLinksSelectionSchema>;
export type AppointmentLinksConfirm = z.infer<typeof appointmentLinksConfirmSchema>;
export type AppointmentUnlink = z.infer<typeof appointmentUnlinkSchema>;
export type AppointmentLinksPreview = z.infer<typeof appointmentLinksPreviewSchema>;
export type AppointmentLinksManagement = z.infer<typeof appointmentLinksManagementSchema>;
export type SharedAppointments = z.infer<typeof sharedAppointmentsSchema>;
