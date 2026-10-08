import { insuranceCompanyIdSchema } from "./companies.js";
import { z } from "zod";
export * from "./partner-appointment-links.js";
export * from "./partner-wallet-appointments.js";
import {
  professionalPracticeSummarySchema,
  professionalLanguageSchema,
  swissCantonSchema,
} from "./professional-practice.js";
import { advicePreferencesSchema, leadAppointmentModeSchema } from "./partner-advice.js";
import {
  appointmentAssessmentSchema,
  appointmentTimeInputSchema,
} from "./partner-appointment-assessment.js";
export * from "./partner-advice.js";
export * from "./professional-practice.js";
export * from "./partner-availability.js";
export * from "./partner-appointment-assessment.js";
import {
  currentContractSchema,
  contractComparisonSchema,
  contractReviewInputSchema,
} from "./partner-contract.js";
export * from "./partner-contract.js";
export * from "./partner-final-policy.js";
import { finalPolicyReviewSchema } from "./partner-final-policy.js";
import { benefitCategorySchema, benefitLimitSchema } from "./partner-benefits.js";
import { offerComparisonSchema } from "./partner-comparison.js";
import { leadOrientationSchema } from "./partner-orientation.js";
import { recommendationSchema } from "./partner-recommendations.js";
import { insuranceItemSchema, insuranceRequestIdSchema } from "./insurance-requests.js";
import { documentCreateInputSchema, documentStateSchema } from "./documents.js";

const insuranceLeadProvenanceSchema = z.object({
  leadId: z.string().min(1).max(100),
  requestId: insuranceRequestIdSchema,
  personId: z.uuid(),
  profileId: z.string().min(1).max(100),
  requestRevision: z.number().int().nonnegative(),
  consentVersion: z.literal("insurance-partner-v1"),
  transmittedAt: z.iso.datetime(),
});
export const insuranceLeadSourceSchema = z.discriminatedUnion("status", [
  insuranceLeadProvenanceSchema.extend({
    status: z.literal("available"),
    item: insuranceItemSchema,
  }),
  insuranceLeadProvenanceSchema.extend({ status: z.literal("unavailable"), item: z.null() }),
]);
export type InsuranceLeadSource = z.infer<typeof insuranceLeadSourceSchema>;

export const insuranceLeadConsentSchema = z
  .object({
    personId: z.uuid(),
    transmissionAuthorized: z.literal(true),
  })
  .strict();
export const insuranceLeadLinksSchema = z.object({
  requestId: insuranceRequestIdSchema,
  people: z
    .array(
      z.object({
        personId: z.uuid(),
        profileId: z.string(),
        status: z.enum(["consent_required", "linked", "closed"]),
        leadId: z.string().nullable(),
      }),
    )
    .max(12),
});

const id = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(2000);
const instant = z.iso.datetime({ offset: true });
export const partnerContinuityPolicySchema = z
  .object({
    acceptanceHours: z.number().int().min(1).max(24),
    // Automatic proposals to the next eligible person before a human CoverView takeover.
    automaticReassignments: z.number().int().min(0).max(3).default(1),
    calendar: z
      .object({
        enabled: z.boolean(),
        timezone: z.literal("Europe/Zurich"),
        weekdays: z
          .array(z.number().int().min(0).max(6))
          .min(1)
          .max(7)
          .refine((days) => new Set(days).size === days.length),
        opensAt: z.number().int().min(0).max(1425).multipleOf(15),
        closesAt: z.number().int().min(15).max(1440).multipleOf(15),
        closedDates: z
          .array(z.iso.date())
          .max(60)
          .refine((days) => new Set(days).size === days.length),
      })
      .strict()
      .refine((calendar) => calendar.opensAt < calendar.closesAt, { path: ["closesAt"] }),
  })
  .strict();
export const partnerContinuityUpdateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    policy: partnerContinuityPolicySchema,
    reason: text,
  })
  .strict();
export const partnerContinuitySettingsSchema = z.object({
  current: z.object({
    revision: z.number().int().nonnegative(),
    policy: partnerContinuityPolicySchema,
  }),
  history: z
    .array(
      z.object({
        revision: z.number().int().positive(),
        policy: partnerContinuityPolicySchema,
        changedBy: id,
        reason: text,
        createdAt: instant,
      }),
    )
    .max(20),
});
export type PartnerContinuityPolicy = z.infer<typeof partnerContinuityPolicySchema>;
export type PartnerContinuityUpdate = z.infer<typeof partnerContinuityUpdateSchema>;
export type PartnerContinuityUpdateInput = z.input<typeof partnerContinuityUpdateSchema>;
export type PartnerContinuitySettings = z.infer<typeof partnerContinuitySettingsSchema>;
export const leadStageSchema = z.enum([
  "draft",
  "new",
  "qualifying",
  "ready_to_assign",
  "to_contact",
  "contacted",
  "appointment_needed",
  "appointment_scheduled",
  "appointment_completed",
  "analysis",
  "offer_requested",
  "offer_received",
  "offer_presented",
  "client_decision",
  "signing",
  "signed",
  "awaiting_insurer",
  "contract_issued",
  "completed",
]);
export const leadCategorySchema = z.enum([
  "health",
  "vehicle",
  "pension",
  "household",
  "legal",
  "business",
  "other",
]);
const referentAdvisorSchema = z.object({ id, name: z.string(), organization: z.string() });
export const competenceStatusSchema = z.enum([
  "missing",
  "submitted",
  "needs_information",
  "rejected",
  "reviewed",
  "limited",
  "expired",
  "withdrawn",
  "unavailable",
]);
export const competenceSummarySchema = z.object({
  status: competenceStatusSchema,
  scope: z.string(),
  validUntil: instant.nullable(),
  reviewedAt: instant.nullable(),
});
export const competenceDeclarationSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    professionalRevision: z.number().int().positive().nullable().default(null),
    declaration: text,
    file: documentCreateInputSchema.pick({ name: true, mime: true, size: true, checksum: true }),
    confirmed: z.literal(true),
  })
  .strict();
export const competenceDecisionSchema = z
  .object({
    revision: z.number().int().positive(),
    decision: z.enum(["reviewed", "needs_information", "rejected", "withdrawn"]),
    reason: text,
    scope: z.string().trim().max(2000),
    coverage: z.enum(["category", "limited"]).nullable(),
    validUntil: instant.nullable(),
    documentRevision: z.number().int().nonnegative(),
    originalChecked: z.boolean(),
  })
  .strict()
  .refine((v) =>
    v.decision === "reviewed"
      ? !!v.scope && !!v.coverage && !!v.validUntil && v.originalChecked
      : v.coverage === null && v.validUntil === null && v.scope === "",
  );
export const competenceQuerySchema = z
  .object({
    beforeRevision: z.coerce.number().int().positive().optional(),
  })
  .strict();
export const competenceRecordSchema = z.object({
  id,
  revision: z.number().int().positive(),
  professionalRevision: z.number().int().positive().nullable().default(null),
  declaredName: z.string().default(""),
  declaredOrganization: z.string().default(""),
  professionalScope: z.enum(["current", "changed", "unknown"]).default("unknown"),
  declaration: text,
  decision: z.enum(["submitted", "reviewed", "needs_information", "rejected", "withdrawn"]),
  reason: z.string(),
  scope: z.string(),
  coverage: z.enum(["category", "limited"]).nullable(),
  validUntil: instant.nullable(),
  createdAt: instant,
  actorName: z.string(),
  documentId: id,
  documentName: z.string(),
  documentState: documentStateSchema,
  documentRevision: z.number().int().nonnegative(),
  canDownload: z.boolean(),
});
export const competenceDossierSchema = z.object({
  documentsAvailable: z.boolean().default(true),
  professionalRevision: z.number().int().positive().nullable().default(null),
  userId: id,
  name: z.string(),
  organization: z.string(),
  category: leadCategorySchema,
  current: competenceRecordSchema.nullable(),
  summary: competenceSummarySchema,
  canDeclare: z.boolean(),
  canResume: z.boolean().default(false),
  canReview: z.boolean(),
  canWithdraw: z.boolean(),
  history: z.array(competenceRecordSchema).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
});
export type CompetenceDeclaration = z.infer<typeof competenceDeclarationSchema>;
export type CompetenceDecision = z.infer<typeof competenceDecisionSchema>;
export type CompetenceDossier = z.infer<typeof competenceDossierSchema>;
export const conventionDeclarationSchema = competenceDeclarationSchema.extend({
  subjectName: z.string().trim().min(1).max(160),
  subjectOrganization: z.string().trim().min(1).max(200),
});
export const conventionDecisionSchema = z
  .object(competenceDecisionSchema.shape)
  .extend({
    validFrom: instant.nullable(),
    memberCovered: z.boolean(),
  })
  .strict()
  .refine((v) =>
    v.decision === "reviewed"
      ? !!v.scope &&
        !!v.coverage &&
        !!v.validFrom &&
        !!v.validUntil &&
        v.originalChecked &&
        v.memberCovered &&
        Date.parse(v.validFrom) < Date.parse(v.validUntil)
      : v.coverage === null && v.validFrom === null && v.validUntil === null && v.scope === "",
  );
