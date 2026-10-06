import {
  receivedInvitationsSchema,
  teamInvitationInputSchema,
  teamRemovalInputSchema,
  teamSchema,
  type TeamInvitationInput,
  type TeamRemovalInput,
} from "@coverview/contracts/partner-team";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
// Team of an organisation's manager (C8b): invitations bound to the invited address, the team
// view, the end of a colleague's membership; the invited person sees and declines invitations.
export function createTeamClient(request: PartnerRequest) {
  const id = encodeURIComponent;
  return {
    team: (signal?: AbortSignal) => request("/partner/team", teamSchema, signal),
    inviteTeamMember: (input: TeamInvitationInput, options: PartnerMutation) =>
      request(
        "/partner/team/invitations",
        teamSchema,
        options.signal,
        teamInvitationInputSchema.parse(input),
        options,
      ),
    cancelTeamInvitation: (invitationId: string, options: PartnerMutation) =>
      request(
        `/partner/team/invitations/${id(invitationId)}/cancel`,
        teamSchema,
        options.signal,
        {},
        options,
      ),
    removeTeamMember: (userId: string, input: TeamRemovalInput, options: PartnerMutation) =>
      request(
        `/partner/team/members/${id(userId)}/removal`,
        teamSchema,
        options.signal,
        teamRemovalInputSchema.parse(input),
        options,
      ),
    receivedTeamInvitations: (signal?: AbortSignal) =>
      request("/partner/team/invitations/received", receivedInvitationsSchema, signal),
    declineTeamInvitation: (invitationId: string, options: PartnerMutation) =>
      request(
        `/partner/team/invitations/${id(invitationId)}/decline`,
        receivedInvitationsSchema,
        options.signal,
        {},
        options,
      ),
  };
}
