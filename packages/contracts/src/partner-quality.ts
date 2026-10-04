import { z } from "zod";

const id = z.string().min(1).max(100);
const instant = z.iso.datetime({ offset: true });
const text = z.string().trim().min(10).max(2000);
export const qualityPageQuerySchema = z
  .object({
    cursor: z.string().max(400).optional(),
    state: z.enum(["open", "closed", "all"]).default("open"),
  })
  .strict();
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
      "verify",
      "close",
      "reopen",
    ]),
    note: text,
    nextAction: z.string().trim().max(500),
    dueAt: instant.nullable(),
    sharedWithClient: z.boolean(),
    sharedWithAuthor: z.boolean().default(false),
    verified: z.boolean(),
  })
  .strict()
  .superRefine((v, ctx) => {
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
});
export const qualityQueueSchema = z.object({
  items: z.array(
    qualityCaseSchema.omit({ history: true, nextHistoryRevision: true, survey: true }),
  ),
  nextCursor: z.string().nullable(),
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
