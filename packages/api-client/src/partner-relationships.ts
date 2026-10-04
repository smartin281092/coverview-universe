import {
  leadRelationshipInputSchema,
  leadRelationshipsSchema,
  leadRelationshipCandidatesSchema,
  type LeadRelationshipInput,
} from "@coverview/contracts/partner-relationships";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
export function createRelationshipClient(request: PartnerRequest) {
  const id = encodeURIComponent;
  return {
    leadRelationships: (leadId: string, wallet = false, cursor?: string, signal?: AbortSignal) =>
      request(
        `/${wallet ? "wallet" : "partner"}/leads/${id(leadId)}/relationships${cursor ? `?cursor=${id(cursor)}` : ""}`,
        leadRelationshipsSchema,
        signal,
      ),
    leadRelationshipCandidates: (leadId: string, cursor?: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${id(leadId)}/relationship-candidates${cursor ? `?cursor=${id(cursor)}` : ""}`,
        leadRelationshipCandidatesSchema,
        signal,
      ),
    changeLeadRelationship: (
      leadId: string,
      input: LeadRelationshipInput,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${id(leadId)}/relationships`,
        leadRelationshipsSchema,
        options.signal,
        leadRelationshipInputSchema.parse(input),
        options,
      ),
  };
}
