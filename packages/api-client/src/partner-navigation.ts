import {
  leadViewInputSchema,
  leadViewSchema,
  leadViewsSchema,
  type LeadViewInput,
} from "@coverview/contracts/partner-navigation";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
export function createNavigationClient(request: PartnerRequest) {
  return {
    leadViews: (signal?: AbortSignal) => request("/partner/lead-views", leadViewsSchema, signal),
    saveLeadView: (input: LeadViewInput, options: PartnerMutation) =>
      request(
        "/partner/lead-views",
        leadViewSchema,
        options.signal,
        leadViewInputSchema.parse(input),
        options,
      ),
  };
}