export const conventionQuerySchema = competenceQuerySchema;
export const conventionSummarySchema = competenceSummarySchema.extend({
  status: z.enum([...competenceStatusSchema.options, "scheduled"]),
  validFrom: instant.nullable(),
});
export const conventionRecordSchema = competenceRecordSchema.extend({
  declaredName: z.string(),
  declaredOrganization: z.string(),
  validFrom: instant.nullable(),
  memberCovered: z.boolean(),
});
export const conventionDossierSchema = competenceDossierSchema.extend({
  companyId: insuranceCompanyIdSchema,
  current: conventionRecordSchema.nullable(),
  summary: conventionSummarySchema,
  history: z.array(conventionRecordSchema).max(20),
});
export type ConventionDeclaration = z.infer<typeof conventionDeclarationSchema>;
export type ConventionDecision = z.infer<typeof conventionDecisionSchema>;
export type ConventionDossier = z.infer<typeof conventionDossierSchema>;
export const referentSelectionSchema = z.object({
  revision: z.number().int().nonnegative(),
  advisor: referentAdvisorSchema.nullable(),
  status: z.enum(["unset", "chosen", "coverview", "unavailable", "confirmation_required"]),
  confirmedAt: instant.nullable(),
});
export const referentUpdateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    profileRevision: z.number().int().nonnegative(),
    advisorId: id.nullable(),
    confirmed: z.literal(true),
  })
  .strict();
export const referentQuerySchema = z
  .object({
    beforeRevision: z.coerce.number().int().positive().optional(),
  })
  .strict();
export const referentProfileSchema = z.object({
  profileId: id,
  profileRevision: z.number().int().nonnegative(),
  profileName: z.string(),
  category: leadCategorySchema,
  current: referentSelectionSchema,
  candidates: z.array(referentAdvisorSchema).max(100),
  candidatesTruncated: z.boolean(),
  history: z
    .array(
      z.object({
        revision: z.number().int().positive(),
        advisor: referentAdvisorSchema.nullable(),
        confirmedAt: instant,
        currentOwnerConfirmation: z.boolean(),
      }),
    )
    .max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
});
export const referentContinuitySchema = z.object({
  practice: professionalPracticeSummarySchema.optional(),
  competence: competenceSummarySchema.optional(),
  selection: referentSelectionSchema,
  status: z.enum(["human_review", "client_change_requested", "closed"]),
  suggestion: referentAdvisorSchema.nullable(),
  missingChecks: z.array(
    z.enum([
      "competence",
      "conventions",
      "language",
      "region",
      "availability",
      "conflicts",
      "preferences",
    ]),
  ),
});
export type ReferentProfile = z.infer<typeof referentProfileSchema>;
export type ReferentUpdate = z.infer<typeof referentUpdateSchema>;
export type ReferentContinuity = z.infer<typeof referentContinuitySchema>;
const advisorCriterionSchema = z.object({
  status: z.enum(["matches", "differs", "unknown", "not_applicable"]),
  reason: z.enum([
    "preferences_unlinked",
    "preferences_unset",
    "preferences_confirmation_required",
    "preference_unspecified",
    "declaration_missing",
    "declaration_scope_changed",
    "declaration_unspecified",
    "declared_match",
    "declared_difference",
    "remote_mode",
  ]),
});
// Private composition for the current advisor only; never embedded in a shared Lead DTO.
export const advisorAssessmentSchema = z.object({
  leadId: id,
  advisorId: id,
  assessedAt: instant,
  category: leadCategorySchema,
  preferences: advicePreferencesSchema.pick({ status: true, scopeRevision: true }).extend({
    current: advicePreferencesSchema.shape.current
      .unwrap()
      .pick({
        revision: true,
        profileRevision: true,
        confirmedAt: true,
        languageCode: true,
        mode: true,
        canton: true,
      })
      .nullable(),
  }),
  practice: professionalPracticeSummarySchema,
  modes: z.object({
    status: z.enum(["missing", "scope_changed", "declared"]),
    revision: z.number().int().positive().nullable(),
    declaredAt: instant.nullable(),
    values: z.array(leadAppointmentModeSchema).max(4),
  }),
  competence: competenceSummarySchema,
  continuity: z.object({
    status: z.enum([
      "unlinked",
      "unset",
      "chosen_self",
      "chosen_other",
      "coverview",
      "unavailable",
      "confirmation_required",
    ]),
    confirmedAt: instant.nullable(),
    changeRequested: z.boolean(),
  }),
  criteria: z.object({
    language: advisorCriterionSchema,
    canton: advisorCriterionSchema,
    mode: advisorCriterionSchema,
  }),
  remainingChecks: z
    .array(
      z.enum(["conventions", "availability", "capacity", "conflicts", "need_expertise", "quality"]),
    )
    .max(6),
});
export type AdvisorAssessment = z.infer<typeof advisorAssessmentSchema>;
// Explicit shared projection, independent of the personal advisor dossier.
export const referentAssessmentSchema = z.object({
  leadId: id,
  title: z.string(),
  category: leadCategorySchema,
  assessedAt: instant,
  status: z.enum([
    "human_review",
    "client_change_requested",
    "closed",
    "unlinked",
    "unset",
    "coverview",
    "unavailable",
    "confirmation_required",
  ]),
  selection: referentSelectionSchema.nullable(),
  assessment: z
    .object({
      preferences: z.object({
        status: advicePreferencesSchema.shape.status,
        confirmedAt: instant.nullable(),
        languageCode: professionalLanguageSchema.nullable(),
        canton: swissCantonSchema.nullable(),
        mode: leadAppointmentModeSchema.nullable(),
      }),
      practice: professionalPracticeSummarySchema,
      competence: competenceSummarySchema,
      criteria: z.object({
        language: advisorCriterionSchema,
        canton: advisorCriterionSchema,
        mode: z.object({
          status: z.literal("unknown"),
          reason: z.literal("shared_source_unavailable"),
        }),
      }),
      remainingChecks: z
        .array(
          z.enum([
            "conventions",
            "availability",
            "capacity",
            "conflicts",
            "need_expertise",
            "quality",
          ]),
        )
        .max(6),
    })
    .nullable(),
});
export type ReferentAssessment = z.infer<typeof referentAssessmentSchema>;

// Personal statement, separate from recorded workload and any admission decision.
export const capacityPositionSchema = z.enum(["open", "case_by_case", "unavailable"]);
export const capacityInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    professionalRevision: z.number().int().positive(),
    action: z.enum(["declare", "withdraw"]),
    position: capacityPositionSchema.nullable(),
    validUntil: instant.nullable(),
    confirmed: z.literal(true),
  })
  .strict()
  .refine((value) =>
    value.action === "declare"
      ? value.position !== null && value.validUntil !== null
      : value.position === null && value.validUntil === null,
  );
const capacityDeclarationSchema = z.object({
  revision: z.number().int().positive(),
  professionalRevision: z.number().int().positive(),
  declaredName: z.string(),
  declaredOrganization: z.string(),
  categories: z.array(leadCategorySchema).max(7),
  professionalScope: z.enum(["current", "changed"]),
  action: capacityInputSchema.shape.action,
  position: capacityPositionSchema.nullable(),
  validUntil: instant.nullable(),
  status: z.enum(["declared", "withdrawn", "expired", "scope_changed"]),
  declaredAt: instant,
});
export const capacityDossierSchema = z.object({
  userId: id,
  name: z.string(),
  organization: z.string(),
  categories: z.array(leadCategorySchema).max(7),
  professionalRevision: z.number().int().positive(),
  canDeclare: z.boolean(),
  canWithdraw: z.boolean(),
  activeAdvisor: z.boolean(),
  workload: z.object({
    observedAt: instant,
    accepted: z.number().int().nonnegative(),
    proposed: z.number().int().nonnegative(),
    contributing: z.number().int().nonnegative(),
  }),
  current: capacityDeclarationSchema.nullable(),
  history: z.array(capacityDeclarationSchema).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
});
export type CapacityInput = z.infer<typeof capacityInputSchema>;
export type CapacityDossier = z.infer<typeof capacityDossierSchema>;

// Explicit private v2; v1 remains readable without the capacity table.
export const capacityAdvisorAssessmentSchema = advisorAssessmentSchema.extend({
  version: z.literal(2),
  capacity: z.object({
    source: z.literal("personal_declaration"),
    status: z.enum([
      "missing",
      "withdrawn",
      "scope_changed",
      "expired",
      "category_not_covered",
      "declared",
    ]),
    position: capacityPositionSchema.nullable(),
    declaration: capacityDeclarationSchema
      .pick({
        revision: true,
        professionalRevision: true,
        categories: true,
        professionalScope: true,
        declaredAt: true,
        validUntil: true,
      })
      .nullable(),
    decision: z.literal("human_review_required"),
  }),
  workload: capacityDossierSchema.shape.workload,
});
export type CapacityAdvisorAssessment = z.infer<typeof capacityAdvisorAssessmentSchema>;

// A personal decision for one need. Never an assignment, acceptance or shared assessment.
export const needCapacityPositionSchema = z.enum([
  "capacity_confirmed",
  "capacity_insufficient",
  "clarification_needed",
]);
export const needCapacityInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    scopeFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    action: z.enum(["decide", "withdraw"]),
    position: needCapacityPositionSchema.nullable(),
    reason: z.string().trim().min(10).max(1000),
    validUntil: instant.nullable(),
    confirmed: z.literal(true),
  })
  .strict()
  .refine((value) =>
    value.action === "decide"
      ? value.position !== null && value.validUntil !== null
      : value.position === null && value.validUntil === null,
  );
