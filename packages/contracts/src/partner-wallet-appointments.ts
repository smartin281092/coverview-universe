import { z } from "zod";
import { appointmentTermsSchema } from "./partner-appointment-assessment.js";

export const walletAppointmentCancellationSchema = z
  .object({
    basis: z.string().regex(/^[a-f0-9]{64}$/u),
    reason: z.string().trim().min(2).max(1000),
    confirmed: z.literal(true),
  })
  .strict();
export type WalletAppointmentCancellation = z.infer<typeof walletAppointmentCancellationSchema>;

// The client sees the commitment, never the advisor's private planning evidence.
export const walletAppointmentSchema = z
  .object({
    appointmentId: z.string(),
    leadId: z.string(),
    advisorName: z.string().nullable(),
    appointment: appointmentTermsSchema,
    state: z.enum(["scheduled", "completed", "cancelled", "client_absent", "advisor_absent"]),
    basis: z.string(),
    canCancel: z.boolean(),
  })
  .strict();
export type WalletAppointment = z.infer<typeof walletAppointmentSchema>;
