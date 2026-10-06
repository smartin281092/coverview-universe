import { z } from "zod";
import { insuranceCompanyIdSchema } from "./companies.js";
import {
  applicationStateSchema,
  leadCategorySchema,
  memberRestrictionsSchema,
  partnerApplicationSchema,
  partnerRoleSchema,
} from "./partner.js";

const id = z.string().min(1).max(100);
const instant = z.iso.datetime({ offset: true });
const reason = z.string().trim().min(5).max(2000);

// Access decisions (C8a, brief I.4): restrictions, organisation reviews and their journal.
export const restrictionInputSchema = z
  .object({
    restrictionRevision: z.number().int().nonnegative(),
    newLeads: z.boolean(),
    leadCreation: z.boolean(),
    marketplace: z.boolean(),
    categories: z.array(leadCategorySchema).max(7),
    reviewAt: instant.nullable(),
    reason,
  })
  .strict();
export const organizationReviewInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    state: applicationStateSchema.exclude(["draft", "submitted"]),
    reason,
    reviewDueAt: instant.nullable(),
  })
  .strict();
export const accessDecisionKindSchema = z.enum([
  "member_review",
  "organization_review",
  "restriction",
  "automatic_review",
  "team_removal",
]);
export const accessDecisionSchema = z.object({
  id,
  kind: accessDecisionKindSchema,
  subject: z.enum(["member", "organization"]),
  userId: id.nullable(),
  organizationId: id,
  state: applicationStateSchema.nullable(),
  roles: z.array(partnerRoleSchema).nullable(),
  restrictions: memberRestrictionsSchema.nullable(),
  reason: z.string().nullable(),
  reviewDueAt: instant.nullable(),
  // Who decided: CoverView, the organisation's manager (C8b) or the automatic re-review.
  author: z.enum(["coverview", "manager", "system"]),
  at: instant,
});
export const accessDecisionsSchema = z.object({
  items: z.array(accessDecisionSchema).max(50),
});
export const accessFilterSchema = z.enum(["all", "pending", "reviews", "restricted", "proofs"]);
export const accessQuerySchema = z.object({ filter: accessFilterSchema.default("all") }).strict();
// A professional proof whose CoverView review reaches its end date within 30 days, or already did.
export const accessProofSchema = z.object({
  kind: z.enum(["competence", "convention"]),
  category: leadCategorySchema,
  companyId: insuranceCompanyIdSchema.nullable(),
  validUntil: instant,
  state: z.enum(["expired", "soon"]),
});
const due = z.enum(["lapsed", "soon"]).nullable();
export const accessItemSchema = z.object({
  application: partnerApplicationSchema,
  organizationName: z.string(),
  flags: z.object({
    review: due,
    organizationReview: due,
    restricted: z.boolean(),
    restrictionReview: due,
  }),
  proofs: z.array(accessProofSchema).max(30),
  activeLeads: z.number().int().nonnegative(),
});
export const accessQueueSchema = z.object({
  filter: accessFilterSchema,
  items: z.array(accessItemSchema).max(100),
  counts: z.object({
    pending: z.number().int().nonnegative(),
    reviews: z.number().int().nonnegative(),
    restricted: z.number().int().nonnegative(),
    proofs: z.number().int().nonnegative(),
  }),
});
export const organizationAccessSchema = z.object({
  id,
  name: z.string(),
  state: applicationStateSchema,
  revision: z.number().int().nonnegative(),
  reviewReason: z.string().nullable(),
  reviewedAt: instant.nullable(),
  reviewDueAt: instant.nullable(),
  members: z
    .array(
      z.object({
        userId: id,
        name: z.string(),
        state: applicationStateSchema,
        roles: z.array(partnerRoleSchema),
      }),
    )
    .max(100),
  // Requests whose responsible or contributor would lose access if the organisation is blocked.
  activeLeads: z.number().int().nonnegative(),
  decisions: z.array(accessDecisionSchema).max(50),
});
export type RestrictionInput = z.infer<typeof restrictionInputSchema>;
export type OrganizationReviewInput = z.infer<typeof organizationReviewInputSchema>;
export type AccessDecision = z.infer<typeof accessDecisionSchema>;
export type AccessFilter = z.infer<typeof accessFilterSchema>;
export type AccessItem = z.infer<typeof accessItemSchema>;
export type AccessQueue = z.infer<typeof accessQueueSchema>;
export type OrganizationAccess = z.infer<typeof organizationAccessSchema>;
