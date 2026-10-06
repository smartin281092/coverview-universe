import { z } from "zod";

const id = z.string().min(1).max(100);
const instant = z.iso.datetime({ offset: true });
const text = z.string().trim().min(10).max(2000);
export const qualityPageQuerySchema = z
  .object({
    cursor: z.string().max(400).optional(),
    state: z.enum(["open", "closed", "all"]).default("open"),
    // C8d: the CoverView queue of possibly undeclared contracts (brief I.19.2).
    reason: z.enum(["all", "undeclared_contract"]).default("all"),
  })
  .strict();
// What the client states about a request (C8d, brief I.17.2). "unknown" never creates a discrepancy.
export const factAnswerSchema = z.enum(["yes", "no", "unknown"]);
export const clientFactsSchema = z
  .object({
    contact: factAnswerSchema,
    appointment: factAnswerSchema,
    documents: factAnswerSchema,
    contract: factAnswerSchema,
    insurer: z.string().trim().max(120).nullable().default(null),
    signedOn: z.iso.date().nullable().default(null),
  })
  .strict();
export const discrepancySchema = z.enum([
  "contract_undeclared",
  "contract_unconfirmed",
  "contact_unconfirmed",
  "appointment_unconfirmed",
  "documents_unconfirmed",
]);
export const verificationOutcomeSchema = z.enum(["confirmed", "unfounded", "inconclusive"]);
export const surveyPositiveSchema = z.enum([
  "advice",
  "availability",
  "responsiveness",
  "clarity",
  "listening",
  "professionalism",
  "simplicity",
  "solutions",
]);
export const surveyImprovementSchema = z.enum([
  "contact",
  "availability",
  "clarity",
  "listening",
  "follow_up",
  "documents",
  "solutions",
  "other",
]);
export const surveyResponseInputSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    experience: z.enum(["coverview", "advisor", "insurer", "overall"]),
    positives: z.array(surveyPositiveSchema).max(8),
    improvements: z.array(surveyImprovementSchema).max(8),
    comment: z.string().trim().max(2000),
    callbackRequested: z.boolean(),
    // Factual answers, kept apart from the rating as a client confirmation (C8d).
    facts: clientFactsSchema.optional(),
    confirmed: z.literal(true),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      new Set(v.positives).size !== v.positives.length ||
      new Set(v.improvements).size !== v.improvements.length
    )
      ctx.addIssue({ code: "custom", path: ["rating"] });
    if (v.rating === 5 && (v.improvements.length || v.callbackRequested))
      ctx.addIssue({ code: "custom", path: ["improvements"] });
    if (v.rating < 5 && v.positives.length) ctx.addIssue({ code: "custom", path: ["positives"] });
  });
export const surveySchema = z.object({
  id,
  leadId: id,
  title: z.string(),
  category: z.string(),
  result: z.string(),
  completedAt: instant,
  invitedAt: instant,
  responseAt: instant.nullable(),
  response: surveyResponseInputSchema.nullable(),
  caseId: id.nullable(),
  googleReviewUrl: z.url().nullable(),
  googleStatus: z.enum(["not_applicable", "available", "not_configured"]),
  delivery: z.literal("wallet"),
  canRespond: z.boolean(),
});
export const surveysSchema = z.object({
  items: z.array(surveySchema),
  nextCursor: z.string().nullable(),
});
export const qualityKindSchema = z.enum([
  "complaint",
  "callback",
  "verification",
  "corrective_action",
]);
export const qualityCreateSchema = z
  .object({
    kind: qualityKindSchema,
    summary: text,
    priority: z.enum(["normal", "high", "urgent"]),
    sharedWithClient: z.boolean(),
    confirmed: z.literal(true),
  })
  .strict();
export const qualityActionInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    action: z.enum([
      "take_charge",
      "follow_up",
      "request_explanation",
      "request_reconciliation",
      "verify",
      "close",
      "reopen",
    ]),
    note: text,
    nextAction: z.string().trim().max(500),
    dueAt: instant.nullable(),
    sharedWithClient: z.boolean(),
    sharedWithAuthor: z.boolean().default(false),
    // C8d: the professional asked to reconcile the declared state reads what is shared with them.
    sharedWithProfessional: z.boolean().default(false),
    professionalId: id.optional(),
    outcome: verificationOutcomeSchema.optional(),
    verified: z.boolean(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.action === "request_reconciliation") !== !!v.professionalId)
      ctx.addIssue({ code: "custom", path: ["professionalId"] });
    if (v.outcome && v.action !== "close") ctx.addIssue({ code: "custom", path: ["outcome"] });
    if (v.action === "close") {
      if (!v.verified || v.dueAt !== null || v.nextAction !== "")
        ctx.addIssue({ code: "custom", path: ["verified"] });
    } else if (!v.dueAt || v.nextAction.length < 5)
      ctx.addIssue({ code: "custom", path: ["nextAction"] });
  });
export const qualityClientReplySchema = z
  .object({ expectedRevision: z.number().int().min(0), note: text })
  .strict();
