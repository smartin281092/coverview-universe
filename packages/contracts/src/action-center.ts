import { z } from "zod";
import { managedProfileIdSchema } from "./managed-profiles.js";
import { companyActionSchema, serviceRequestSchema } from "./company-actions.js";
import { insuranceCompanyIdSchema } from "./companies.js";
import { documentIdSchema } from "./documents.js";
import { authorizationIdSchema } from "./authorizations.js";

export const actionCenterIdSchema = z.string().regex(/^act_[0-9a-f]{32}$/);
export const actionCenterValuesSchema = z
  .record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,99}$/), z.string().min(1).max(240))
  .refine((value) => Object.keys(value).length <= 20);
export const actionCenterKindSchema = z.enum([
  "profile_review",
  "company_notification",
  "authorization",
  "profile_completion",
]);
export const actionCenterChoiceIdSchema = z.enum([
  "keep",
  "variant",
  "correct",
  "notify",
  "custom",
]);
export const actionCenterSourceSchema = z.object({
  documentId: documentIdSchema,
  title: z.string().max(240),
  companyId: insuranceCompanyIdSchema.nullable(),
  policyNumber: z.string().max(240).nullable(),
});
export const actionCenterVariantSchema = z.object({
  id: z.string().regex(/^var_[0-9a-f]{24}$/),
  values: actionCenterValuesSchema,
  sources: z.array(actionCenterSourceSchema).max(200),
});
export const actionCenterRequirementSchema = z.object({
  kind: z.enum(["lsa45", "procuration", "management_mandate", "profile_information"]),
  state: z.enum(["missing", "complete", "unavailable"]),
  profileId: managedProfileIdSchema,
  step: z.enum(["information", "contact", "details"]).nullable(),
  completedAt: z.iso.datetime().nullable(),
});
export const actionCenterItemSchema = z.object({
  id: actionCenterIdSchema,
  profileId: managedProfileIdSchema,
  profileName: z.string().max(160),
  topic: z.string().min(1).max(100),
  kind: actionCenterKindSchema,
  state: z.enum(["pending", "in_progress", "complete"]),
  fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  profileRevision: z.number().int().nonnegative(),
  currentValues: actionCenterValuesSchema,
  variants: z.array(actionCenterVariantSchema).max(200),
  companies: z.array(companyActionSchema).max(11),
  choices: z
    .array(
      z.object({
        id: actionCenterChoiceIdSchema,
        labelKey: z.string().min(1).max(100),
        recommended: z.boolean(),
        enabled: z.boolean(),
      }),
    )
    .max(5),
  requirements: z.array(actionCenterRequirementSchema).max(5),
  requiredFields: z.array(z.string().max(100)).max(20),
  canResolve: z.boolean(),
  resolvedAt: z.iso.datetime().nullable(),
});
export const actionCenterSummarySchema = z.object({
  pending: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  completionPercent: z.number().int().min(0).max(100),
  optimizationPercent: z.number().int().min(0).max(100),
  incomplete: z.boolean(),
});
export const actionCenterQuerySchema = z
  .object({
    profileId: managedProfileIdSchema.optional(),
    cursor: z.string().max(500).optional(),
    state: z.enum(["pending", "in_progress"]).optional(),
  })
  .strict();
export const actionCenterListSchema = z.object({
  actions: z.array(actionCenterItemSchema).max(20),
  summary: actionCenterSummarySchema,
  nextCursor: z.string().max(500).nullable(),
});
export const actionCenterHistoryItemSchema = z.object({
  id: z.uuid(),
  actionId: actionCenterIdSchema,
  profileId: managedProfileIdSchema,
  profileName: z.string().max(160),
  topic: z.string().max(100),
  kind: actionCenterKindSchema,
  choice: z.enum([
    "keep",
    "variant",
    "correct",
    "notify",
    "custom",
    "manual_completed",
    "opened",
    "signed",
  ]),
  beforeValues: actionCenterValuesSchema,
  afterValues: actionCenterValuesSchema,
  response: z.string().max(2000).nullable(),
  sources: z.array(actionCenterSourceSchema).max(200),
  createdAt: z.iso.datetime(),
  actor: z.enum(["owner", "administrator"]),
  authorizationEvidence: z
    .object({
      version: z.string().min(1).max(100),
      signatureId: authorizationIdSchema.nullable(),
      revokedAt: z.iso.datetime().nullable(),
    })
    .optional(),
});
export const actionCenterHistorySchema = z.object({
  entries: z.array(actionCenterHistoryItemSchema).max(20),
  nextCursor: z.string().max(500).nullable(),
  incomplete: z.boolean().default(false),
});
export const actionCenterDetailsSchema = z.object({
  action: actionCenterItemSchema,
  previousId: actionCenterIdSchema.nullable(),
  nextId: actionCenterIdSchema.nullable(),
});
export const actionCenterResolveInputSchema = z
  .object({
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    choice: actionCenterChoiceIdSchema,
    variantId: z
      .string()
      .regex(/^var_[0-9a-f]{24}$/)
      .optional(),
    values: actionCenterValuesSchema.optional(),
    response: z.string().trim().min(1).max(2000).optional(),
  })
  .strict();
export const actionCenterResolveResultSchema = z.object({
  resolution: actionCenterHistoryItemSchema,
  action: actionCenterItemSchema,
  summary: actionCenterSummarySchema,
  nextId: actionCenterIdSchema.nullable(),
  requests: z.array(serviceRequestSchema).max(11),
});
export const actionCenterManualReviewSchema = z.object({
  id: z.uuid(),
  userId: z.string().max(100),
  actionId: actionCenterIdSchema,
  profileId: managedProfileIdSchema,
  profileName: z.string().max(160),
  topic: z.string().max(100),
  response: z.string().max(2000),
  state: z.enum(["requested", "in_progress", "resolved"]),
  revision: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  resolution: z.string().max(2000).nullable(),
});
export const actionCenterManualReviewsSchema = z.object({
  reviews: z.array(actionCenterManualReviewSchema).max(20),
  nextCursor: z.string().max(500).nullable(),
});
export const actionCenterManualTransitionInputSchema = z
  .object({
    userId: z.string().min(1).max(100),
    id: z.uuid(),
    revision: z.number().int().nonnegative(),
    state: z.enum(["in_progress", "resolved"]),
    resolution: z.string().trim().min(1).max(2000).optional(),
  })
  .strict()
  .refine((input) => input.state !== "resolved" || !!input.resolution);
export type ActionCenterItem = z.infer<typeof actionCenterItemSchema>;
export type ActionCenterSummary = z.infer<typeof actionCenterSummarySchema>;
export type ActionCenterSource = z.infer<typeof actionCenterSourceSchema>;
export type ActionCenterVariant = z.infer<typeof actionCenterVariantSchema>;
export type ActionCenterRequirement = z.infer<typeof actionCenterRequirementSchema>;
export type ActionCenterHistoryItem = z.infer<typeof actionCenterHistoryItemSchema>;
export type ActionCenterResolveInput = z.infer<typeof actionCenterResolveInputSchema>;
export type ActionCenterResolveResult = z.infer<typeof actionCenterResolveResultSchema>;
export type ActionCenterManualReview = z.infer<typeof actionCenterManualReviewSchema>;
export type ActionCenterManualTransitionInput = z.infer<
  typeof actionCenterManualTransitionInputSchema
>;
