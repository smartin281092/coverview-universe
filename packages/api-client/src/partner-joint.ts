import {
  jointInvitationInputSchema,
  jointParticipationActionSchema,
  jointParticipationsSchema,
  walletJointAppointmentSchema,
  type JointInvitationInput,
  type JointParticipationAction,
} from "@coverview/contracts/partner-joint";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
// Joint appointment (C6b): the Wallet owner invites, the invited professional decides.
export function createJointAppointmentClient(request: PartnerRequest) {
  const id = encodeURIComponent;
  return {
    walletJointAppointment: (leadId: string, appointmentId: string, signal?: AbortSignal) =>
      request(
        `/wallet/leads/${id(leadId)}/appointments/${id(appointmentId)}/joint`,
        walletJointAppointmentSchema,
        signal,
      ),
    inviteJointParticipant: (
      leadId: string,
      appointmentId: string,
      input: JointInvitationInput,
      options: PartnerMutation,
    ) =>
      request(
        `/wallet/leads/${id(leadId)}/appointments/${id(appointmentId)}/joint/invitations`,
        walletJointAppointmentSchema,
        options.signal,
        jointInvitationInputSchema.parse(input),
        options,
      ),
    jointParticipations: (leadId: string, signal?: AbortSignal, wallet = false) =>
      request(
        `/${wallet ? "wallet" : "partner"}/leads/${id(leadId)}/participations`,
        jointParticipationsSchema,
        signal,
      ),
    decideJointParticipation: (
      leadId: string,
      participationId: string,
      input: JointParticipationAction,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${id(leadId)}/participations/${id(participationId)}`,
        jointParticipationsSchema,
        options.signal,
        jointParticipationActionSchema.parse(input),
        options,
      ),
  };
}
