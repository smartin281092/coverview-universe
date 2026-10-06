import { z } from "zod";
import { leadCategorySchema } from "./partner.js";
import { leadAppointmentModeSchema } from "./partner-advice.js";
import { surveyImprovementSchema, surveyPositiveSchema } from "./partner-quality.js";

const id = z.string().min(1).max(100),
  count = z.number().int().nonnegative(),
  instant = z.iso.datetime({ offset: true }),
  reason = z.string().trim().min(5).max(2000);

// Profile photo and organisation logo (C8c): small images, re-encoded by the browser so that no
// camera metadata leaves the device, then scanned before any publication.
export const profileImageMimeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);
export const profileImageMaxBytes = 5 * 1024 * 1024;
export const profileImageFileSchema = z
  .object({
    name: z.string().trim().min(1).max(240),
    mime: profileImageMimeSchema,
    size: z.number().int().min(1).max(profileImageMaxBytes),
    checksum: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
// Keep the picture of the previous version, remove it, or send a new file.
export const profileImageChoiceSchema = z.union([
  z.enum(["keep", "remove"]),
  profileImageFileSchema,
]);
export const profileImageSchema = z.object({
  state: z.enum(["awaiting_upload", "processing", "ready", "failed", "rejected"]),
  mime: profileImageMimeSchema.nullable(),
  documentRevision: count,
  canUpload: z.boolean(),
  canRetry: z.boolean(),
});
// What an audience learns of a published picture: its type, to display the bytes it fetches.
export const publishedImageSchema = z.object({ mime: profileImageMimeSchema });
export const publicOrganizationSchema = z.object({
  organizationId: id,
  name: z.string(),
  presentation: z.string(),
  logo: publishedImageSchema.nullable(),
  publishedAt: instant,
});

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
  photo: publishedImageSchema.nullable().default(null),
  // The published profile of the person's current organisation, if any (C8c).
  organizationProfile: publicOrganizationSchema.nullable().default(null),
});
export const profileVersionSchema = z.object({
  revision: z.number().int().positive(),
  presentation: z.string(),
  status: z.enum(["submitted", "published", "rejected", "withdrawn"]),
  submittedAt: instant,
  decidedAt: instant.nullable(),
  decisionReason: z.string().nullable(),
  photo: profileImageSchema.nullable().default(null),
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
    photo: profileImageChoiceSchema.default("keep"),
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

// Organisation profile (C8c, brief I.18): written by a manager of the organisation, published
// after a CoverView review by someone outside it, shown with the profiles of its members.
export const organizationProfileVersionSchema = z.object({
  revision: z.number().int().positive(),
  presentation: z.string(),
  logo: profileImageSchema.nullable(),
  status: z.enum(["submitted", "published", "rejected", "withdrawn"]),
  submittedAt: instant,
  decidedAt: instant.nullable(),
  decisionReason: z.string().nullable(),
});
export const organizationProfileDossierSchema = z.object({
  organizationId: id,
  name: z.string(),
  canEdit: z.boolean(),
  canReview: z.boolean(),
  current: organizationProfileVersionSchema.nullable(),
  published: publicOrganizationSchema.nullable(),
  history: z.array(organizationProfileVersionSchema).max(20),
});
export const organizationProfileInputSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    presentation: z.string().trim().min(40).max(1200),
    logo: profileImageChoiceSchema.default("keep"),
    confirmed: z.literal(true),
  })
  .strict();
export const organizationProfileQueueSchema = z.object({
  items: z
    .array(
      z.object({
        organizationId: id,
        name: z.string(),
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
export type ProfileInput = z.input<typeof profileInputSchema>;
export type ProfileReview = z.infer<typeof profileReviewSchema>;
export type ProfileImage = z.infer<typeof profileImageSchema>;
export type ProfileImageChoice = z.infer<typeof profileImageChoiceSchema>;
export type PublicOrganization = z.infer<typeof publicOrganizationSchema>;
export type OrganizationProfileDossier = z.infer<typeof organizationProfileDossierSchema>;
export type OrganizationProfileInput = z.input<typeof organizationProfileInputSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;
export type EvaluationContestInput = z.infer<typeof evaluationContestInputSchema>;
export type EvaluationContestDecision = z.infer<typeof evaluationContestDecisionSchema>;
