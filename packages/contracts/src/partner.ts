import { z } from "zod";
import {
  currentContractSchema,
  contractComparisonSchema,
  contractReviewInputSchema,
} from "./partner-contract.js";
export * from "./partner-contract.js";
export * from "./partner-final-policy.js";
import { finalPolicyReviewSchema } from "./partner-final-policy.js";
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
export const partnerApplicationSchema = partnerApplicationInputSchema.extend({
  userId: id,
  organizationId: id,
  state: applicationStateSchema,
  organizationState: applicationStateSchema,
  grantedRoles: z.array(partnerRoleSchema),
  revision: z.number().int().nonnegative(),
  reviewReason: z.string().nullable(),
  reviewedAt: instant.nullable(),
  reviewDueAt: instant.nullable(),
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
export const leadCreateInputSchema = z
  .object({
    title: z.string().trim().min(3).max(180),
    category: leadCategorySchema,
    object: z.string().trim().max(200),
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
    mode: z.enum(["phone", "video", "office", "home"]),
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
  reviewedBy: id.nullable().optional(),
  publishedBy: id.nullable().optional(),
});
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
export const leadSummarySchema = z.object({
  id,
  revision: z.number().int().nonnegative(),
  title: z.string(),
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
  appointments: z.array(leadAppointmentSchema),
  events: z.array(leadEventSchema),
  offers: z.array(leadOfferSchema),
  currentContract: currentContractSchema.nullable().default(null),
  comparisons: z.array(contractComparisonSchema).default([]),
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
    stage: leadStageSchema.optional(),
    category: leadCategorySchema.optional(),
    view: z
      .enum(["mine", "all", "referred", "urgent", "overdue", "no_action", "closed"])
      .default("mine"),
    clientUserId: id.optional(),
    clientProfileId: id.optional(),
    responsibleId: id.optional(),
    cursor: z.string().max(150).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(60),
  })
  .strict();
export const leadListSchema = z.object({
  items: z.array(leadSummarySchema),
  nextCursor: z.string().nullable(),
});
export const leadCommandSchema = z
  .discriminatedUnion("action", [
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
    z.object({ action: z.literal("assign"), responsibleId: id, reason: text }),
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
    leadAppointmentSchema.extend({ leadId: id, leadTitle: z.string(), clientName: z.string() }),
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
] as const;
export type PartnerApplication = z.infer<typeof partnerApplicationSchema>;
export type PartnerContext = z.infer<typeof partnerContextSchema>;
export type LeadCreateInput = z.infer<typeof leadCreateInputSchema>;
export type LeadListQuery = z.infer<typeof leadListQuerySchema>;
export type LeadCommand = z.infer<typeof leadCommandSchema>;
export type LeadSummary = z.infer<typeof leadSummarySchema>;
export type LeadDetail = z.infer<typeof leadDetailSchema>;
export type LeadOffer = z.infer<typeof leadOfferSchema>;
export type LeadStage = z.infer<typeof leadStageSchema>;