const needCapacityBasisSchema = z.object({
  scopeRevision: z.number().int().positive(),
  profileRevision: z.number().int().nonnegative().nullable(),
  professionalRevision: z.number().int().positive().nullable(),
  preferencesRevision: z.number().int().nonnegative(),
  capacityRevision: z.number().int().nonnegative(),
  availabilityRevision: z.number().int().nonnegative(),
  workload: capacityDossierSchema.shape.workload,
});
const needCapacityRecordSchema = z.object({
  revision: z.number().int().positive(),
  action: needCapacityInputSchema.shape.action,
  position: needCapacityPositionSchema.nullable(),
  reason: z.string(),
  validUntil: instant.nullable(),
  recordedAt: instant,
  scope: advicePreferencesSchema.shape.scope,
  basis: needCapacityBasisSchema,
});
export const needCapacityDossierSchema = z.object({
  leadId: id,
  advisorId: id,
  assessedAt: instant,
  scope: advicePreferencesSchema.shape.scope,
  scopeFingerprint: needCapacityInputSchema.shape.scopeFingerprint,
  revision: z.number().int().nonnegative(),
  canConfirmCapacity: z.boolean(),
  canWithdraw: z.boolean(),
  status: z.enum(["missing", "recorded", "withdrawn", "expired", "review_required"]),
  effectivePosition: needCapacityPositionSchema.nullable(),
  current: needCapacityRecordSchema.nullable(),
  history: z.array(needCapacityRecordSchema).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
  assessment: capacityAdvisorAssessmentSchema,
  basis: needCapacityBasisSchema,
});
export type NeedCapacityInput = z.infer<typeof needCapacityInputSchema>;
export type NeedCapacityDossier = z.infer<typeof needCapacityDossierSchema>;

// A private human conflict review, distinct from scheduling and capacity.
export const needConflictPositionSchema = z.enum([
  "none_declared",
  "blocking_conflict_declared",
  "clarification_needed",
]);
export const needConflictInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    scopeFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    action: z.enum(["decide", "withdraw"]),
    position: needConflictPositionSchema.nullable(),
    reviewedScope: z.string().trim().min(10).max(500).nullable(),
    reason: z.string().trim().min(10).max(1000),
    validUntil: instant.nullable(),
    confirmed: z.literal(true),
  })
  .strict()
  .refine((value) =>
    value.action === "decide"
      ? value.position !== null && value.validUntil !== null && value.reviewedScope !== null
      : value.position === null && value.validUntil === null && value.reviewedScope === null,
  );
const needConflictBasisSchema = z.object({
  scopeRevision: z.number().int().positive(),
  profileRevision: z.number().int().nonnegative().nullable(),
  professionalRevision: z.number().int().positive().nullable(),
  preferencesRevision: z.number().int().nonnegative(),
  referentRevision: z.number().int().nonnegative(),
});
const needConflictRecordSchema = z.object({
  revision: z.number().int().positive(),
  action: needConflictInputSchema.shape.action,
  position: needConflictPositionSchema.nullable(),
  reviewedScope: z.string().nullable(),
  reason: z.string(),
  validUntil: instant.nullable(),
  recordedAt: instant,
  scope: advicePreferencesSchema.shape.scope,
  basis: needConflictBasisSchema,
});
export const needConflictDossierSchema = z.object({
  leadId: id,
  advisorId: id,
  assessedAt: instant,
  scope: advicePreferencesSchema.shape.scope,
  scopeFingerprint: needConflictInputSchema.shape.scopeFingerprint,
  revision: z.number().int().nonnegative(),
  canDeclareAbsence: z.boolean(),
  canWithdraw: z.boolean(),
  status: z.enum(["missing", "recorded", "withdrawn", "expired", "review_required"]),
  effectivePosition: needConflictPositionSchema.nullable(),
  current: needConflictRecordSchema.nullable(),
  history: z.array(needConflictRecordSchema).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
  changeRequested: z.boolean(),
  basis: needConflictBasisSchema,
});
export type NeedConflictInput = z.infer<typeof needConflictInputSchema>;
export type NeedConflictDossier = z.infer<typeof needConflictDossierSchema>;

// Personal documentary evidence to examine against a need; never a suitability decision.
export const needExpertiseEvidenceSchema = z.object({
  version: z.literal(1),
  leadId: id,
  advisorId: id,
  assessedAt: instant,
  scope: advicePreferencesSchema.shape.scope.extend({ category: leadCategorySchema }),
  scopeRevision: z.number().int().positive(),
  changeRequested: z.boolean(),
  assessment: z.literal("human_review_required"),
  competence: z.object({
    summary: competenceSummarySchema,
    current: competenceRecordSchema.omit({ documentId: true, canDownload: true }).nullable(),
    sourceStatus: z.enum(["missing", "available", "changed", "unavailable", "disabled"]),
    reviewedDocumentRevision: z.number().int().nonnegative().nullable(),
    canOpenDossier: z.boolean(),
  }),
});
export type NeedExpertiseEvidence = z.infer<typeof needExpertiseEvidenceSchema>;

export const needExpertisePositionSchema = z.enum([
  "expertise_confirmed_within_scope",
  "specialist_required",
  "clarification_needed",
]);
export const needExpertiseInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    scopeFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    action: z.enum(["decide", "withdraw"]),
    position: needExpertisePositionSchema.nullable(),
    reviewedScope: z.string().trim().min(10).max(500).nullable(),
    limitations: z.string().trim().min(10).max(1000).nullable(),
    nextStep: z.string().trim().min(10).max(1000).nullable(),
    reason: z.string().trim().min(10).max(1000),
    validUntil: instant.nullable(),
    confirmed: z.literal(true),
  })
  .strict()
  .refine((value) =>
    value.action === "decide"
      ? value.position !== null &&
        value.validUntil !== null &&
        value.reviewedScope !== null &&
        value.limitations !== null &&
        value.nextStep !== null
      : value.position === null &&
        value.validUntil === null &&
        value.reviewedScope === null &&
        value.limitations === null &&
        value.nextStep === null,
  );
const needExpertiseSourceSchema = z.object({
  declarationId: id,
  decisionId: id,
  decisionRevision: z.number().int().positive(),
  documentRevision: z.number().int().nonnegative(),
  reviewedDocumentRevision: z.number().int().nonnegative().nullable(),
  sourceStatus: needExpertiseEvidenceSchema.shape.competence.shape.sourceStatus,
  summaryStatus: competenceSummarySchema.shape.status,
  validUntil: instant.nullable(),
});
const needExpertiseBasisSchema = needConflictBasisSchema.extend({
  source: needExpertiseSourceSchema.nullable(),
});
const needExpertiseRecordSchema = z.object({
  revision: z.number().int().positive(),
  action: needExpertiseInputSchema.shape.action,
  position: needExpertisePositionSchema.nullable(),
  reviewedScope: z.string().nullable(),
  limitations: z.string().nullable(),
  nextStep: z.string().nullable(),
  reason: z.string(),
  validUntil: instant.nullable(),
  recordedAt: instant,
  scope: advicePreferencesSchema.shape.scope,
  basis: needExpertiseBasisSchema,
});
export const needExpertiseDossierSchema = z.object({
  leadId: id,
  advisorId: id,
  assessedAt: instant,
  scope: advicePreferencesSchema.shape.scope.extend({ category: leadCategorySchema }),
  scopeFingerprint: needExpertiseInputSchema.shape.scopeFingerprint,
  revision: z.number().int().nonnegative(),
  canConfirmExpertise: z.boolean(),
  canWithdraw: z.boolean(),
  status: z.enum(["missing", "recorded", "withdrawn", "expired", "review_required"]),
  effectivePosition: needExpertisePositionSchema.nullable(),
  current: needExpertiseRecordSchema.nullable(),
  history: z.array(needExpertiseRecordSchema).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
  changeRequested: z.boolean(),
  basis: needExpertiseBasisSchema,
  competence: needExpertiseEvidenceSchema.shape.competence,
});
export type NeedExpertiseInput = z.infer<typeof needExpertiseInputSchema>;
export type NeedExpertiseDossier = z.infer<typeof needExpertiseDossierSchema>;

// Separate consent from the private availability dossier; no legacy values are imported.
export const sharedModesAudienceSchema = z.literal("confirmed-referent-leads-v1");
export const sharedModesInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    professionalRevision: z.number().int().positive(),
    action: z.enum(["publish", "withdraw"]),
    modes: z
      .array(leadAppointmentModeSchema)
      .max(4)
      .refine((values) => new Set(values).size === values.length),
    audience: sharedModesAudienceSchema,
    confirmed: z.literal(true),
  })
  .strict()
  .refine((value) =>
    value.action === "publish" ? value.modes.length > 0 : value.modes.length === 0,
  );
