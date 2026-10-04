import {
  recommendationInputSchema,
  recommendationsSchema,
  type RecommendationInput,
} from "@coverview/contracts/partner-recommendations";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
export function createRecommendationClient(request: PartnerRequest) {
  const id = encodeURIComponent;
  return {
    recommendations: (leadId: string, signal?: AbortSignal) =>
      request(`/partner/leads/${id(leadId)}/recommendations`, recommendationsSchema, signal),
    recommend: (leadId: string, input: RecommendationInput, options: PartnerMutation) =>
      request(
        `/partner/leads/${id(leadId)}/recommendations`,
        recommendationsSchema,
        options.signal,
        recommendationInputSchema.parse(input),
        options,
      ),
  };
}
