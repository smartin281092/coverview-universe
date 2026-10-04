import { leadMatchingSchema } from "@coverview/contracts/partner-matching";
import type { PartnerRequest } from "./partner-transport.js";
export function createMatchingClient(request: PartnerRequest) {
  return {
    leadMatching: (leadId: string, signal?: AbortSignal) =>
      request(`/partner/leads/${encodeURIComponent(leadId)}/matching`, leadMatchingSchema, signal),
  };
}
