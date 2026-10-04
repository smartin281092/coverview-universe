import {
  contestQueueSchema,
  evaluationContestDecisionSchema,
  evaluationContestInputSchema,
  evaluationSchema,
  profileDossierSchema,
  profileInputSchema,
  profileQueueSchema,
  profileReviewSchema,
  publicProfileSchema,
  referrerEvaluationSchema,
  type EvaluationContestDecision,
  type EvaluationContestInput,
  type ProfileInput,
  type ProfileReview,
} from "@coverview/contracts/partner-profiles";
import type { PartnerMutation, PartnerRequest } from "./partner-transport.js";
export function createProfileClient(request: PartnerRequest) {
  const id = encodeURIComponent;
  return {
    profileDossier: (userId: string, signal?: AbortSignal) =>
      request(`/partner/profiles/${id(userId)}`, profileDossierSchema, signal),
    submitProfile: (userId: string, input: ProfileInput, options: PartnerMutation) =>
      request(
        `/partner/profiles/${id(userId)}`,
        profileDossierSchema,
        options.signal,
        profileInputSchema.parse(input),
        options,
      ),
    withdrawProfile: (userId: string, reason: string, options: PartnerMutation) =>
      request(
        `/partner/profiles/${id(userId)}/withdraw`,
        profileDossierSchema,
        options.signal,
        { reason },
        options,
      ),
    publicProfile: (userId: string, wallet = false, signal?: AbortSignal) =>
      request(
        `/${wallet ? "wallet" : "partner"}/advisors/${id(userId)}/profile`,
        publicProfileSchema,
        signal,
      ),
    evaluation: (userId: string, signal?: AbortSignal) =>
      request(`/partner/evaluations/${id(userId)}`, evaluationSchema, signal),
    contestEvaluation: (userId: string, input: EvaluationContestInput, options: PartnerMutation) =>
      request(
        `/partner/evaluations/${id(userId)}/contests`,
        evaluationSchema,
        options.signal,
        evaluationContestInputSchema.parse(input),
        options,
      ),
    profileQueue: (signal?: AbortSignal) =>
      request("/admin/partner/profiles", profileQueueSchema, signal),
    reviewProfile: (userId: string, input: ProfileReview, options: PartnerMutation) =>
      request(
        `/admin/partner/profiles/${id(userId)}/review`,
        profileDossierSchema,
        options.signal,
        profileReviewSchema.parse(input),
        options,
      ),
    contestQueue: (signal?: AbortSignal) =>
      request("/admin/partner/evaluation-contests", contestQueueSchema, signal),
    decideContest: (
      contestId: string,
      input: EvaluationContestDecision,
      options: PartnerMutation,
    ) =>
      request(
        `/admin/partner/evaluation-contests/${id(contestId)}/decision`,
        evaluationSchema,
        options.signal,
        evaluationContestDecisionSchema.parse(input),
        options,
      ),
    referrerEvaluation: (userId: string, signal?: AbortSignal) =>
      request(
        `/admin/partner/referrers/${id(userId)}/evaluation`,
        referrerEvaluationSchema,
        signal,
      ),
  };
}
