import {
  organizationProfileDossierSchema,
  organizationProfileInputSchema,
  organizationProfileQueueSchema,
  profileDossierSchema,
  profileReviewSchema,
  type OrganizationProfileInput,
  type ProfileReview,
} from "@coverview/contracts/partner-profiles";
import type { PartnerMutation, PartnerPicture, PartnerRequest } from "./partner-transport.js";
// Profile photo and organisation profile (C8c). Pictures are fetched as blobs: the API serves them
// as attachments, and the caller types them with the MIME type the profile states.
export function createPictureClient(request: PartnerRequest, picture: PartnerPicture) {
  const id = encodeURIComponent;
  const surface = (wallet: boolean) => (wallet ? "/wallet" : "/partner");
  return {
    uploadProfilePhoto: (userId: string, file: Blob, options: PartnerMutation) =>
      request(
        `/partner/profiles/${id(userId)}/photo/content`,
        profileDossierSchema,
        options.signal,
        file,
        options,
        true,
      ),
    retryProfilePhoto: (userId: string, documentRevision: number, options: PartnerMutation) =>
      request(
        `/partner/profiles/${id(userId)}/photo/retry`,
        profileDossierSchema,
        options.signal,
        { documentRevision },
        options,
      ),
    profileVersionPhoto: (userId: string, revision: number, signal?: AbortSignal) =>
      picture(`/partner/profiles/${id(userId)}/versions/${revision}/photo`, signal),
    advisorPhoto: (userId: string, wallet = false, signal?: AbortSignal) =>
      picture(`${surface(wallet)}/advisors/${id(userId)}/photo`, signal),
    advisorOrganizationLogo: (userId: string, wallet = false, signal?: AbortSignal) =>
      picture(`${surface(wallet)}/advisors/${id(userId)}/organization-logo`, signal),
    organizationProfile: (organizationId: string, signal?: AbortSignal) =>
      request(
        `/partner/organizations/${id(organizationId)}/profile`,
        organizationProfileDossierSchema,
        signal,
      ),
    submitOrganizationProfile: (
      organizationId: string,
      input: OrganizationProfileInput,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/organizations/${id(organizationId)}/profile`,
        organizationProfileDossierSchema,
        options.signal,
        organizationProfileInputSchema.parse(input),
        options,
      ),
    withdrawOrganizationProfile: (
      organizationId: string,
      reason: string,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/organizations/${id(organizationId)}/profile/withdraw`,
        organizationProfileDossierSchema,
        options.signal,
        { reason },
        options,
      ),
    uploadOrganizationLogo: (organizationId: string, file: Blob, options: PartnerMutation) =>
      request(
        `/partner/organizations/${id(organizationId)}/logo/content`,
        organizationProfileDossierSchema,
        options.signal,
        file,
        options,
        true,
      ),
    retryOrganizationLogo: (
      organizationId: string,
      documentRevision: number,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/organizations/${id(organizationId)}/logo/retry`,
        organizationProfileDossierSchema,
        options.signal,
        { documentRevision },
        options,
      ),
    organizationVersionLogo: (organizationId: string, revision: number, signal?: AbortSignal) =>
      picture(`/partner/organizations/${id(organizationId)}/versions/${revision}/logo`, signal),
    organizationProfileQueue: (signal?: AbortSignal) =>
      request("/admin/partner/organization-profiles", organizationProfileQueueSchema, signal),
    reviewOrganizationProfile: (
      organizationId: string,
      input: ProfileReview,
      options: PartnerMutation,
    ) =>
      request(
        `/admin/partner/organizations/${id(organizationId)}/profile/review`,
        organizationProfileDossierSchema,
        options.signal,
        profileReviewSchema.parse(input),
        options,
      ),
  };
}