const sharedModesDeclarationSchema = z.object({
  revision: z.number().int().positive(),
  professionalRevision: z.number().int().positive(),
  declaredName: z.string(),
  declaredOrganization: z.string(),
  categories: z.array(leadCategorySchema).max(7),
  professionalScope: z.enum(["current", "changed"]),
  action: sharedModesInputSchema.shape.action,
  modes: sharedModesInputSchema.shape.modes,
  audience: sharedModesAudienceSchema,
  declaredAt: instant,
});
export const sharedModesDossierSchema = z.object({
  userId: id,
  name: z.string(),
  organization: z.string(),
  categories: z.array(leadCategorySchema).max(7),
  professionalRevision: z.number().int().positive(),
  canPublish: z.boolean(),
  canWithdraw: z.boolean(),
  current: sharedModesDeclarationSchema.nullable(),
  history: z.array(sharedModesDeclarationSchema).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
});
export const sharedModesSummarySchema = z.object({
  status: z.enum(["missing", "scope_changed", "withdrawn", "declared"]),
  modes: sharedModesInputSchema.shape.modes,
  declaredAt: instant.nullable(),
});
// Opt-in v2 preserves v1's literal unknown mode for already deployed clients.
export const sharedReferentAssessmentSchema = referentAssessmentSchema.extend({
  assessment: referentAssessmentSchema.shape.assessment
    .unwrap()
    .extend({
      sharedModes: sharedModesSummarySchema,
      criteria: z.object({
        language: advisorCriterionSchema,
        canton: advisorCriterionSchema,
        mode: z.union([
          advisorCriterionSchema,
          referentAssessmentSchema.shape.assessment.unwrap().shape.criteria.shape.mode,
        ]),
      }),
    })
    .nullable(),
});
export type SharedModesInput = z.infer<typeof sharedModesInputSchema>;
export type SharedModesDossier = z.infer<typeof sharedModesDossierSchema>;
export type SharedReferentAssessment = z.infer<typeof sharedReferentAssessmentSchema>;
export const partnerRoleSchema = z.enum(["advisor", "referrer", "manager"]);
export const applicationStateSchema = z.enum([
  "draft",
  "submitted",
  "needs_information",
  "approved",
  "rejected",
  "suspended",
  "closed",
]);
export const leadResultSchema = z.enum([
  "contract",
  "resolved_without_contract",
  "lost",
  "refused",
  "cancelled",
  "client_refusal",
  "no_suitable_solution",
  "abandoned",
  "no_response",
  "duplicate",
  "invalid",
]);
export const leadReasonSchema = z.enum([
  "price",
  "client_refusal",
  "unreachable",
  "competitor",
  "current_suitable",
  "insurer_refusal",
  "conditions",
  "postponed",
  "competence",
  "availability",
  "dissatisfaction",
  "duplicate",
  "invalid",
  "completed",
  "other",
]);
export const audienceSchema = z.enum(["private", "assigned", "client", "coverview"]);
export const partnerApplicationInputSchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    organization: z.string().trim().min(2).max(160),
    phone: z.string().trim().max(60),
    roles: z.array(partnerRoleSchema).min(1).max(3),
    categories: z.array(leadCategorySchema).min(1).max(7),
    languages: z.string().trim().min(2).max(160),
    regions: z.string().trim().min(2).max(300),
    qualifications: z.string().trim().max(2000),
  })
  .strict();
// Submitted with the invitation of an organisation's manager to join that organisation (C8b).
export const partnerApplicationSubmitSchema = partnerApplicationInputSchema.extend({
  invitationId: id.optional(),
});
// Activities CoverView may restrict (C8a). A restriction stops new engagements only: the requests
// already held continue, and a suspension remains the decision that withdraws them.
export const memberRestrictionsSchema = z.object({
  newLeads: z.boolean().default(false),
  leadCreation: z.boolean().default(false),
  marketplace: z.boolean().default(false),
  categories: z.array(leadCategorySchema).max(7).default([]),
  reviewAt: instant.nullable().default(null),
});
export const partnerApplicationSchema = partnerApplicationInputSchema.extend({
  userId: id,
  organizationId: id,
  professionalRevision: z.number().int().positive().nullable().default(null),
  state: applicationStateSchema,
  organizationState: applicationStateSchema,
  grantedRoles: z.array(partnerRoleSchema),
  revision: z.number().int().nonnegative(),
  reviewReason: z.string().nullable(),
  reviewedAt: instant.nullable(),
  reviewDueAt: instant.nullable(),
  restrictions: memberRestrictionsSchema.prefault({}),
  restrictionRevision: z.number().int().nonnegative().default(0),
  organizationRevision: z.number().int().nonnegative().default(0),
  organizationReviewDueAt: instant.nullable().default(null),
});
export const partnerReviewInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    state: applicationStateSchema.exclude(["draft", "submitted"]),
    roles: z.array(partnerRoleSchema).max(3),
    reason: text,
    reviewDueAt: instant.nullable(),
    organizationState: applicationStateSchema.exclude(["draft", "submitted"]).optional(),
  })
  .strict();
export const partnerContextSchema = z.object({
  administrator: z.boolean(),
  operational: z.boolean(),
  application: partnerApplicationSchema.nullable(),
  canCreate: z.boolean(),
  canAdvise: z.boolean(),
  canManage: z.boolean(),
});
// What the client asks (8 October 2026): a new insurance, or a change, a question, a
// cancellation or a claim about an existing one. Only a new insurance names its category.
export const leadRequestKindSchema = z.enum([
  "new_insurance",
  "modification",
  "question",
  "cancellation",
  "claim",
]);
export const leadCreateInputSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    // Absent means a new insurance (the Partner form and older clients).
    requestKind: leadRequestKindSchema.optional(),
    category: leadCategorySchema,
    object: z.string().trim().max(200),
    // A distinctive reference of the insured object (current policy, plate or chassis number), used
    // only to propose the matching current contract to its owner.
    objectReference: z.string().trim().max(120).optional(),
    context: z.string().trim().max(4000),
    clientUserId: id.nullable(),
    clientProfileId: id.nullable(),
    clientName: z.string().trim().min(2).max(160),
    email: z.union([z.email(), z.literal("")]),
    phone: z.string().trim().max(60),
    language: z.string().trim().min(2).max(30),
    source: z.string().trim().min(1).max(160),
    transmissionAuthorized: z.boolean(),
    priority: z.enum(["normal", "high", "urgent"]),
    draft: z.boolean(),
    nextAction: z.string().trim().max(240),
    dueAt: instant.nullable(),
  })
  .strict();
export const leadTaskInputSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().trim().max(2000),
    responsibleId: id,
    dueAt: instant,
    priority: z.enum(["normal", "high", "urgent"]),
    reminderAt: instant.nullable(),
  })
  .strict();
export const leadTaskSchema = leadTaskInputSchema
  .extend({
    id,
    state: z.enum(["open", "done", "cancelled"]),
    completedAt: instant.nullable(),
  })
  .strip();
export const leadAppointmentInputSchema = z
  .object({
    advisorId: id,
    startsAt: instant,
    durationMinutes: z.number().int().min(15).max(240),
    mode: leadAppointmentModeSchema,
    location: z.string().trim().min(3).max(1000),
    timezone: z.literal("Europe/Zurich"),
  })
  .strict();
export const leadAppointmentSchema = leadAppointmentInputSchema
  .extend({
    id,
    state: z.enum(["scheduled", "completed", "cancelled", "client_absent", "advisor_absent"]),
  })
  .strip();
export const jointParticipationStateSchema = z.enum([
  "invited",
  "confirmed",
  "declined",
  "withdrawn",
  "ended",
]);
export const jointOutcomeSchema = z.enum(["completed", "client_absent", "advisor_absent"]);
// Joint appointment (C6b): who joins the hosting appointment. Names only, never the joining
// professional's request, and only for the appointment's professionals, its owner and the Admin.
export const jointParticipantSchema = z.object({
  id,
  name: z.string().nullable(),
  organization: z.string().nullable(),
  state: jointParticipationStateSchema,
  termsCurrent: z.boolean(),
  outcome: jointOutcomeSchema.nullable(),
});
export const personalAppointmentProposalSchema = z
  .object({
    appointment: leadAppointmentInputSchema.omit({ advisorId: true }),
    time: appointmentTimeInputSchema.omit({ basis: true, confirmed: true }),
  })
  .strict();
export type PersonalAppointmentProposal = z.infer<typeof personalAppointmentProposalSchema>;
export const personalAppointmentPreviewSchema = z.object({
  proposal: personalAppointmentProposalSchema,
  previous: leadAppointmentSchema.optional(),
  assessment: appointmentAssessmentSchema.omit({ appointmentId: true, timeProtection: true }),
  basis: z.string().regex(/^[a-f0-9]{64}$/u),
  occupiedStartsAt: instant,
  occupiedEndsAt: instant,
  canConfirm: z.boolean(),
});
export type PersonalAppointmentPreview = z.infer<typeof personalAppointmentPreviewSchema>;
export const personalAppointmentConfirmSchema = personalAppointmentProposalSchema
  .extend({
    basis: z.string().regex(/^[a-f0-9]{64}$/u),
    clientAgreementConfirmed: z.literal(true),
    externalCommitmentsChecked: z.literal(true),
    capacityConfirmed: z.literal(true),
    preparationAndTravelChecked: z.literal(true),
  })
  .strict();
export type PersonalAppointmentConfirm = z.infer<typeof personalAppointmentConfirmSchema>;
// Exact appointment terms only: never expose private occupied periods or professional evidence.
export const bookingProposalInputSchema = z
  .object({
    slots: z
      .array(
        personalAppointmentProposalSchema
          .extend({ basis: z.string().regex(/^[a-f0-9]{64}$/u) })
          .strict(),
      )
      .min(1)
      .max(5),
    expiresAt: instant,
    offeredConfirmed: z.literal(true),
    externalCommitmentsChecked: z.literal(true),
    capacityConfirmed: z.literal(true),
    preparationAndTravelChecked: z.literal(true),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.slots.map((slot) => slot.appointment.startsAt)).size === value.slots.length,
    { path: ["slots"], message: "Distinct starts required" },
  );
export type BookingProposalInput = z.infer<typeof bookingProposalInputSchema>;
export const bookingChoiceSchema = z
  .object({
    slot: z.number().int().min(0).max(4),
    basis: z.string().regex(/^[a-f0-9]{64}$/u),
    confirmed: z.literal(true),
  })
  .strict();
export type BookingChoice = z.infer<typeof bookingChoiceSchema>;
export const bookingWithdrawalSchema = z.object({ confirmed: z.literal(true) }).strict();
export const bookingProposalsSchema = z.object({
  canPropose: z.boolean(),
  proposals: z
    .array(
      z.object({
        id,
        advisorName: z.string(),
        expiresAt: instant,
        state: z.enum(["offered", "booked", "withdrawn", "expired", "invalidated"]),
        appointmentId: id.nullable(),
        selectedSlot: z.number().int().min(0).max(4).nullable(),
        canWithdraw: z.boolean(),
        slots: z
          .array(
            z.object({
              appointment: leadAppointmentInputSchema.omit({ advisorId: true }),
              canBook: z.boolean(),
              basis: z.string().regex(/^[a-f0-9]{64}$/u),
            }),
          )
          .max(5),
      }),
    )
    .max(20),
});
export type BookingProposals = z.infer<typeof bookingProposalsSchema>;
export const coordinatedBookingInputSchema = z
  .object({
    choices: z
      .array(bookingChoiceSchema.extend({ leadId: id, proposalId: id }).strict())
      .min(2)
      .max(5),
    confirmed: z.literal(true),
  })
  .strict()
  .refine((v) => new Set(v.choices.map((c) => c.leadId)).size === v.choices.length, {
    path: ["choices"],
    message: "Distinct requests required",
  });
