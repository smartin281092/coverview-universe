import { z } from "zod";
import { leadCategorySchema } from "./partner.js";
import { leadAppointmentModeSchema } from "./partner-advice.js";
import { surveyImprovementSchema, surveyPositiveSchema } from "./partner-quality.js";

const id = z.string().min(1).max(100),
  count = z.number().int().nonnegative(),
  instant = z.iso.datetime({ offset: true }),
  reason = z.string().trim().min(5).max(2000);

// Public client-experience note: shown only with enough observations, with period and method.
export const publicRatingSchema = z.object({
  status: z.enum(["available", "insufficient"]),
  average: z.number().min(1).max(5).nullable(),
  count,
  minimum: count,
  periodFrom: instant,
  periodTo: instant,
  method: z.literal("client-surveys-12m-v1"),
});
export const publicProfileSchema = z.object({
  userId: id,
  name: z.string(),
  organization: z.string(),
  presentation: z.string(),
  // Derived from current validated sources at reading time, never typed by the person.
  specialties: z.array(leadCategorySchema),
  languages: z.array(z.string()),
  cantons: z.array(z.string()),
  modes: z.array(leadAppointmentModeSchema),
  publishedAt: instant,
  rating: publicRatingSchema,
});
export const profileVersionSchema = z.object({
  revision: z.number().int().positive(),
  presentation: z.string(),
  status: z.enum(["submitted", "published", "rejected", "withdrawn"]),
  submittedAt: instant,
  decidedAt: instant.nullable(),
  decisionReason: z.string().nullable(),
});
export const profileDossierSchema = z.object({
  userId: id,
  name: z.string(),
  organization: z.string(),
  canEdit: z.boolean(),
  canReview: z.boolean(),
  current: profileVersionSchema.nullable(),
  published: publicProfileSchema.nullable(),
  history: z.array(profileVersionSchema).max(20),
});
export const profileInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    presentation: z.string().trim().min(40).max(1200),
    confirmed: z.literal(true),
  })
  .strict();
export const profileReviewSchema = z
  .object({
    revision: z.number().int().positive(),
    decision: z.enum(["published", "rejected"]),
    reason,
  })
  .strict();
export const profileQueueSchema = z.object({
  items: z
    .array(
      z.object({
        userId: id,
        name: z.string(),
        organization: z.string(),
        revision: z.number().int().positive(),
        submittedAt: instant,
      }),
    )
    .max(50),
});

export const evaluationSubjectSchema = z.enum(["survey", "quality_case"]);
export const evaluationContestSchema = z.object({
  id,
  subjectKind: evaluationSubjectSchema,
  subjectId: id,
  reason: z.string(),
  status: z.enum(["pending", "accepted", "rejected"]),
  createdAt: instant,
  decidedAt: instant.nullable(),
  decisionReason: z.string().nullable(),
});
export const evaluationSchema = z.object({
  userId: id,
  name: z.string(),
  periodFrom: instant,
  periodTo: instant,
  // Client experience: never inferred from conversion or contract outcomes.
  clientExperience: z.object({
    rating: publicRatingSchema,
    distribution: z.array(count).length(5),
    positives: z.array(z.object({ key: surveyPositiveSchema, count })),
    improvements: z.array(z.object({ key: surveyImprovementSchema, count })),
  }),
  operational: z.object({
    assigned: count,
    onTime: count,
    onTimeRate: z.number().min(0).max(100).nullable(),
    complaints: count,
    complaintsClosed: count,
    activeLeads: count,
    followedUp: count,
  }),
  // Restricted to the person and CoverView administration.
  economic: z
    .object({
      cases: count,
      disputed: count,
      clawbacks: count,
    })
    .nullable(),
  contests: z.array(evaluationContestSchema).max(20),
  contestable: z
    .array(
      z.object({
        subjectKind: evaluationSubjectSchema,
        subjectId: id,
        leadTitle: z.string(),
        occurredAt: instant,
        rating: z.number().int().min(1).max(5).nullable(),
      }),
    )
    .max(20),
  canContest: z.boolean(),
});
export const evaluationContestInputSchema = z
  .object({
    subjectKind: evaluationSubjectSchema,
    subjectId: id,
    reason: z.string().trim().min(10).max(2000),
    confirmed: z.literal(true),
  })
  .strict();
export const evaluationContestDecisionSchema = z
  .object({
    decision: z.enum(["accepted", "rejected"]),
    reason,
  })
  .strict();
export const contestQueueSchema = z.object({
  items: z.array(evaluationContestSchema.extend({ userId: id, name: z.string() })).max(50),
});
export const referrerEvaluationSchema = z.object({
  userId: id,
  name: z.string(),
  organization: z.string(),
  periodFrom: instant,
  periodTo: instant,
  created: count,
  authorized: count,
  duplicates: count,
  invalid: count,
  categoryChanged: count,
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type ProfileDossier = z.infer<typeof profileDossierSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;
export type ProfileReview = z.infer<typeof profileReviewSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;
export type EvaluationContestInput = z.infer<typeof evaluationContestInputSchema>;
export type EvaluationContestDecision = z.infer<typeof evaluationContestDecisionSchema>;
