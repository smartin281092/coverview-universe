import { z } from "zod";
import {
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
  solutionBindingInputSchema,
  type SolutionBindingInput,
  solutionEvidenceSchema,
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
export type PartnerMutation = { csrfToken: string; idempotencyKey: string; signal?: AbortSignal };
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
  return {
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
        `${path(wallet)}?${new URLSearchParams(Object.entries(leadListQuerySchema.parse(query)).map(([key, value]) => [key, String(value)]))}`,
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