export type CoordinatedBookingInput = z.infer<typeof coordinatedBookingInputSchema>;
export const coordinatedBookingReceiptSchema = z.object({
  id,
  items: z
    .array(z.object({ leadId: id, proposal: bookingProposalsSchema.shape.proposals.element }))
    .min(2)
    .max(5),
});
export type CoordinatedBookingReceipt = z.infer<typeof coordinatedBookingReceiptSchema>;
export const partnerNotificationQuerySchema = z
  .object({
    status: z.enum(["open", "all"]).default("open"),
    cursor: z.string().max(500).optional(),
    clientProfileId: z.string().max(100).optional(),
  })
  .strict();
const offerIdentitySchema = z.object({
  id,
  version: z.number().int().positive(),
  company: z.string(),
  product: z.string(),
});
export const partnerNotificationSchema = z.object({
  id,
  leadId: id,
  collaborationId: id.nullable().optional(),
  title: z.string(),
  kind: z.string(),
  eventKind: z.string().nullable().optional(),
  offer: offerIdentitySchema.nullable().optional(),
  responsibleName: z.string(),
  priority: z.enum(["normal", "high", "urgent"]),
  action: z
    .enum([
      "accept",
      "follow_up",
      "review_wait",
      "assign",
      "review_response",
      "review_offer",
      "review_policy",
      "conclusion",
      "review_quality",
      "communication",
      "survey",
      "review_participation",
      "complement",
      "review_complement",
    ])
    .nullable(),
  dueAt: instant.nullable(),
  createdAt: instant,
  readAt: instant.nullable(),
  resolvedAt: instant.nullable(),
});
export const partnerNotificationsSchema = z.object({
  items: z.array(partnerNotificationSchema).max(30),
  nextCursor: z.string().nullable(),
});
export type PartnerNotificationQuery = z.infer<typeof partnerNotificationQuerySchema>;
export const leadEventSchema = z.object({
  id,
  subjectId: id.nullable().optional(),
  offer: offerIdentitySchema.nullable().optional(),
  responsePending: z.boolean().optional(),
  kind: z.string(),
  authorId: id,
  systemActor: z.literal("partner-continuity-v1").nullable().optional(),
  audience: audienceSchema,
  text: z.string(),
  createdAt: instant,
});
export const offerFeatureSchema = z
  .object({
    key: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(160),
    value: z.string().trim().max(500),
    conditions: z.string().trim().max(1000),
    exclusions: z.string().trim().max(1000).optional(),
    coverage: z.enum(["included", "excluded", "unknown"]).optional(),
    origin: z.enum(["extracted", "manual", "calculated", "missing"]),
    verification: z.enum(["to_verify", "verified", "missing"]),
    source: z.string().trim().max(300),
    sourcePage: z.number().int().min(1).max(20).nullable().optional(),
    // benefit-catalog-v1: normalized category and structured amount, both additive.
    category: benefitCategorySchema.optional(),
    limit: benefitLimitSchema.nullable().optional(),
  })
  .strict();
export const leadOfferInputSchema = z
  .object({
    company: z.string().trim().min(2).max(160),
    product: z.string().trim().min(2).max(200),
    documentId: id,
    sourceFingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/u)
      .optional(),
    replacesId: id.nullable(),
    reference: z.string().trim().max(120),
    annualPremiumMinor: z.number().int().nonnegative().max(1000000000).nullable(),
    currency: z.literal("CHF"),
    validUntil: instant.nullable(),
    effectiveDate: z.iso.date().nullable(),
    features: z.array(offerFeatureSchema).max(80),
    summary: z.string().trim().max(3000),
    limitations: z.string().trim().max(3000),
  })
  .strict();
export const leadOfferSchema = leadOfferInputSchema.extend({
  id,
  version: z.number().int().positive(),
  active: z.boolean(),
  state: z.enum([
    "received",
    "to_verify",
    "ready",
    "published",
    "viewed",
    "selected",
    "refused",
    "expired",
    "replaced",
    "to_sign",
    "signed",
    "cancelled",
  ]),
  reviewedAt: instant.nullable(),
  publishedAt: instant.nullable(),
  createdAt: instant,
  sourceStatus: z.enum(["current", "changed", "unavailable", "unbound"]).optional(),
  sourceGeneration: z.number().int().nonnegative().nullable().optional(),
  canDownload: z.boolean().optional(),
  canCompare: z.boolean().optional(),
  canChoose: z.boolean().optional(),
  updatedSinceViewed: z.boolean().optional(),
  // Display only (8 October 2026): the company recognised in the offer's name, for its logo, and
  // the server-detected type of the original, which alone picks a preview renderer.
  companyId: insuranceCompanyIdSchema.optional(),
  sourceMime: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]).optional(),
  reviewedBy: id.nullable().optional(),
  publishedBy: id.nullable().optional(),
});
export const solutionEvidenceQuerySchema = z
  .object({ companyId: insuranceCompanyIdSchema.optional() })
  .strict();
export const solutionEvidenceSchema = z.object({
  version: z.literal(1),
  leadId: id,
  advisorId: id,
  assessedAt: instant,
  scope: advicePreferencesSchema.shape.scope.extend({ category: leadCategorySchema }),
  scopeRevision: z.number().int().positive(),
  changeRequested: z.boolean(),
  assessment: z.literal("human_review_required"),
  offer: leadOfferSchema
    .pick({
      id: true,
      version: true,
      company: true,
      product: true,
      reference: true,
      active: true,
      state: true,
      reviewedAt: true,
      createdAt: true,
      validUntil: true,
    })
    .extend({
      sourceStatus: z.enum(["current", "changed", "unavailable", "unbound", "disabled"]),
      sourceGeneration: z.number().int().nonnegative().nullable(),
      validity: z.enum(["undated", "unexpired", "expired"]),
      canDownload: z.boolean(),
    }),
  // An exploratory choice is never a verified identity or a distributable solution.
  companyId: insuranceCompanyIdSchema.nullable(),
  companyMatch: z.literal("unconfirmed"),
  remainingChecks: z.tuple([
    z.literal("company_identity"),
    z.literal("product_scope"),
    z.literal("client_admission"),
    z.literal("distribution_rights"),
    z.literal("economic_agreement"),
  ]),
  convention: z
    .object({
      summary: conventionSummarySchema,
      current: conventionRecordSchema.omit({ documentId: true, canDownload: true }).nullable(),
      sourceStatus: z.enum(["missing", "available", "changed", "unavailable", "disabled"]),
      reviewedDocumentRevision: z.number().int().nonnegative().nullable(),
      canOpenDossier: z.boolean(),
    })
    .nullable(),
});
export type SolutionEvidence = z.infer<typeof solutionEvidenceSchema>;
export type SolutionEvidenceQuery = z.infer<typeof solutionEvidenceQuerySchema>;

export const solutionBindingFields = [
  "company",
  "legalParty",
  "product",
  "variant",
  "productVersion",
] as const;
const solutionMentionInputSchema = z
  .object({
    page: z.number().int().min(1).max(20),
    quote: z.string().trim().min(2).max(500),
  })
  .strict()
  .nullable();
const solutionMentionsInputSchema = z
  .object({
    company: solutionMentionInputSchema,
    legalParty: solutionMentionInputSchema,
    product: solutionMentionInputSchema,
    variant: solutionMentionInputSchema,
    productVersion: solutionMentionInputSchema,
  })
  .strict();
export const solutionBindingInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    scopeFingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
    action: z.enum(["record", "withdraw"]),
    companyId: insuranceCompanyIdSchema.nullable(),
    mentions: solutionMentionsInputSchema.nullable(),
    reason: z.string().trim().min(10).max(1000),
    validUntil: instant.nullable(),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.action === "withdraw"
        ? value.companyId !== null || value.mentions !== null || value.validUntil !== null
        : !value.mentions ||
          !value.validUntil ||
          (value.companyId !== null && !value.mentions.company)
    )
      context.addIssue({ code: "custom", message: "PARTNER_ACTION_REQUIRED" });
  });
// Coordinates into the immutable canonical offer source, not a second copy of its text.
const solutionMentionReferenceSchema = z
  .object({
    page: z.number().int().min(1).max(20),
    start: z.number().int().nonnegative().max(30000),
    end: z.number().int().positive().max(30000),
  })
  .strict()
  .refine((value) => value.end > value.start && value.end - value.start <= 500);
export const solutionMentionReferencesSchema = z
  .object({
    company: solutionMentionReferenceSchema.nullable(),
    legalParty: solutionMentionReferenceSchema.nullable(),
    product: solutionMentionReferenceSchema.nullable(),
    variant: solutionMentionReferenceSchema.nullable(),
    productVersion: solutionMentionReferenceSchema.nullable(),
  })
  .strict();
