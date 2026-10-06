import {
  accessDecisionsSchema,
  accessItemSchema,
  accessQueueSchema,
  organizationAccessSchema,
  organizationReviewInputSchema,
  restrictionInputSchema,
  type AccessFilter,
  type OrganizationReviewInput,
  type RestrictionInput,
} from "@coverview/contracts/partner-access";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
// Access decisions (C8a): CoverView restricts, reviews organisations and reads the journal; a
// member reads their own decisions and those of their organisation.
export function createAccessClient(request: PartnerRequest) {
  const id = encodeURIComponent;
  return {
    accessQueue: (filter: AccessFilter, signal?: AbortSignal) =>
      request(
        `/admin/partner/access?${new URLSearchParams({ filter })}`,
        accessQueueSchema,
        signal,
      ),
    memberDecisions: (userId: string, signal?: AbortSignal) =>
      request(`/admin/partner/applications/${id(userId)}/decisions`, accessDecisionsSchema, signal),
    restrictMember: (userId: string, input: RestrictionInput, options: PartnerMutation) =>
      request(
        `/admin/partner/applications/${id(userId)}/restrictions`,
        accessItemSchema,
        options.signal,
        restrictionInputSchema.parse(input),
        options,
      ),
    organizationAccess: (organizationId: string, signal?: AbortSignal) =>
      request(
        `/admin/partner/organizations/${id(organizationId)}`,
        organizationAccessSchema,
        signal,
      ),
    reviewOrganization: (
      organizationId: string,
      input: OrganizationReviewInput,
      options: PartnerMutation,
    ) =>
      request(
        `/admin/partner/organizations/${id(organizationId)}/review`,
        organizationAccessSchema,
        options.signal,
        organizationReviewInputSchema.parse(input),
        options,
      ),
    ownDecisions: (signal?: AbortSignal) =>
      request("/partner/access/decisions", accessDecisionsSchema, signal),
  };
}