export const qualityHistorySchema = z.object({
  revision: z.number().int().positive(),
  action: z.string(),
  note: z.string(),
  actorName: z.string(),
  createdAt: instant,
  nextAction: z.string(),
  dueAt: instant.nullable(),
  sharedWithClient: z.boolean(),
  verified: z.boolean(),
  sharedWithAuthor: z.boolean(),
  sharedWithProfessional: z.boolean().default(false),
  outcome: verificationOutcomeSchema.nullable().default(null),
});
// A client confirmation as CoverView and the reconciling professional read it: the facts, what the
// request declared at that moment and the differences, never the client's free comment.
export const caseConfirmationSchema = z.object({
  id,
  channel: z.enum(["survey", "wallet", "call", "email"]),
  facts: clientFactsSchema,
  declared: z.object({
    contact: z.boolean(),
    appointment: z.boolean(),
    documents: z.boolean(),
    contract: z.boolean(),
  }),
  discrepancies: z.array(discrepancySchema),
  createdAt: instant,
});
export const qualityCaseSchema = z.object({
  id,
  leadId: id,
  title: z.string(),
  kind: qualityKindSchema,
  summary: z.string(),
  priority: z.enum(["normal", "high", "urgent"]),
  accountableUnit: z.literal("coverview"),
  assignedTo: z.string().nullable(),
  state: z.enum(["open", "in_progress", "closed"]),
  revision: z.number().int(),
  nextAction: z.string(),
  dueAt: instant.nullable(),
  overdue: z.boolean(),
  createdAt: instant,
  canManage: z.boolean(),
  canReply: z.boolean(),
  canShareWithClient: z.boolean(),
  canShareWithAuthor: z.boolean(),
  history: z.array(qualityHistorySchema),
  nextHistoryRevision: z.number().int().nullable(),
  survey: surveyResponseInputSchema.nullable(),
  // C8d: verification of a client statement, reconciliation asked to a professional, outcome.
  confirmations: z.array(caseConfirmationSchema).max(10).default([]),
  reconciliation: z
    .object({ professionalId: id, name: z.string(), requestedAt: instant })
    .nullable()
    .default(null),
  outcome: verificationOutcomeSchema.nullable().default(null),
  canRequestReconciliation: z.boolean().default(false),
  // For CoverView: the request's current responsible, to whom a reconciliation is asked.
  reconciliationTarget: z.object({ userId: id, name: z.string() }).nullable().default(null),
});
export const qualityQueueSchema = z.object({
  items: z.array(
    qualityCaseSchema.omit({ history: true, nextHistoryRevision: true, survey: true }),
  ),
  nextCursor: z.string().nullable(),
  // Open verifications of a contract the client reports and the request does not declare.
  undeclaredContracts: z.number().int().nonnegative().nullable().default(null),
});
// A client tells CoverView about a request from Wallet, at any time (C8d).
export const walletConfirmationInputSchema = z
  .object({
    facts: clientFactsSchema,
    comment: z.string().trim().max(2000).default(""),
    confirmed: z.literal(true),
  })
  .strict();
// CoverView records what the client said during a quality call or email (C8d).
export const qualityContactInputSchema = z
  .object({
    channel: z.enum(["call", "email"]),
    facts: clientFactsSchema,
    note: text,
    occurredAt: instant,
    confirmed: z.literal(true),
  })
  .strict();
// What the client reads of their own statements: never the declared state, the differences or
// whether a verification followed.
export const clientConfirmationSchema = z.object({
  id,
  channel: z.enum(["survey", "wallet", "call", "email"]),
  facts: clientFactsSchema,
  comment: z.string(),
  createdAt: instant,
});
export const clientConfirmationsSchema = z.object({
  items: z.array(clientConfirmationSchema).max(100),
  truncated: z.boolean(),
});
export const qualitySettingsInputSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    googleReviewUrl: z.url().nullable(),
    sourceReference: text,
    reviewed: z.literal(true),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.googleReviewUrl) return;
    const parts =
      /^https:\/\/(g\.page|maps\.app\.goo\.gl|search\.google\.com|maps\.google\.com|www\.google\.com)(\/[^#\s]*)$/u.exec(
        v.googleReviewUrl,
      );
    const hostname = parts?.[1],
      pathname = parts?.[2]?.split("?")[0];
    if (
      !parts ||
      !pathname ||
      pathname === "/" ||
      (hostname === "www.google.com" && pathname !== "/maps" && !pathname.startsWith("/maps/")) ||
      (hostname === "search.google.com" && pathname !== "/local/writereview")
    )
      ctx.addIssue({ code: "custom", path: ["googleReviewUrl"] });
  });
export const qualitySettingsSchema = z.object({
  revision: z.number().int(),
  googleReviewUrl: z.url().nullable(),
  sourceReference: z.string(),
  configuredAt: instant.nullable(),
});
export type SurveyResponseInput = z.infer<typeof surveyResponseInputSchema>;
export type QualityActionInput = z.infer<typeof qualityActionInputSchema>;
export type QualityCase = z.infer<typeof qualityCaseSchema>;
export type ClientFacts = z.input<typeof clientFactsSchema>;
export type WalletConfirmationInput = z.input<typeof walletConfirmationInputSchema>;
export type QualityContactInput = z.input<typeof qualityContactInputSchema>;
export type ClientConfirmation = z.infer<typeof clientConfirmationSchema>;
export type CaseConfirmation = z.infer<typeof caseConfirmationSchema>;
export type Discrepancy = z.infer<typeof discrepancySchema>;