const solutionBindingSourceSchema = z.object({
  documentId: id,
  generation: z.number().int().nonnegative(),
  documentRevision: z.number().int().nonnegative(),
  reviewRevision: z.number().int().nonnegative(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
});
const solutionBindingRecordSchema = z.object({
  revision: z.number().int().positive(),
  action: z.enum(["record", "withdraw"]),
  companyId: insuranceCompanyIdSchema.nullable(),
  mentions: solutionMentionsInputSchema.nullable(),
  mentionsAvailable: z.boolean(),
  reason: z.string(),
  validUntil: instant.nullable(),
  recordedAt: instant,
  scope: solutionEvidenceSchema.shape.scope,
  source: solutionBindingSourceSchema.nullable(),
});
export const solutionBindingQuerySchema = referentQuerySchema
  .extend({
    sourcePage: z.coerce.number().int().min(1).max(20).optional(),
  })
  .strict();
export const solutionBindingDossierSchema = z.object({
  leadId: id,
  advisorId: id,
  assessedAt: instant,
  scope: solutionEvidenceSchema.shape.scope,
  scopeFingerprint: solutionBindingInputSchema.shape.scopeFingerprint,
  changeRequested: z.boolean(),
  offer: solutionEvidenceSchema.shape.offer,
  source: solutionBindingSourceSchema.nullable(),
  sourcePages: z.array(z.number().int().min(1).max(20)).max(20),
  sourcePage: z
    .object({ page: z.number().int().min(1).max(20), text: z.string().max(30000) })
    .nullable(),
  revision: z.number().int().nonnegative(),
  canRecord: z.boolean(),
  canWithdraw: z.boolean(),
  status: z.enum(["missing", "recorded", "withdrawn", "expired", "review_required"]),
  current: solutionBindingRecordSchema.nullable(),
  history: z.array(solutionBindingRecordSchema).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
  legalIdentity: z.literal("unverified"),
  productIdentity: z.literal("unverified"),
  assessment: z.literal("human_review_required"),
});
export type SolutionBindingInput = z.infer<typeof solutionBindingInputSchema>;
export type SolutionBindingDossier = z.infer<typeof solutionBindingDossierSchema>;

export const solutionEvidenceVersionQuerySchema = solutionEvidenceQuerySchema
  .extend({ version: z.enum(["1", "2"]).optional() })
  .strict();
export const boundSolutionEvidenceSchema = solutionEvidenceSchema
  .omit({ version: true, companyMatch: true })
  .extend({
    version: z.literal(2),
    companyMatch: z.literal("unconfirmed"),
    selection: z.enum([
      "not_selected",
      "no_current_binding",
      "binding_without_company",
      "different_company",
      "human_match",
    ]),
    binding: z.object({
      status: solutionBindingDossierSchema.shape.status,
      revision: z.number().int().nonnegative(),
      current: solutionBindingRecordSchema
        .pick({
          revision: true,
          companyId: true,
          mentions: true,
          reason: true,
          validUntil: true,
          recordedAt: true,
        })
        .nullable(),
    }),
    legalIdentity: z.literal("unverified"),
    productIdentity: z.literal("unverified"),
    clauseEvidence: z.literal("not_structured"),
  });
export type BoundSolutionEvidence = z.infer<typeof boundSolutionEvidenceSchema>;

export const conventionClauseFields = [
  "parties",
  "distribution",
  "product",
  "limitations",
  "exclusions",
  "dates",
] as const;
const conventionClauseSchema = z
  .object({
    page: z.number().int().min(1).max(9999),
    locator: z.string().trim().min(2).max(200),
    quote: z.string().trim().min(2).max(1000),
  })
  .strict()
  .nullable();
export const conventionClausesSchema = z
  .object({
    parties: conventionClauseSchema,
    distribution: conventionClauseSchema,
    product: conventionClauseSchema,
    limitations: conventionClauseSchema,
    exclusions: conventionClauseSchema,
    dates: conventionClauseSchema,
  })
  .strict();
export const solutionClausesInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    scopeFingerprint: solutionBindingInputSchema.shape.scopeFingerprint,
    action: z.enum(["record", "withdraw"]),
    clauses: conventionClausesSchema.nullable(),
    reason: z.string().trim().min(10).max(1000),
    validUntil: instant.nullable(),
    confirmed: z.literal(true),
    originalChecked: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.action === "withdraw"
        ? value.clauses !== null || value.validUntil !== null || value.originalChecked
        : !value.originalChecked ||
          !value.validUntil ||
          !value.clauses ||
          !Object.values(value.clauses).some(Boolean)
    )
      context.addIssue({ code: "custom", message: "PARTNER_ACTION_REQUIRED" });
  });
export const solutionConventionReferenceSchema = z.object({
  declarationId: id,
  decisionId: id,
  revision: z.number().int().positive(),
  documentRevision: z.number().int().nonnegative(),
  reviewedDocumentRevision: z.number().int().nonnegative().nullable(),
});
const solutionClausesRecordSchema = z.object({
  revision: z.number().int().positive(),
  action: z.enum(["record", "withdraw"]),
  reason: z.string(),
  validUntil: instant.nullable(),
  recordedAt: instant,
  scope: solutionEvidenceSchema.shape.scope,
  bindingRevision: z.number().int().nonnegative(),
  conventionReference: solutionConventionReferenceSchema.nullable(),
  clauses: conventionClausesSchema.nullable(),
  clausesAvailable: z.boolean(),
  method: z.literal("human_transcription"),
});
export const solutionClausesDossierSchema = z.object({
  leadId: id,
  advisorId: id,
  companyId: insuranceCompanyIdSchema,
  assessedAt: instant,
  scope: solutionEvidenceSchema.shape.scope,
  offer: solutionEvidenceSchema.shape.offer,
  scopeFingerprint: solutionBindingInputSchema.shape.scopeFingerprint,
  revision: z.number().int().nonnegative(),
  status: solutionBindingDossierSchema.shape.status,
  canRecord: z.boolean(),
  canWithdraw: z.boolean(),
  changeRequested: z.boolean(),
  binding: boundSolutionEvidenceSchema.shape.binding,
  convention: solutionEvidenceSchema.shape.convention.unwrap(),
  conventionReference: solutionConventionReferenceSchema.nullable(),
  maxValidUntil: instant.nullable(),
  current: solutionClausesRecordSchema.nullable(),
  history: z.array(solutionClausesRecordSchema).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
  assessment: z.literal("human_review_required"),
  legalIdentity: z.literal("unverified"),
  productIdentity: z.literal("unverified"),
});
export type SolutionClausesInput = z.infer<typeof solutionClausesInputSchema>;
export type SolutionClausesDossier = z.infer<typeof solutionClausesDossierSchema>;

export const distributionPositions = [
  "undetermined",
  "needs_information",
  "cannot_proceed",
] as const;
export const distributionReviewSchema = z
  .object({
    position: z.enum(distributionPositions),
    aspects: z
      .array(z.enum(conventionClauseFields))
      .min(1)
      .max(6)
      .refine((values) => new Set(values).size === values.length),
    examinedScope: z.string().trim().min(10).max(500),
    limitations: z.string().trim().min(10).max(1000),
    nextStep: z.string().trim().min(10).max(1000),
  })
  .strict();
export const distributionReviewInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    scopeFingerprint: solutionBindingInputSchema.shape.scopeFingerprint,
    action: z.enum(["record", "withdraw"]),
    review: distributionReviewSchema.nullable(),
    reason: z.string().trim().min(10).max(1000),
    validUntil: instant.nullable(),
    confirmed: z.literal(true),
    originalsChecked: z.boolean(),
    transcriptionChecked: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.action === "withdraw"
        ? value.review !== null ||
          value.validUntil !== null ||
          value.originalsChecked ||
          value.transcriptionChecked
        : !value.review ||
          !value.validUntil ||
          !value.originalsChecked ||
          !value.transcriptionChecked
    )
      context.addIssue({ code: "custom", message: "PARTNER_ACTION_REQUIRED" });
  });
const distributionRecordSchema = z.object({
  revision: z.number().int().positive(),
  action: z.enum(["record", "withdraw"]),
  review: distributionReviewSchema.nullable(),
  reason: z.string(),
  validUntil: instant.nullable(),
  recordedAt: instant,
  scope: solutionEvidenceSchema.shape.scope,
  clausesRevision: z.number().int().nonnegative(),
  bindingRevision: z.number().int().nonnegative(),
  conventionReference: solutionConventionReferenceSchema.nullable(),
  sourcesCurrent: z.boolean(),
});
export const distributionReviewDossierSchema = z.object({
  source: solutionClausesDossierSchema.omit({ history: true, nextBeforeRevision: true }),
  scopeFingerprint: solutionBindingInputSchema.shape.scopeFingerprint,
  revision: z.number().int().nonnegative(),
  status: solutionBindingDossierSchema.shape.status,
  position: z.enum(distributionPositions).nullable(),
  canRecord: z.boolean(),
  canWithdraw: z.boolean(),
  maxValidUntil: instant.nullable(),
  current: distributionRecordSchema.nullable(),
  history: z.array(distributionRecordSchema).max(20),
  nextBeforeRevision: z.number().int().positive().nullable(),
});
export type DistributionReviewInput = z.infer<typeof distributionReviewInputSchema>;
export type DistributionReviewDossier = z.infer<typeof distributionReviewDossierSchema>;

export const offerHistoryQuerySchema = z
  .object({ cursor: z.string().max(500).optional() })
  .strict();
export const offerHistorySchema = z.object({
  items: z.array(leadOfferSchema).max(20),
  nextCursor: z.string().nullable(),
});
export const offerWithdrawInputSchema = z.object({ offerId: id, reason: text }).strict();
export const offerImportInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    source: documentCreateInputSchema.pick({ name: true, mime: true, size: true, checksum: true }),
    analysisRequested: z.literal(true),
  })
  .strict();
export const offerImportRetrySchema = z
  .object({
    revision: z.number().int().nonnegative(),
    analysisRequested: z.literal(true),
  })
  .strict();
