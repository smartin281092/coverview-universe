import {
  clientInvitationCommandSchema,
  clientInvitationPreviewSchema,
  clientInvitationResponseSchema,
  clientInvitationsSchema,
  type ClientInvitationCommand,
  type ClientInvitationResponse,
} from "@coverview/contracts/partner-invitations";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
export function createInvitationClient(request: PartnerRequest) {
  const id = encodeURIComponent;
  return {
    clientInvitations: (leadId: string, signal?: AbortSignal) =>
      request(`/partner/leads/${id(leadId)}/client-invitations`, clientInvitationsSchema, signal),
    commandClientInvitation: (
      leadId: string,
      input: ClientInvitationCommand,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${id(leadId)}/client-invitations`,
        clientInvitationsSchema,
        options.signal,
        clientInvitationCommandSchema.parse(input),
        options,
      ),
    // POST keeps the token out of URLs, server logs and browser history.
    previewClientInvitation: (token: string, options: PartnerMutation) =>
      request(
        "/wallet/client-invitations/preview",
        clientInvitationPreviewSchema,
        options.signal,
        { token },
        options,
      ),
    respondClientInvitation: (input: ClientInvitationResponse, options: PartnerMutation) =>
      request(
        "/wallet/client-invitations/respond",
        clientInvitationPreviewSchema,
        options.signal,
        clientInvitationResponseSchema.parse(input),
        options,
      ),
  };
}
