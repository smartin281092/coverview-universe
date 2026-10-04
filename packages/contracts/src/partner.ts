import { z } from "zod";

const id = z.string().min(1).max(100);
const text = z.string().trim().min(1).max(2000);
const instant = z.iso.datetime({ offset: true });
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
export const leadEventSchema = z.object({
  id,
  kind: z.string(),
  authorId: id,
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
    origin: z.enum(["extracted", "manual", "calculated", "missing"]),
    verification: z.enum(["to_verify", "verified", "missing"]),
    source: z.string().trim().max(300),
  })
  .strict();
export const leadOfferInputSchema = z
  .object({
    company: z.string().trim().min(2).max(160),
    product: z.string().trim().min(2).max(200),
    documentId: id,
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
});
export const offerExtractionSchema = z.object({
  documentId: id,
  state: z.string(),
  company: z.string().nullable(),
  product: z.string().nullable(),
  annualPremiumMinor: z.number().int().nullable(),
  premiumOrigin: z.enum(["extracted", "calculated", "missing"]),
  premiumSource: z.string().nullable(),
  reference: z.string().nullable(),
  effectiveDate: z.iso.date().nullable(),
});
export const leadWaitSchema = z.object({ reason: text, until: instant }).strict();
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
});
export const leadDetailSchema = leadSummarySchema.extend({
  context: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  language: z.string().nullable(),
  source: z.string().nullable(),
  transmissionAuthorized: z.boolean().nullable(),
  tasks: z.array(leadTaskSchema),
  appointments: z.array(leadAppointmentSchema),
  events: z.array(leadEventSchema),
  offers: z.array(leadOfferSchema),
  availableTabs: z.array(
    z.enum(["overview", "activity", "tasks", "appointments", "notes", "offers"]),
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
    z.object({ action: z.literal("offer_withdraw"), offerId: id, reason: text }),
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