export const offerImportSchema = z.object({
  id,
  documentId: id,
  name: z.string(),
  checksum: z.string(),
  size: z.number().int(),
  state: documentStateSchema,
  revision: z.number().int().nonnegative(),
  failure: z.string().nullable(),
  analysis: z.enum(["pending", "partial", "available", "absent", "unavailable"]),
  offerId: id.nullable(),
  createdAt: instant,
  canUpload: z.boolean(),
  canRetry: z.boolean(),
  canPrepare: z.boolean(),
  canDownload: z.boolean(),
});
export const offerImportsSchema = z.object({
  leadRevision: z.number().int().nonnegative(),
  items: z.array(offerImportSchema).max(20),
  nextCursor: z.string().nullable(),
});
export const offerImportResultSchema = z.object({
  leadRevision: z.number().int().nonnegative(),
  item: offerImportSchema,
});
export type OfferImport = z.infer<typeof offerImportSchema>;
export const offerExtractionSchema = z.object({
  documentId: id,
  sourceFingerprint: z.string().nullable().optional(),
  state: z.string(),
  company: z.string().nullable(),
  product: z.string().nullable(),
  annualPremiumMinor: z.number().int().nullable(),
  premiumOrigin: z.enum(["extracted", "calculated", "missing"]),
  premiumSource: z.string().nullable(),
  reference: z.string().nullable(),
  effectiveDate: z.iso.date().nullable(),
  analysisStatus: z.enum(["pending", "partial", "available", "absent", "unavailable"]).optional(),
  failure: z.string().nullable().optional(),
});
export const leadWaitSchema = z.object({ reason: text, until: instant }).strict();
export const collaborationTermsSchema = z
  .object({
    targetId: id,
    mode: z.enum(["one_off", "co_advice", "transfer"]),
    access: z.enum(["read", "contribute"]),
    communication: z.enum(["referent_only", "client_direct"]),
    scope: z.string().trim().min(10).max(2000),
    responsibilities: z.string().trim().min(10).max(2000),
    reason: text,
    economicNote: z.string().trim().min(10).max(2000),
    existingRightsPreserved: z.literal(true),
    transmissionConfirmed: z.literal(true),
  })
  .strict()
  .refine(
    (value) =>
      value.mode === "co_advice" ||
      (value.access === "contribute" && value.communication === "client_direct"),
  );
export const collaborationSchema = z.object({
  id,
  leadId: id,
  revision: z.number().int().nonnegative(),
  category: leadCategorySchema,
  proposerId: id,
  proposerName: z.string(),
  targetName: z.string(),
  terms: collaborationTermsSchema,
  state: z.enum(["proposed", "accepted", "declined", "cancelled", "ended"]),
  createdAt: instant,
  decidedAt: instant.nullable(),
  endedAt: instant.nullable(),
  response: z.string(),
  canRespond: z.boolean(),
  canEnd: z.boolean(),
  canOpenLead: z.boolean(),
});
export const collaborationListSchema = z.object({ items: z.array(collaborationSchema) });
export const collaborationResponseSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    decision: z.enum(["accept", "decline", "cancel", "end"]),
    reason: text,
  })
  .strict();
export type Collaboration = z.infer<typeof collaborationSchema>;
export type CollaborationTerms = z.infer<typeof collaborationTermsSchema>;
export type CollaborationResponse = z.infer<typeof collaborationResponseSchema>;
const counselHash = z.string().regex(/^[a-f0-9]{64}$/u);
export const counselRequestInputSchema = z
  .object({
    basis: counselHash,
    kind: z.enum(["specialist", "reassignment", "clarification"]),
    summary: z.string().trim().min(10).max(1500),
    nextAction: z.string().trim().min(3).max(240),
    dueAt: instant,
    shareConfirmed: z.literal(true),
  })
  .strict();
export type CounselRequestInput = z.infer<typeof counselRequestInputSchema>;
export const counselQuerySchema = z.object({ cursor: z.string().max(500).optional() }).strict();
export const counselActionInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.enum(["withdraw", "resolve"]),
      revision: z.number().int().nonnegative(),
      reason: text,
    })
    .strict(),
  z
    .object({
      action: z.literal("follow_up"),
      revision: z.number().int().nonnegative(),
      reason: text,
      nextAction: z.string().trim().min(3).max(240),
      dueAt: instant,
    })
    .strict(),
  z
    .object({
      action: z.literal("propose"),
      revision: z.number().int().nonnegative(),
      reason: text,
      nextAction: z.string().trim().min(3).max(240),
      dueAt: instant,
      candidateBasis: counselHash,
      terms: collaborationTermsSchema,
      humanReviewConfirmed: z.literal(true),
    })
    .strict(),
]);
export type CounselActionInput = z.infer<typeof counselActionInputSchema>;
export const counselRequestSchema = z.object({
  id,
  leadId: id,
  leadTitle: z.string(),
  authorName: z.string(),
  createdAt: instant,
  request: counselRequestInputSchema.omit({ basis: true, shareConfirmed: true }),
  revision: z.number().int().nonnegative(),
  state: z.enum([
    "open",
    "awaiting_specialist",
    "accepted",
    "withdrawn",
    "resolved",
    "context_changed",
  ]),
  nextAction: z.string(),
  dueAt: instant.nullable(),
  canWithdraw: z.boolean(),
  canAct: z.boolean(),
  collaboration: collaborationSchema.nullable(),
  history: z
    .array(
      z.object({
        revision: z.number().int().positive(),
        action: z.enum(["withdraw", "follow_up", "propose", "resolve"]),
        reason: z.string(),
        nextAction: z.string().nullable(),
        dueAt: instant.nullable(),
        recordedAt: instant,
      }),
    )
    .max(20),
});
export type CounselRequest = z.infer<typeof counselRequestSchema>;
export const counselQueueSchema = z.object({
  items: z.array(counselRequestSchema).max(20),
  nextCursor: z.string().nullable(),
});
export const counselPersonalSchema = z.object({
  basis: counselHash,
  assessedAt: instant,
  canRequest: z.boolean(),
  capacity: needCapacityDossierSchema.pick({ status: true, effectivePosition: true }),
  conflict: needConflictDossierSchema.pick({ status: true, effectivePosition: true }),
  expertise: needExpertiseDossierSchema.pick({ status: true, effectivePosition: true }),
  requests: counselQueueSchema,
});
const counselComparisonSchema = z.enum(["matches", "differs", "unknown", "not_applicable"]);
export const counselCandidateSchema = z.object({
  id,
  name: z.string(),
  organization: z.string(),
  basis: counselHash,
  assessedAt: instant,
  competence: competenceSummarySchema,
  competenceSourceStatus: needExpertiseEvidenceSchema.shape.competence.shape.sourceStatus,
  practice: professionalPracticeSummarySchema,
  capacity: capacityAdvisorAssessmentSchema.shape.capacity,
  language: counselComparisonSchema,
  region: counselComparisonSchema,
  mode: counselComparisonSchema,
  confirmedReferent: z.boolean(),
  availabilityDeclaredAt: instant.nullable(),
  remainingChecks: z
    .array(
      z.enum(["need_expertise", "need_capacity", "conflicts", "distribution", "client_agreement"]),
    )
    .length(5),
  decision: z.literal("human_review_required"),
});
export type CounselCandidate = z.infer<typeof counselCandidateSchema>;
export const counselCandidatesSchema = z.object({
  items: z.array(counselCandidateSchema).max(20),
  nextCursor: z.string().nullable(),
});
export const leadSummarySchema = z.object({
  id,
  revision: z.number().int().nonnegative(),
  title: z.string(),
  requestKind: leadRequestKindSchema.default("new_insurance"),
  category: leadCategorySchema,
  object: z.string(),
  clientName: z.string(),
  clientUserId: id.nullable(),
  clientProfileId: id.nullable(),
  stage: leadStageSchema,
  assignment: z.enum([
    "unassigned",
    "proposed",
    "accepted",
    "marketplace",
    "reassign",
    "coverview",
  ]),
  responsibleId: id.nullable(),
  responsibleName: z.string().nullable(),
  referrerId: id,
  priority: z.enum(["normal", "high", "urgent"]),
  nextAction: z.string(),
  dueAt: instant.nullable(),
  waiting: leadWaitSchema.nullable(),
  result: leadResultSchema.nullable(),
  reason: leadReasonSchema.nullable(),
  estimatedCommissionMinor: z.number().int().nonnegative().nullable(),
  notifiedAt: instant.nullable(),
  firstUsefulAt: instant.nullable(),
  firstActionDueAt: instant.nullable(),
  acceptanceDueAt: instant.nullable().optional(),
  continuityPolicyRevision: z.number().int().nonnegative().nullable().optional(),
  continuityDueAt: instant.nullable().optional(),
  escalationDueAt: instant.nullable().optional(),
  createdAt: instant,
  stageChangedAt: instant,
  updatedAt: instant,
  openTasks: z.number().int().nonnegative(),
  overdueTasks: z.number().int().nonnegative(),
  nextAppointmentAt: instant.nullable(),
  // Card context (brief II.6), for operational access only.
  referrerName: z.string().nullable().optional(),
  lastContactAt: instant.nullable().optional(),
  lastActivityAt: instant.nullable().optional(),
  indicators: z
    .array(
      z.enum([
        "stale",
        "urgent",
        "task_overdue",
        "appointment_today",
        "near_deadline",
        "coverview_needed",
      ]),
    )
    .default([]),
  alerts: z.array(
    z.enum([
      "first_action_due",
      "first_action_overdue",
      "acceptance_overdue",
      "overdue",
      "no_next_action",
      "waiting_expired",
      "unassigned",
      "task_overdue",
    ]),
  ),
  access: z.enum(["operational", "progress", "client"]),
  canEdit: z.boolean(),
  canAssign: z.boolean(),
  canCollaborate: z.boolean().optional(),
  allowedActions: z.array(z.string()).optional(),
});
export const leadDetailSchema = leadSummarySchema.extend({
  referentContinuity: referentContinuitySchema.nullable().default(null),
  context: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  language: z.string().nullable(),
  source: z.string().nullable(),
  insuranceRequestId: insuranceRequestIdSchema.nullable().default(null),
  transmissionAuthorized: z.boolean().nullable(),
  tasks: z.array(leadTaskSchema),
  appointments: z.array(
    leadAppointmentSchema.extend({
      participants: z.array(jointParticipantSchema).max(10).optional(),
    }),
  ),
  events: z.array(leadEventSchema),
  offers: z.array(leadOfferSchema),
  currentContract: currentContractSchema.nullable().default(null),
  comparisons: z.array(contractComparisonSchema).default([]),
  offerComparison: offerComparisonSchema.optional(),
  objectReference: z.string().nullable().optional(),
  // Automatic, never validated (orientation-v1); the advisor's recommendation stays separate.
  offerOrientation: leadOrientationSchema.optional(),
  recommendation: recommendationSchema.nullable().optional(),
  collaborations: z.array(collaborationSchema).default([]),
  participants: z
    .array(z.object({ id, name: z.string(), canContact: z.boolean(), canWork: z.boolean() }))
    .default([]),
  availableTabs: z.array(
    z.enum(["overview", "activity", "tasks", "appointments", "notes", "offers", "collaboration"]),
  ),
});
export const leadListQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    priority: z.enum(["normal", "high", "urgent"]).optional(),
    assignment: z
      .enum(["unassigned", "proposed", "accepted", "marketplace", "reassign", "coverview"])
      .optional(),
    result: leadResultSchema.optional(),
    waiting: z.enum(["active", "due", "none"]).optional(),
    createdFrom: z.iso.datetime({ offset: true }).optional(),
    createdTo: z.iso.datetime({ offset: true }).optional(),
    stage: leadStageSchema.optional(),
    category: leadCategorySchema.optional(),
    // Predefined views (brief II.10): every view and filter intersects the actor's visibility.
    view: z
      .enum([
        "mine",
        "all",
        "referred",
        "urgent",
        "overdue",
        "no_action",
        "closed",
        "team",
        "received",
        "marketplace",
        "waiting",
        "appointments_week",
        "signed",
        "lost",
      ])
      .default("mine"),
    clientUserId: id.optional(),
    clientProfileId: id.optional(),
    responsibleId: id.optional(),
    referrerId: id.optional(),
    organizationId: id.optional(),
    dueFrom: z.iso.datetime({ offset: true }).optional(),
    dueTo: z.iso.datetime({ offset: true }).optional(),
    source: z.string().trim().min(1).max(160).optional(),
    alert: z.enum(["any", "overdue", "no_next_action", "unassigned", "task_overdue"]).optional(),
    sort: z.enum(["created", "due", "stage_age"]).default("created"),
    cursor: z.string().max(150).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(60),
  })
  .strict();
