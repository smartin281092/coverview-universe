import { z } from "zod";

const id = z.string().min(1).max(100),
  count = z.number().int().nonnegative(),
  instant = z.iso.datetime({ offset: true }),
  fingerprint = z.string().regex(/^[a-f0-9]{64}$/u);

// Positive, verifiable explanations shown with a candidate. Never an economic argument.
export const matchingReasonSchema = z.enum([
  "referent",
  "relationship",
  "language",
  "region",
  "mode",
  "competence_category",
  "availability",
  "capacity_open",
  "low_load",
]);
// Points that remain to confirm with the candidate before or at acceptance.
export const matchingCaveatSchema = z.enum([
  "language_unknown",
  "region_unknown",
  "mode_unknown",
  "mode_differs",
  "competence_limited",
  "convention_limited",
  "availability_undeclared",
  "capacity_unknown",
  "conflicts_unchecked",
]);
export const matchingExclusionSchema = z.enum([
  "previous",
  "competence",
  "convention",
  "language",
  "region",
  "absence",
  "capacity",
]);
export const matchingCandidateSchema = z.object({
  rank: z.number().int().min(1).max(100),
  userId: id,
  name: z.string(),
  organization: z.string(),
  competence: z.enum(["category", "limited"]),
  convention: z.enum(["category", "limited"]),
  language: z.enum(["matches", "unknown", "not_requested"]),
  region: z.enum(["matches", "unknown", "not_applicable", "not_requested"]),
  mode: z.enum(["matches", "differs", "unknown", "not_requested"]),
  availability: z.enum(["upcoming", "none_upcoming", "undeclared"]),
  capacity: z.enum(["open", "case_by_case", "unknown"]),
  referent: z.boolean(),
  relationship: z.boolean(),
  activeLeads: count,
  recentAssignments: count,
  reasons: z.array(matchingReasonSchema),
  caveats: z.array(matchingCaveatSchema),
});
export const matchingDecisionSchema = z.object({
  id,
  kind: z.enum(["manual", "automatic"]),
  chosenUserId: id,
  chosenName: z.string(),
  chosenRank: z.number().int().min(1).max(100).nullable(),
  deviation: z.boolean(),
  reason: z.string(),
  createdAt: instant,
});
export const leadMatchingSchema = z.object({
  leadId: id,
  leadRevision: count,
  category: z.string(),
  preferences: z.object({
    status: z.enum(["confirmed", "unset", "confirmation_required", "unlinked"]),
    languageCode: z.string().nullable(),
    mode: z.string().nullable(),
    canton: z.string().nullable(),
  }),
  assessedAt: instant,
  basis: fingerprint,
  evaluated: count,
  truncated: z.boolean(),
  candidates: z.array(matchingCandidateSchema).max(10),
  excluded: z.array(z.object({ reason: matchingExclusionSchema, count })),
  recommendation: z.enum(["candidate", "coverview_queue"]),
  decisions: z.array(matchingDecisionSchema).max(20),
});
export type LeadMatching = z.infer<typeof leadMatchingSchema>;
export type MatchingCandidate = z.infer<typeof matchingCandidateSchema>;
export type MatchingExclusion = z.infer<typeof matchingExclusionSchema>;
