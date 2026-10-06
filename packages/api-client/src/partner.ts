import { z } from "zod";
import { createQualityClient } from "./partner-quality.js";
import { createConclusionClient } from "./partner-conclusion.js";
import { createRelationshipClient } from "./partner-relationships.js";
import { createMatchingClient } from "./partner-matching.js";
import { createProfileClient } from "./partner-profiles.js";
import { createInvitationClient } from "./partner-invitations.js";
import { createRecommendationClient } from "./partner-recommendations.js";
import { createJointAppointmentClient } from "./partner-joint.js";
import { createDataRightsClient } from "./partner-data.js";
import { createAccessClient } from "./partner-access.js";
import { createOverviewClient } from "./partner-overview.js";
import { createNavigationClient } from "./partner-navigation.js";
import { createCommunicationClient } from "./partner-communications.js";
import { createPilotageClient } from "./partner-pilotage.js";
import {
  commercialInputSchema,
  commercialReviewSchema,
  commercialConditionSchema,
  commercialListSchema,
  marketQuerySchema,
  marketPublicationSchema,
  marketApplicationInputSchema,
  marketReservationInputSchema,
  marketDecisionSchema,
  marketMandateInputSchema,
  marketDetailSchema,
  marketListSchema,
  marketReservationSchema,
  marketMandatesSchema,
  economyCaseInputSchema,
  economyRecordSchema,
  economyCaseSchema,
  economyCasesSchema,
  economyAgreementsSchema,
} from "@coverview/contracts/partner-economy";
import {
  walletAppointmentSchema,
  bookingProposalsSchema,
  bookingProposalInputSchema,
  bookingChoiceSchema,
  bookingWithdrawalSchema,
  coordinatedBookingInputSchema,
  coordinatedBookingReceiptSchema,
  type CoordinatedBookingInput,
  counselRequestInputSchema,
  counselActionInputSchema,
  counselRequestSchema,
  counselPersonalSchema,
  counselQueueSchema,
  counselCandidatesSchema,
  type CounselRequestInput,
  type CounselActionInput,
  type BookingProposalInput,
  type BookingChoice,
  walletAppointmentCancellationSchema,
  type WalletAppointmentCancellation,
  appointmentLinksManagementSchema,
  appointmentLinksPreviewSchema,
  appointmentLinksSelectionSchema,
  appointmentLinksConfirmSchema,
  appointmentUnlinkSchema,
  sharedAppointmentsSchema,
  type AppointmentLinksSelection,
  type AppointmentLinksConfirm,
  type AppointmentUnlink,
  leadCommandSchema,
  leadCreateInputSchema,
  leadDetailSchema,
  leadListSchema,
  leadListQuerySchema,
  partnerContextSchema,
  partnerApplicationInputSchema,
  partnerApplicationsSchema,
  partnerReviewInputSchema,
  partnerApplicationSchema,
  partnerDirectorySchema,
  partnerDashboardSchema,
  offerExtractionSchema,
  offerHistorySchema,
  partnerWorkSchema,
  partnerNotificationQuerySchema,
  partnerNotificationsSchema,
  partnerContinuitySettingsSchema,
  partnerContinuityUpdateSchema,
  collaborationListSchema,
  collaborationResponseSchema,
  collaborationSchema,
  insuranceLeadConsentSchema,
  insuranceLeadLinksSchema,
  insuranceLeadSourceSchema,
  contractCandidatesSchema,
  finalPoliciesSchema,
  offerImportInputSchema,
  offerImportRetrySchema,
  offerImportsSchema,
  offerImportResultSchema,
  referentProfileSchema,
  referentUpdateSchema,
  competenceDossierSchema,
  competenceDeclarationSchema,
  competenceDecisionSchema,
  type CompetenceDeclaration,
  type CompetenceDecision,
  conventionDossierSchema,
  conventionDeclarationSchema,
  conventionDecisionSchema,
  professionalAvailabilityInputSchema,
  professionalAvailabilityDossierSchema,
  professionalPracticeInputSchema,
  professionalPracticeDossierSchema,
  advicePreferencesSchema,
  advisorAssessmentSchema,
  needExpertiseEvidenceSchema,
  solutionBindingDossierSchema,
  distributionReviewInputSchema,
  distributionReviewDossierSchema,
  type DistributionReviewInput,
  solutionClausesInputSchema,
  solutionClausesDossierSchema,
  type SolutionClausesInput,
  solutionBindingInputSchema,
  type SolutionBindingInput,
  solutionEvidenceSchema,
  boundSolutionEvidenceSchema,
  solutionEvidenceQuerySchema,
  type SolutionEvidenceQuery,
  capacityAdvisorAssessmentSchema,
  sharedReferentAssessmentSchema,
  needExpertiseInputSchema,
  needExpertiseDossierSchema,
  needConflictInputSchema,
  needConflictDossierSchema,
  type NeedExpertiseInput,
  type NeedConflictInput,
  needCapacityInputSchema,
  needCapacityDossierSchema,
  type NeedCapacityInput,
  capacityInputSchema,
  capacityDossierSchema,
  type CapacityInput,
  sharedModesInputSchema,
  sharedModesDossierSchema,
  type SharedModesInput,
  advicePreferencesInputSchema,
  appointmentAssessmentSchema,
  appointmentTimeInputSchema,
  personalAppointmentProposalSchema,
  personalAppointmentPreviewSchema,
  personalAppointmentConfirmSchema,
  type PersonalAppointmentProposal,
  type PersonalAppointmentConfirm,
  type AppointmentTimeInput,
  type AdvicePreferencesInput,
  type ProfessionalAvailabilityInput,
  type ProfessionalPracticeInput,
  type ConventionDeclaration,
  type ConventionDecision,
  type ReferentUpdate,
  type CollaborationResponse,
  type PartnerContinuityUpdate,
  type PartnerNotificationQuery,
  type LeadCreateInput,
  type LeadCommand,
  type LeadListQuery,
} from "@coverview/contracts/partner";
export type {
  LeadDetail,
  LeadSummary,
  LeadStage,
  LeadOffer,
  PartnerApplication,
  PartnerContext,
} from "@coverview/contracts/partner";
export class PartnerApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}
import type { PartnerMutation } from "./partner-transport.js";
export type { PartnerMutation } from "./partner-transport.js";
export function createPartnerClient(baseUrl: string) {
  const base = new URL(baseUrl);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password)
    throw new Error("Invalid API URL");
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
    body?: unknown,
    options?: PartnerMutation,
    binary = false,
  ) {
    const response = await fetch(new URL(path, base), {
      method: body === undefined ? "GET" : "POST",
      credentials: "include",
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([AbortSignal.timeout(binary ? 60000 : 20000), signal])
        : AbortSignal.timeout(binary ? 60000 : 20000),
      headers: {
        Accept: "application/json",
        ...(body === undefined
          ? {}
          : {
              "Content-Type": binary ? "application/octet-stream" : "application/json",
              "X-CSRF-Token": options?.csrfToken ?? "",
              "Idempotency-Key": options?.idempotencyKey ?? "",
            }),
      },
      ...(body === undefined ? {} : { body: binary ? (body as File) : JSON.stringify(body) }),
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const parsed = z.object({ error: z.object({ code: z.string() }) }).safeParse(payload);
      throw new PartnerApiError(
        parsed.success ? parsed.data.error.code : "PARTNER_UNAVAILABLE",
        response.status,
      );
    }
    return schema.parse(payload);
  }
  const path = (wallet = false) => (wallet ? "/wallet/leads" : "/partner/leads");
  const economyPath = (root: string, id: string) => `${root}/${encodeURIComponent(id)}`;
  const economyPage = (cursor?: string) => (cursor ? `?cursor=${encodeURIComponent(cursor)}` : "");
  return {
    ...createQualityClient(request),
    ...createConclusionClient(request, base),
    ...createRelationshipClient(request),
    ...createMatchingClient(request),
    ...createProfileClient(request),
    ...createInvitationClient(request),
    ...createRecommendationClient(request),
    ...createJointAppointmentClient(request),
    ...createDataRightsClient(request),
    ...createAccessClient(request),
    ...createOverviewClient(request),
    ...createNavigationClient(request),
    ...createCommunicationClient(request),
    ...createPilotageClient(request),
    economyAgreements: (cursor?: string, signal?: AbortSignal) =>
      request("/partner/economy/agreements" + economyPage(cursor), economyAgreementsSchema, signal),
    economyCases: (cursor?: string, signal?: AbortSignal) =>
      request("/partner/economy/cases" + economyPage(cursor), economyCasesSchema, signal),
    economyCase: (id: string, cursor?: string, signal?: AbortSignal) =>
      request(
        economyPath("/partner/economy/cases", id) + economyPage(cursor),
        economyCaseSchema,
        signal,
      ),
    createEconomyCase: (input: z.infer<typeof economyCaseInputSchema>, options: PartnerMutation) =>
      request(
        "/partner/economy/cases",
        economyCaseSchema,
        options.signal,
        economyCaseInputSchema.parse(input),
        options,
      ),
    recordEconomy: (
      id: string,
      input: z.infer<typeof economyRecordSchema>,
      options: PartnerMutation,
    ) =>
      request(
        economyPath("/partner/economy/cases", id) + "/entries",
        economyCaseSchema,
        options.signal,
        economyRecordSchema.parse(input),
        options,
      ),
    commercialConditions: (cursor?: string, signal?: AbortSignal) =>
      request("/partner/commercial-conditions" + economyPage(cursor), commercialListSchema, signal),
    createCommercialCondition: (
      input: z.infer<typeof commercialInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        "/partner/commercial-conditions",
        commercialConditionSchema,
        options.signal,
        commercialInputSchema.parse(input),
        options,
      ),
    reviewCommercialCondition: (
      id: string,
      input: z.infer<typeof commercialReviewSchema>,
      options: PartnerMutation,
    ) =>
      request(
        economyPath("/partner/commercial-conditions", id) + "/reviews",
        commercialConditionSchema,
        options.signal,
        commercialReviewSchema.parse(input),
        options,
      ),
    marketplace: (query: z.input<typeof marketQuerySchema>, signal?: AbortSignal) => {
      const parsed = marketQuerySchema.parse(query);
      return request(
        "/partner/marketplace?" +
          new URLSearchParams({
            view: parsed.view,
            ...(parsed.cursor ? { cursor: parsed.cursor } : {}),
          }).toString(),
        marketListSchema,
        signal,
      );
    },
    marketDetail: (id: string, cursor?: string, signal?: AbortSignal) =>
      request(
        economyPath("/partner/marketplace", id) + economyPage(cursor),
        marketDetailSchema,
        signal,
      ),
    publishMarket: (
      id: string,
      input: z.infer<typeof marketPublicationSchema>,
      options: PartnerMutation,
    ) =>
      request(
        economyPath("/partner/leads", id) + "/marketplace",
        marketDetailSchema,
        options.signal,
        marketPublicationSchema.parse(input),
        options,
      ),
    applyMarket: (
      id: string,
      input: z.infer<typeof marketApplicationInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        economyPath("/partner/marketplace", id) + "/applications",
        marketDetailSchema,
        options.signal,
        marketApplicationInputSchema.parse(input),
        options,
      ),
    withdrawMarketApplication: (id: string, options: PartnerMutation) =>
      request(
        economyPath("/partner/marketplace", id) + "/applications/withdraw",
        marketDetailSchema,
        options.signal,
        {},
        options,
      ),
    reserveMarket: (
      id: string,
      input: z.infer<typeof marketReservationInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        economyPath("/partner/marketplace", id) + "/reservations",
        marketDetailSchema,
        options.signal,
        marketReservationInputSchema.parse(input),
        options,
      ),
    withdrawMarket: (id: string, reason: string, options: PartnerMutation) =>
      request(
        economyPath("/partner/marketplace", id) + "/withdraw",
        marketDetailSchema,
        options.signal,
        { reason },
        options,
      ),
    decideMarket: (
      id: string,
      input: z.infer<typeof marketDecisionSchema>,
      options: PartnerMutation,
    ) =>
      request(
        economyPath("/partner/market-reservations", id) + "/decision",
        marketReservationSchema,
        options.signal,
        marketDecisionSchema.parse(input),
        options,
      ),
    marketMandates: (leadId: string, cursor?: string, signal?: AbortSignal) =>
      request(
        economyPath("/wallet/leads", leadId) + "/market-mandates" + economyPage(cursor),
        marketMandatesSchema,
        signal,
      ),
    decideMarketMandate: (
      id: string,
      input: z.infer<typeof marketMandateInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        economyPath("/wallet/market-reservations", id) + "/mandate",
        marketReservationSchema,
        options.signal,
        marketMandateInputSchema.parse(input),
        options,
      ),
    distributionReview: (
      leadId: string,
      offerId: string,
      companyId: string,
      beforeRevision?: number,
      signal?: AbortSignal,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/distribution-review/${encodeURIComponent(companyId)}?${new URLSearchParams({ ...(beforeRevision ? { beforeRevision: String(beforeRevision) } : {}) })}`,
        distributionReviewDossierSchema,
        signal,
      ),
    recordDistributionReview: (
      leadId: string,
      offerId: string,
      companyId: string,
      input: DistributionReviewInput,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/distribution-review/${encodeURIComponent(companyId)}`,
        distributionReviewDossierSchema,
        options.signal,
        distributionReviewInputSchema.parse(input),
        options,
      ),
    solutionClauses: (
      leadId: string,
      offerId: string,
      companyId: string,
      beforeRevision?: number,
      signal?: AbortSignal,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/solution-clauses/${encodeURIComponent(companyId)}?${new URLSearchParams({ ...(beforeRevision ? { beforeRevision: String(beforeRevision) } : {}) })}`,
        solutionClausesDossierSchema,
        signal,
      ),
    recordSolutionClauses: (
      leadId: string,
      offerId: string,
      companyId: string,
      input: SolutionClausesInput,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/solution-clauses/${encodeURIComponent(companyId)}`,
        solutionClausesDossierSchema,
        options.signal,
        solutionClausesInputSchema.parse(input),
        options,
      ),
    solutionBinding: (
      leadId: string,
      offerId: string,
      beforeRevision?: number,
      signal?: AbortSignal,
      sourcePage?: number,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/solution-binding?${new URLSearchParams({ ...(beforeRevision ? { beforeRevision: String(beforeRevision) } : {}), ...(sourcePage ? { sourcePage: String(sourcePage) } : {}) })}`,
        solutionBindingDossierSchema,
        signal,
      ),
    recordSolutionBinding: (
      leadId: string,
      offerId: string,
      input: SolutionBindingInput,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/solution-binding`,
        solutionBindingDossierSchema,
        options.signal,
        solutionBindingInputSchema.parse(input),
        options,
      ),
    referentAssessment: (leadId: string, wallet = false, signal?: AbortSignal) =>
      request(
        `${path(wallet)}/${encodeURIComponent(leadId)}/referent-assessment?version=2`,
        sharedReferentAssessmentSchema,
        signal,
      ),
    needExpertise: (leadId: string, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/expertise-review${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        needExpertiseDossierSchema,
        signal,
      ),
    decideNeedExpertise: (leadId: string, input: NeedExpertiseInput, options: PartnerMutation) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/expertise-review`,
        needExpertiseDossierSchema,
        options.signal,
        needExpertiseInputSchema.parse(input),
        options,
      ),
    needConflict: (leadId: string, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/conflict-review${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        needConflictDossierSchema,
        signal,
      ),
    decideNeedConflict: (leadId: string, input: NeedConflictInput, options: PartnerMutation) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/conflict-review`,
        needConflictDossierSchema,
        options.signal,
        needConflictInputSchema.parse(input),
        options,
      ),
    needCapacity: (leadId: string, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/capacity-decision${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        needCapacityDossierSchema,
        signal,
      ),
    decideNeedCapacity: (leadId: string, input: NeedCapacityInput, options: PartnerMutation) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/capacity-decision`,
        needCapacityDossierSchema,
        options.signal,
        needCapacityInputSchema.parse(input),
        options,
      ),
    capacity: (userId: string, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `/partner/capacity/${encodeURIComponent(userId)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        capacityDossierSchema,
        signal,
      ),
    declareCapacity: (userId: string, input: CapacityInput, options: PartnerMutation) =>
      request(
        `/partner/capacity/${encodeURIComponent(userId)}`,
        capacityDossierSchema,
        options.signal,
        capacityInputSchema.parse(input),
        options,
      ),
    sharedModes: (userId: string, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `/partner/shared-modes/${encodeURIComponent(userId)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        sharedModesDossierSchema,
        signal,
      ),
    declareSharedModes: (userId: string, input: SharedModesInput, options: PartnerMutation) =>
      request(
        `/partner/shared-modes/${encodeURIComponent(userId)}`,
        sharedModesDossierSchema,
        options.signal,
        sharedModesInputSchema.parse(input),
        options,
      ),
    advisorCapacityAssessment: (leadId: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/advisor-assessment?version=2`,
        capacityAdvisorAssessmentSchema,
        signal,
      ),
    advisorAssessment: (leadId: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/advisor-assessment`,
        advisorAssessmentSchema,
        signal,
      ),
    boundSolutionEvidence: (
      leadId: string,
      offerId: string,
      query: SolutionEvidenceQuery = {},
      signal?: AbortSignal,
    ) => {
      const { companyId } = solutionEvidenceQuerySchema.parse(query);
      return request(
        `/partner/leads/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/solution-evidence?version=2${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ""}`,
        boundSolutionEvidenceSchema,
        signal,
      );
    },
    solutionEvidence: (
      leadId: string,
      offerId: string,
      query: SolutionEvidenceQuery = {},
      signal?: AbortSignal,
    ) => {
      const { companyId } = solutionEvidenceQuerySchema.parse(query);
      return request(
        `/partner/leads/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/solution-evidence${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ""}`,
        solutionEvidenceSchema,
        signal,
      );
    },
    needExpertiseEvidence: (leadId: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/expertise-evidence`,
        needExpertiseEvidenceSchema,
        signal,
      ),
    sharedAppointments: (id: string, signal?: AbortSignal, wallet = false) =>
      request(
        `${path(wallet)}/${encodeURIComponent(id)}/shared-appointments`,
        sharedAppointmentsSchema,
        signal,
      ),
    appointmentLinks: (id: string, appointmentId: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/appointments/${encodeURIComponent(appointmentId)}/links`,
        appointmentLinksManagementSchema,
        signal,
      ),
    previewAppointmentLinks: (
      id: string,
      appointmentId: string,
      input: AppointmentLinksSelection,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/appointments/${encodeURIComponent(appointmentId)}/links/preview`,
        appointmentLinksPreviewSchema,
        options.signal,
        appointmentLinksSelectionSchema.parse(input),
        options,
      ),
    confirmAppointmentLinks: (
      id: string,
      appointmentId: string,
      input: AppointmentLinksConfirm,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/appointments/${encodeURIComponent(appointmentId)}/links/confirm`,
        appointmentLinksManagementSchema,
        options.signal,
        appointmentLinksConfirmSchema.parse(input),
        options,
      ),
    unlinkAppointment: (
      id: string,
      appointmentId: string,
      input: AppointmentUnlink,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/appointments/${encodeURIComponent(appointmentId)}/links/unlink`,
        appointmentLinksManagementSchema,
        options.signal,
        appointmentUnlinkSchema.parse(input),
        options,
      ),
    walletAppointment: (leadId: string, appointmentId: string, signal?: AbortSignal) =>
      request(
        `/wallet/leads/${encodeURIComponent(leadId)}/appointments/${encodeURIComponent(appointmentId)}/cancellation`,
        walletAppointmentSchema,
        signal,
      ),
    bookingProposals: (id: string, wallet = false, signal?: AbortSignal) =>
      request(
        `/${wallet ? "wallet" : "partner"}/leads/${encodeURIComponent(id)}/booking-proposals`,
        bookingProposalsSchema,
        signal,
      ),
    counselPersonal: (id: string, cursor?: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/counsel${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        counselPersonalSchema,
        signal,
      ),
    requestCounsel: (id: string, input: CounselRequestInput, options: PartnerMutation) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/counsel`,
        counselRequestSchema,
        options.signal,
        counselRequestInputSchema.parse(input),
        options,
      ),
    counselRequest: (id: string, signal?: AbortSignal) =>
      request(`/partner/counsel/${encodeURIComponent(id)}`, counselRequestSchema, signal),
    actCounsel: (id: string, input: CounselActionInput, options: PartnerMutation) =>
      request(
        `/partner/counsel/${encodeURIComponent(id)}/actions`,
        counselRequestSchema,
        options.signal,
        counselActionInputSchema.parse(input),
        options,
      ),
    counselQueue: (cursor?: string, signal?: AbortSignal) =>
      request(
        `/admin/partner/counsel${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        counselQueueSchema,
        signal,
      ),
    counselCandidates: (id: string, cursor?: string, signal?: AbortSignal) =>
      request(
        `/admin/partner/counsel/${encodeURIComponent(id)}/candidates${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        counselCandidatesSchema,
        signal,
      ),
    reserveCoordinatedBookings: (input: CoordinatedBookingInput, options: PartnerMutation) =>
      request(
        "/wallet/coordinated-bookings",
        coordinatedBookingReceiptSchema,
        options.signal,
        coordinatedBookingInputSchema.parse(input),
        options,
      ),
    proposeBooking: (id: string, input: BookingProposalInput, options: PartnerMutation) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/booking-proposals`,
        bookingProposalsSchema,
        options.signal,
        bookingProposalInputSchema.parse(input),
        options,
      ),
    withdrawBooking: (id: string, proposalId: string, options: PartnerMutation) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/booking-proposals/${encodeURIComponent(proposalId)}/withdraw`,
        bookingProposalsSchema,
        options.signal,
        bookingWithdrawalSchema.parse({ confirmed: true }),
        options,
      ),
    reserveBooking: (
      id: string,
      proposalId: string,
      input: BookingChoice,
      options: PartnerMutation,
    ) =>
      request(
        `/wallet/leads/${encodeURIComponent(id)}/booking-proposals/${encodeURIComponent(proposalId)}/reserve`,
        bookingProposalsSchema,
        options.signal,
        bookingChoiceSchema.parse(input),
        options,
      ),
    cancelWalletAppointment: (
      leadId: string,
      appointmentId: string,
      input: WalletAppointmentCancellation,
      options: PartnerMutation,
    ) =>
      request(
        `/wallet/leads/${encodeURIComponent(leadId)}/appointments/${encodeURIComponent(appointmentId)}/cancellation`,
        walletAppointmentSchema,
        options.signal,
        walletAppointmentCancellationSchema.parse(input),
        options,
      ),
    previewPersonalRescheduling: (
      leadId: string,
      appointmentId: string,
      input: PersonalAppointmentProposal,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/appointments/${encodeURIComponent(appointmentId)}/rescheduling/preview`,
        personalAppointmentPreviewSchema,
        options.signal,
        personalAppointmentProposalSchema.parse(input),
        options,
      ),
    confirmPersonalRescheduling: (
      leadId: string,
      appointmentId: string,
      input: PersonalAppointmentConfirm,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/appointments/${encodeURIComponent(appointmentId)}/rescheduling/confirm`,
        leadDetailSchema,
        options.signal,
        personalAppointmentConfirmSchema.parse(input),
        options,
      ),
    previewPersonalAppointment: (
      leadId: string,
      input: PersonalAppointmentProposal,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/personal-appointments/preview`,
        personalAppointmentPreviewSchema,
        options.signal,
        personalAppointmentProposalSchema.parse(input),
        options,
      ),
    confirmPersonalAppointment: (
      leadId: string,
      input: PersonalAppointmentConfirm,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/personal-appointments/confirm`,
        leadDetailSchema,
        options.signal,
        personalAppointmentConfirmSchema.parse(input),
        options,
      ),
    protectAppointmentTime: (
      leadId: string,
      appointmentId: string,
      input: AppointmentTimeInput,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/appointments/${encodeURIComponent(appointmentId)}/time-protection`,
        appointmentAssessmentSchema,
        options.signal,
        appointmentTimeInputSchema.parse(input),
        options,
      ),
    appointmentAssessment: (leadId: string, appointmentId: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/appointments/${encodeURIComponent(appointmentId)}/assessment`,
        appointmentAssessmentSchema,
        signal,
      ),
    advicePreferences: (
      id: string,
      beforeRevision?: number,
      signal?: AbortSignal,
      wallet = false,
    ) =>
      request(
        `${path(wallet)}/${encodeURIComponent(id)}/advice-preferences${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        advicePreferencesSchema,
        signal,
      ),
    confirmAdvicePreferences: (
      id: string,
      input: AdvicePreferencesInput,
      options: PartnerMutation,
    ) =>
      request(
        `${path(true)}/${encodeURIComponent(id)}/advice-preferences`,
        advicePreferencesSchema,
        options.signal,
        advicePreferencesInputSchema.parse(input),
        options,
      ),
    practice: (userId: string, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `/partner/practice/${encodeURIComponent(userId)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        professionalPracticeDossierSchema,
        signal,
      ),
    declarePractice: (userId: string, input: ProfessionalPracticeInput, options: PartnerMutation) =>
      request(
        `/partner/practice/${encodeURIComponent(userId)}`,
        professionalPracticeDossierSchema,
        options.signal,
        professionalPracticeInputSchema.parse(input),
        options,
      ),
    availability: (userId: string, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `/partner/availability/${encodeURIComponent(userId)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        professionalAvailabilityDossierSchema,
        signal,
      ),
    declareAvailability: (
      userId: string,
      input: ProfessionalAvailabilityInput,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/availability/${encodeURIComponent(userId)}`,
        professionalAvailabilityDossierSchema,
        options.signal,
        professionalAvailabilityInputSchema.parse(input),
        options,
      ),
    competence: (userId: string, category: string, beforeRevision?: number, signal?: AbortSignal) =>
      request(
        `/partner/competence/${encodeURIComponent(userId)}/${encodeURIComponent(category)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        competenceDossierSchema,
        signal,
      ),
    declareCompetence: (
      userId: string,
      category: string,
      input: CompetenceDeclaration,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/competence/${encodeURIComponent(userId)}/${encodeURIComponent(category)}`,
        competenceDossierSchema,
        options.signal,
        competenceDeclarationSchema.parse(input),
        options,
      ),
    decideCompetence: (
      userId: string,
      category: string,
      input: CompetenceDecision,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/competence/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/decisions`,
        competenceDossierSchema,
        options.signal,
        competenceDecisionSchema.parse(input),
        options,
      ),
    uploadCompetence: (
      userId: string,
      category: string,
      id: string,
      file: File,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/competence/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/${encodeURIComponent(id)}/content`,
        competenceDossierSchema,
        options.signal,
        file,
        options,
        true,
      ),
    retryCompetence: (
      userId: string,
      category: string,
      id: string,
      revision: number,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/competence/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/${encodeURIComponent(id)}/retry`,
        competenceDossierSchema,
        options.signal,
        { revision },
        options,
      ),
    competenceSourceUrl: (userId: string, category: string, id: string) =>
      new URL(
        `/partner/competence/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/${encodeURIComponent(id)}/source`,
        base,
      ).href,
    convention: (
      userId: string,
      category: string,
      companyId: string,
      beforeRevision?: number,
      signal?: AbortSignal,
    ) =>
      request(
        `/partner/convention/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/${encodeURIComponent(companyId)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        conventionDossierSchema,
        signal,
      ),
    declareConvention: (
      userId: string,
      category: string,
      companyId: string,
      input: ConventionDeclaration,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/convention/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/${encodeURIComponent(companyId)}`,
        conventionDossierSchema,
        options.signal,
        conventionDeclarationSchema.parse(input),
        options,
      ),
    decideConvention: (
      userId: string,
      category: string,
      companyId: string,
      input: ConventionDecision,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/convention/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/${encodeURIComponent(companyId)}/decisions`,
        conventionDossierSchema,
        options.signal,
        conventionDecisionSchema.parse(input),
        options,
      ),
    uploadConvention: (
      userId: string,
      category: string,
      companyId: string,
      id: string,
      file: File,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/convention/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/${encodeURIComponent(companyId)}/${encodeURIComponent(id)}/content`,
        conventionDossierSchema,
        options.signal,
        file,
        options,
        true,
      ),
    retryConvention: (
      userId: string,
      category: string,
      companyId: string,
      id: string,
      revision: number,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/convention/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/${encodeURIComponent(companyId)}/${encodeURIComponent(id)}/retry`,
        conventionDossierSchema,
        options.signal,
        { revision },
        options,
      ),
    conventionSourceUrl: (userId: string, category: string, companyId: string, id: string) =>
      new URL(
        `/partner/convention/${encodeURIComponent(userId)}/${encodeURIComponent(category)}/${encodeURIComponent(companyId)}/${encodeURIComponent(id)}/source`,
        base,
      ).href,
    referentProfile: (
      profileId: string,
      category: string,
      beforeRevision?: number,
      signal?: AbortSignal,
    ) =>
      request(
        `/wallet/referents/${encodeURIComponent(profileId)}/${encodeURIComponent(category)}${beforeRevision ? `?beforeRevision=${beforeRevision}` : ""}`,
        referentProfileSchema,
        signal,
      ),
    updateReferent: (
      profileId: string,
      category: string,
      input: ReferentUpdate,
      options: PartnerMutation,
    ) =>
      request(
        `/wallet/referents/${encodeURIComponent(profileId)}/${encodeURIComponent(category)}`,
        referentProfileSchema,
        options.signal,
        referentUpdateSchema.parse(input),
        options,
      ),
    offerImports: (id: string, cursor?: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/offer-imports${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        offerImportsSchema,
        signal,
      ),
    prepareOfferImport: (
      id: string,
      input: z.infer<typeof offerImportInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/offer-imports`,
        offerImportResultSchema,
        options.signal,
        offerImportInputSchema.parse(input),
        options,
      ),
    uploadOfferImport: (id: string, importId: string, file: File, options: PartnerMutation) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/offer-imports/${encodeURIComponent(importId)}/content`,
        offerImportResultSchema,
        options.signal,
        file,
        options,
        true,
      ),
    retryOfferImport: (
      id: string,
      importId: string,
      input: z.infer<typeof offerImportRetrySchema>,
      options: PartnerMutation,
    ) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/offer-imports/${encodeURIComponent(importId)}/retry`,
        offerImportResultSchema,
        options.signal,
        offerImportRetrySchema.parse(input),
        options,
      ),
    importSourceUrl: (id: string, importId: string) =>
      new URL(
        `/partner/leads/${encodeURIComponent(id)}/offer-imports/${encodeURIComponent(importId)}/source`,
        base,
      ).href,
    insuranceSource: (id: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(id)}/insurance-request`,
        insuranceLeadSourceSchema,
        signal,
      ),
    offerHistory: (id: string, cursor?: string, signal?: AbortSignal, wallet = false) =>
      request(
        `${path(wallet)}/${encodeURIComponent(id)}/offers/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        offerHistorySchema,
        signal,
      ),
    contractCandidates: (id: string, signal?: AbortSignal) =>
      request(
        `/wallet/leads/${encodeURIComponent(id)}/contracts`,
        contractCandidatesSchema,
        signal,
      ),
    finalPolicies: (id: string, cursor?: string, signal?: AbortSignal, wallet = false) =>
      request(
        `${path(wallet)}/${encodeURIComponent(id)}/final-policies${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        finalPoliciesSchema,
        signal,
      ),
    finalPolicySourceUrl: (id: string, policyId: string, wallet = false) =>
      new URL(
        `${path(wallet)}/${encodeURIComponent(id)}/final-policies/${encodeURIComponent(policyId)}/source`,
        base,
      ).href,
    contractSourceUrl: (id: string, wallet = false) =>
      new URL(`${path(wallet)}/${encodeURIComponent(id)}/current-contract/source`, base).href,
    insuranceLinks: (id: string, signal?: AbortSignal) =>
      request(
        `/wallet/insurance-request-leads/${encodeURIComponent(id)}`,
        insuranceLeadLinksSchema,
        signal,
      ),
    linkInsurance: (id: string, personId: string, options: PartnerMutation) =>
      request(
        `/wallet/insurance-request-leads/${encodeURIComponent(id)}`,
        leadDetailSchema,
        options.signal,
        insuranceLeadConsentSchema.parse({ personId, transmissionAuthorized: true }),
        options,
      ),
    collaborations: (signal?: AbortSignal) =>
      request("/partner/collaborations", collaborationListSchema, signal),
    respondCollaboration: (id: string, input: CollaborationResponse, options: PartnerMutation) =>
      request(
        `/partner/collaborations/${encodeURIComponent(id)}/respond`,
        collaborationSchema,
        options.signal,
        collaborationResponseSchema.parse(input),
        options,
      ),
    continuitySettings: (signal?: AbortSignal) =>
      request("/admin/partner/continuity", partnerContinuitySettingsSchema, signal),
    updateContinuitySettings: (input: PartnerContinuityUpdate, options: PartnerMutation) =>
      request(
        "/admin/partner/continuity",
        partnerContinuitySettingsSchema,
        options.signal,
        partnerContinuityUpdateSchema.parse(input),
        options,
      ),
    notifications: (input: PartnerNotificationQuery, signal?: AbortSignal, wallet = false) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(partnerNotificationQuerySchema.parse(input)))
        if (value !== undefined) query.set(key, value);
      return request(
        `/${wallet ? "wallet" : "partner"}/notifications?${query}`,
        partnerNotificationsSchema,
        signal,
      );
    },
    readNotification: (id: string, options: PartnerMutation, wallet = false) =>
      request(
        `/${wallet ? "wallet" : "partner"}/notifications/${encodeURIComponent(id)}/read`,
        z.object({ read: z.literal(true) }),
        options.signal,
        {},
        options,
      ),
    dashboard: (signal?: AbortSignal) =>
      request("/partner/dashboard", partnerDashboardSchema, signal),
    work: (signal?: AbortSignal) => request("/partner/work", partnerWorkSchema, signal),
    context: (signal?: AbortSignal) => request("/partner/context", partnerContextSchema, signal),
    application: (input: z.infer<typeof partnerApplicationInputSchema>, options: PartnerMutation) =>
      request(
        "/partner/application",
        partnerContextSchema,
        options.signal,
        partnerApplicationInputSchema.parse(input),
        options,
      ),
    applications: (signal?: AbortSignal) =>
      request("/admin/partner/applications", partnerApplicationsSchema, signal),
    review: (
      id: string,
      input: z.infer<typeof partnerReviewInputSchema>,
      options: PartnerMutation,
    ) =>
      request(
        `/admin/partner/applications/${encodeURIComponent(id)}/review`,
        partnerApplicationSchema,
        options.signal,
        partnerReviewInputSchema.parse(input),
        options,
      ),
    directory: (signal?: AbortSignal) =>
      request("/partner/directory", partnerDirectorySchema, signal),
    list: (query: Partial<LeadListQuery>, signal?: AbortSignal, wallet = false) =>
      request(
        `${path(wallet)}?${new URLSearchParams(
          Object.entries(leadListQuerySchema.parse(query))
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        )}`,
        leadListSchema,
        signal,
      ),
    lead: (id: string, signal?: AbortSignal, wallet = false) =>
      request(`${path(wallet)}/${encodeURIComponent(id)}`, leadDetailSchema, signal),
    create: (input: LeadCreateInput, options: PartnerMutation, wallet = false) =>
      request(
        path(wallet),
        leadDetailSchema,
        options.signal,
        leadCreateInputSchema.parse(input),
        options,
      ),
    command: (id: string, input: LeadCommand, options: PartnerMutation, wallet = false) =>
      request(
        `${path(wallet)}/${encodeURIComponent(id)}/commands`,
        leadDetailSchema,
        options.signal,
        leadCommandSchema.parse(input),
        options,
      ),
    extraction: (leadId: string, documentId: string, signal?: AbortSignal) =>
      request(
        `/partner/leads/${encodeURIComponent(leadId)}/extraction/${encodeURIComponent(documentId)}`,
        offerExtractionSchema,
        signal,
      ),
    sourceUrl: (leadId: string, offerId: string, wallet = false) =>
      new URL(
        `${path(wallet)}/${encodeURIComponent(leadId)}/offers/${encodeURIComponent(offerId)}/source`,
        base,
      ).href,
  };
}
