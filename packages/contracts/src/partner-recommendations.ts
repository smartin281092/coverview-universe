import { z } from "zod";
import { leadOrientationKindSchema, leadOrientationSchema } from "./partner-orientation.js";

const id = z.string().min(1).max(100);
const instant = z.iso.datetime({ offset: true });

// Final recommendation validated by the advisor (brief I.13): distinct from the automatic
// orientation, immutable per version, published to Wallet with its author and date.
export const recommendationKindSchema = z.enum(["offer", "keep_current", "none"]);
export const recommendationInputSchema = z
  .object({
    kind: recommendationKindSchema,
    offerId: id.nullable(),
    rationale: z.string().trim().min(20).max(3000),
    attention: z.string().trim().max(2000),
    // Required when the choice departs from the orientation's single suggestion, or when the
    // orientation is still insufficient and something is recommended anyway.
    deviationReason: z.string().trim().min(20).max(2000).nullable(),
    // The comparison basis the advisor read; a changed basis refuses the recommendation.
    basis: z.string().regex(/^[a-f0-9]{64}$/u),
  })
  .strict()
  .refine((value) => (value.kind === "offer") === (value.offerId !== null), {
    path: ["offerId"],
  });
export const recommendationSchema = z.object({
  id,
  version: z.number().int().positive(),
  kind: recommendationKindSchema,
  offerId: id.nullable(),
  offerVersion: z.number().int().positive().nullable(),
  company: z.string().nullable(),
  product: z.string().nullable(),
  rationale: z.string(),
  attention: z.string(),
  // Visible to professionals only: the reason recorded for departing from the orientation.
  deviation: z.boolean(),
  deviationReason: z.string().nullable(),
  orientationKind: leadOrientationKindSchema,
  // "to_review" once the compared offers or the current contract review changed.
  status: z.enum(["current", "to_review"]),
  author: z.string(),
  createdAt: instant,
});
export const recommendationsSchema = z.object({
  basis: z.string().regex(/^[a-f0-9]{64}$/u),
  // Orientation over the published versions, the ones a recommendation can name.
  orientation: leadOrientationSchema,
  canRecommend: z.boolean(),
  // Each possible choice and whether it departs from the orientation (reason then required).
  choices: z
    .array(
      z.object({ kind: recommendationKindSchema, offerId: id.nullable(), deviation: z.boolean() }),
    )
    .max(22),
  current: recommendationSchema.nullable(),
  history: z.array(recommendationSchema).max(50),
});
export type RecommendationInput = z.infer<typeof recommendationInputSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