export const leadListSchema = z.object({
  items: z.array(leadSummarySchema),
  nextCursor: z.string().nullable(),
  // The whole filtered set, not only this page: Kanban columns count every visible Lead.
  counts: z
    .object({
      total: z.number().int().nonnegative(),
      stages: z
        .array(z.object({ stage: leadStageSchema, count: z.number().int().nonnegative() }))
        .max(25),
    })
    .optional(),
});
export const leadCommandSchema = z
  .discriminatedUnion("action", [
    z
      .object({
        action: z.literal("reopen"),
        reason: z.string().trim().min(5).max(2000),
        nextAction: z.string().trim().min(2).max(240),
        dueAt: instant,
      })
      .strict(),
    z.object({ action: z.literal("edit"), lead: leadCreateInputSchema }),
    z.object({
      action: z.literal("next_action"),
      title: z.string().trim().min(2).max(240),
      dueAt: instant,
    }),
    z.object({
      action: z.literal("transition"),
      stage: leadStageSchema,
      appointmentId: id.optional(),
      offerId: id.optional(),
    }),
    z.object({
      action: z.literal("contact"),
      outcome: z.enum(["attempted", "reached"]),
      note: text,
      nextAction: z.string().trim().min(2).max(240),
      dueAt: instant,
    }),
    z.object({ action: z.literal("note"), text, audience: audienceSchema }),
    z.object({ action: z.literal("task"), task: leadTaskInputSchema }),
    z.object({
      action: z.literal("task_state"),
      taskId: id,
      state: z.enum(["open", "done", "cancelled"]),
    }),
    z.object({ action: z.literal("appointment"), appointment: leadAppointmentInputSchema }),
    z.object({
      action: z.literal("appointment_state"),
      appointmentId: id,
      state: z.enum(["completed", "cancelled", "client_absent", "advisor_absent"]),
      note: text,
    }),
    z.object({
      action: z.literal("assign"),
      responsibleId: id,
      reason: text,
      // Ranking the decision was taken against; a changed ranking requires a new review.
      matchingBasis: z
        .string()
        .regex(/^[a-f0-9]{64}$/u)
        .optional(),
    }),
    z.object({ action: z.literal("collaboration_propose"), terms: collaborationTermsSchema }),
    z.object({ action: z.literal("client_interlocutor"), reason: text }),
    z.object({
      action: z.literal("contract_link"),
      documentId: id,
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
      sameObjectConfirmed: z.literal(true),
      sharingConfirmed: z.literal(true),
    }),
    z.object({ action: z.literal("contract_unlink"), referenceId: id }),
    z.object({ action: z.literal("contract_review"), review: contractReviewInputSchema }),
    z.object({
      action: z.literal("final_policy_link"),
      documentId: id,
      offerId: id,
      fingerprint: z.string().regex(/^[a-f0-9]{64}$/u),
      sameObjectConfirmed: z.literal(true),
      sharingConfirmed: z.literal(true),
      receivedPolicyConfirmed: z.literal(true),
    }),
    z.object({ action: z.literal("final_policy_unlink"), policyId: id }),
    z.object({ action: z.literal("final_policy_review"), review: finalPolicyReviewSchema }),
    z.object({ action: z.literal("accept") }),
    z.object({ action: z.literal("wait"), waiting: leadWaitSchema.nullable() }),
    z.object({
      action: z.literal("close"),
      result: leadResultSchema,
      reason: leadReasonSchema,
      comment: text,
    }),
    z.object({ action: z.literal("offer"), offer: leadOfferInputSchema }),
    z.object({ action: z.literal("offer_review"), offerId: id }),
    z.object({ action: z.literal("offer_publish"), offerId: id }),
    offerWithdrawInputSchema.extend({ action: z.literal("offer_withdraw") }),
    z.object({
      action: z.literal("client_choice"),
      choice: z.enum(["select", "refuse", "keep_current", "question", "modification", "view"]),
      offerId: id.optional(),
      text: z.string().trim().max(2000),
    }),
  ])
  .and(z.object({ revision: z.number().int().nonnegative() }));
export const partnerDirectorySchema = z.object({
  items: z.array(
    z.object({
      id,
      name: z.string(),
      organization: z.string(),
      organizationId: id.optional(),
      categories: z.array(leadCategorySchema),
    }),
  ),
});
export const partnerApplicationsSchema = z.object({ items: z.array(partnerApplicationSchema) });
export const partnerDashboardSchema = z.object({
  active: z.number().int(),
  overdue: z.number().int(),
  unassigned: z.number().int(),
  resolved: z.number().int(),
  openTasks: z.number().int(),
  stages: z.array(z.object({ stage: leadStageSchema, count: z.number().int() })),
});
export const partnerWorkSchema = z.object({
  tasks: z.array(
    leadTaskSchema.extend({ leadId: id, leadTitle: z.string(), clientName: z.string() }),
  ),
  appointments: z.array(
    leadAppointmentSchema.extend({
      leadId: id,
      leadTitle: z.string(),
      clientName: z.string(),
      // Set when the reader joins an appointment hosted on another request (C6b): the item then
      // shows that appointment through the reader's own request.
      participation: z
        .object({ id, state: jointParticipationStateSchema, termsCurrent: z.boolean() })
        .optional(),
    }),
  ),
  truncated: z.boolean(),
});
export const partnerErrors = [
  "PARTNER_ACCESS_DENIED",
  "PARTNER_NOT_FOUND",
  "PARTNER_CONFLICT",
  "PARTNER_INVALID_TRANSITION",
  "PARTNER_ACTION_REQUIRED",
  "PARTNER_INVALID_CLIENT",
  "PARTNER_INVALID_ASSIGNEE",
  "PARTNER_INVALID_DOCUMENT",
  "PARTNER_OFFER_NOT_READY",
  "PARTNER_OFFER_EXPIRED",
  "PARTNER_IDEMPOTENCY_REUSED",
  "PARTNER_APPOINTMENT_CONFLICT",
  "PARTNER_UNAVAILABLE",
  "PARTNER_RATE_LIMITED",
] as const;
export type PartnerApplication = z.infer<typeof partnerApplicationSchema>;
export type MemberRestrictions = z.infer<typeof memberRestrictionsSchema>;
export type PartnerContext = z.infer<typeof partnerContextSchema>;
export type LeadCreateInput = z.infer<typeof leadCreateInputSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export type LeadCommand = z.infer<typeof leadCommandSchema>;
export type LeadSummary = z.infer<typeof leadSummarySchema>;
export type LeadDetail = z.infer<typeof leadDetailSchema>;
export type LeadOffer = z.infer<typeof leadOfferSchema>;
export type LeadStage = z.infer<typeof leadStageSchema>;
