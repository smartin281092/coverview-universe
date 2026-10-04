import { z } from "zod";
import {
  appointmentAssessmentSchema,
  appointmentTermsSchema,
} from "./partner-appointment-assessment.js";
import {
  jointOutcomeSchema,
  jointParticipantSchema,
  jointParticipationStateSchema,
  leadAppointmentSchema,
} from "./partner.js";

const id = z.string().min(1).max(100);
const basis = z.string().regex(/^[a-f0-9]{64}$/u);
const minutes = z.number().int().min(0).max(240);
const professional = z.object({
  name: z.string().nullable(),
  organization: z.string().nullable(),
});
const declaration = appointmentAssessmentSchema.shape.declaration.shape;

// Wallet (C6b, brief I.12): one appointment as its owner sees it, who joins it and which of the
// owner's other advisors may still be invited. Availability is a yes/no: agendas stay private.
export const walletJointAppointmentSchema = z.object({
  appointmentId: id,
  leadId: id,
  appointment: appointmentTermsSchema,
  participants: z
    .array(jointParticipantSchema.extend({ leadId: id, leadTitle: z.string() }))
    .max(10),
  candidates: z
    .array(
      professional.extend({
        leadId: id,
        leadTitle: z.string(),
        status: z.enum(["available", "unavailable", "declined"]),
      }),
    )
    .max(20),
  canInvite: z.boolean(),
  basis,
});
export type WalletJointAppointment = z.infer<typeof walletJointAppointmentSchema>;
export const jointInvitationInputSchema = z
  .object({ leadId: id, basis, confirmed: z.literal(true) })
  .strict();
export type JointInvitationInput = z.infer<typeof jointInvitationInputSchema>;

// Partner and Wallet: the participations of one request in appointments hosted on another of the
// same client's requests. Each request keeps its own stage, next action and outcome.
export const jointParticipationSchema = z.object({
  id,
  appointmentId: id,
  leadId: id,
  revision: z.number().int().positive(),
  state: jointParticipationStateSchema,
  termsCurrent: z.boolean(),
  outcome: jointOutcomeSchema.nullable(),
  host: professional,
  appointment: appointmentTermsSchema,
  appointmentState: leadAppointmentSchema.shape.state,
  // Only for the invited professional: their own declaration and the bare collision fact.
  check: z
    .object({
      scope: declaration.scope,
      mode: declaration.mode,
      period: declaration.period,
      conflict: z.boolean(),
    })
    .nullable(),
  canConfirm: z.boolean(),
  canDecline: z.boolean(),
  canWithdraw: z.boolean(),
  canRecordOutcome: z.boolean(),
  basis,
});
export type JointParticipation = z.infer<typeof jointParticipationSchema>;
export const jointParticipationsSchema = z.object({
  items: z.array(jointParticipationSchema).max(20),
});
export type JointParticipations = z.infer<typeof jointParticipationsSchema>;
export const jointParticipationActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("confirm"),
      basis,
      preparationMinutes: minutes,
      travelBeforeMinutes: minutes,
      travelAfterMinutes: minutes,
      externalCommitmentsChecked: z.literal(true),
      capacityConfirmed: z.literal(true),
    })
    .strict(),
  z.object({ action: z.literal("decline"), basis }).strict(),
  z
    .object({ action: z.literal("withdraw"), basis, reason: z.string().trim().min(3).max(1000) })
    .strict(),
  z.object({ action: z.literal("outcome"), basis, outcome: jointOutcomeSchema }).strict(),
]);
export type JointParticipationAction = z.infer<typeof jointParticipationActionSchema>;
