import { z } from "zod";
import { leadSummarySchema } from "./partner.js";
const id = z.string().min(1).max(100),
  revision = z.number().int().nonnegative(),
  reason = z.string().trim().min(5).max(2000);
export const leadRelationshipInputSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("link"),
      sourceRevision: revision,
      targetRevision: revision,
      targetLeadId: id,
      kind: z.enum(["related", "duplicate"]),
      reason,
      confirmed: z.literal(true),
      cancelOpenWork: z.boolean(),
    })
    .strict()
    .refine(
      (v) => v.kind !== "duplicate" || v.cancelOpenWork,
      "Explicit duplicate closure confirmation required",
    ),
  z
    .object({
      action: z.literal("withdraw"),
      id,
      sourceRevision: revision,
      targetRevision: revision,
      reason,
      nextAction: z.string().trim().min(2).max(240).optional(),
      dueAt: z.iso.datetime({ offset: true }).optional(),
    })
    .strict(),
]);
export const leadRelationshipBlockerSchema = z.enum([
  "canonical_subject",
  "inactive",
  "signature",
  "conclusion",
  "protected_follow_up",
  "existing_group",
]);
export const leadRelationshipAssessmentSchema = z.object({
  canGroup: z.boolean(),
  canMerge: z.boolean(),
  blockers: z.array(leadRelationshipBlockerSchema),
  openTasks: z.number().int().nonnegative().nullable(),
  futureAppointments: z.number().int().nonnegative().nullable(),
});
export const leadRelationshipsSchema = z.object({
  leadRevision: revision,
  assessment: leadRelationshipAssessmentSchema,
  items: z
    .array(
      z.object({
        id,
        source: leadSummarySchema,
        target: leadSummarySchema,
        kind: z.enum(["related", "duplicate"]),
        reason: z.string(),
        createdAt: z.iso.datetime(),
        active: z.boolean(),
        withdrawnAt: z.iso.datetime().nullable(),
        withdrawalReason: z.string().nullable(),
        canWithdraw: z.boolean(),
      }),
    )
    .max(20),
  nextCursor: z.string().nullable(),
});
export const leadRelationshipCandidatesSchema = z.object({
  items: z
    .array(z.object({ lead: leadSummarySchema, canGroup: z.boolean(), canMerge: z.boolean() }))
    .max(20),
  nextCursor: z.string().nullable(),
});
export type LeadRelationshipInput = z.infer<typeof leadRelationshipInputSchema>;
export type LeadRelationshipBlocker = z.infer<typeof leadRelationshipBlockerSchema>;
