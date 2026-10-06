import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  contestQueueSchema,
  evaluationContestDecisionSchema,
  evaluationContestInputSchema,
  evaluationSchema,
  organizationProfileDossierSchema,
  organizationProfileInputSchema,
  organizationProfileQueueSchema,
  profileDossierSchema,
  profileInputSchema,
  profileQueueSchema,
  profileReviewSchema,
  publicProfileSchema,
  referrerEvaluationSchema,
} from "@coverview/contracts/partner-profiles";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
export function registerProfileRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 60, timeWindow: "1 minute" } },
    user = z.object({ userId: z.string().min(1).max(100) }).strict(),
    contest = z.object({ id: z.string().min(1).max(100) }).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]),
    withdrawal = z.object({ reason: profileReviewSchema.shape.reason }).strict();
  app.get(
    "/partner/profiles/:userId",
    { config, schema: { params: user, response: { 200: profileDossierSchema } } },
    async (r) => repository.profileDossier(await actor(r), r.params.userId),
  );
  app.post(
    "/partner/profiles/:userId",
    {
      config,
      schema: { params: user, body: profileInputSchema, response: { 200: profileDossierSchema } },
    },
    async (r) => repository.submitProfile(await actor(r), r.params.userId, r.body, key(r)),
  );
  app.post(
    "/partner/profiles/:userId/withdraw",
    {
      config,
      schema: { params: user, body: withdrawal, response: { 200: profileDossierSchema } },
    },
    async (r) => repository.withdrawProfile(await actor(r), r.params.userId, r.body.reason, key(r)),
  );
  for (const wallet of [false, true])
    app.get(
      `/${wallet ? "wallet" : "partner"}/advisors/:userId/profile`,
      { config, schema: { params: user, response: { 200: publicProfileSchema } } },
      async (r) => repository.publicProfile(await actor(r, wallet), r.params.userId),
    );
  app.get(
    "/partner/evaluations/:userId",
    { config, schema: { params: user, response: { 200: evaluationSchema } } },
    async (r) => repository.evaluation(await actor(r), r.params.userId),
  );
  app.post(
    "/partner/evaluations/:userId/contests",
    {
      config,
      schema: {
        params: user,
        body: evaluationContestInputSchema,
        response: { 200: evaluationSchema },
      },
    },
    async (r) => repository.contestEvaluation(await actor(r), r.params.userId, r.body, key(r)),
  );
  app.get(
    "/admin/partner/profiles",
    { config, schema: { response: { 200: profileQueueSchema } } },
    async (r) => repository.profileQueue(await actor(r, false, true)),
  );
  app.post(
    "/admin/partner/profiles/:userId/review",
    {
      config,
      schema: { params: user, body: profileReviewSchema, response: { 200: profileDossierSchema } },
    },
    async (r) =>
      repository.reviewProfile(await actor(r, false, true), r.params.userId, r.body, key(r)),
  );
  app.get(
    "/admin/partner/evaluation-contests",
    { config, schema: { response: { 200: contestQueueSchema } } },
    async (r) => repository.contestQueue(await actor(r, false, true)),
  );
  app.post(
    "/admin/partner/evaluation-contests/:id/decision",
    {
      config,
      schema: {
        params: contest,
        body: evaluationContestDecisionSchema,
        response: { 200: evaluationSchema },
      },
    },
    async (r) => repository.decideContest(await actor(r, false, true), r.params.id, r.body, key(r)),
  );
  app.get(
    "/admin/partner/referrers/:userId/evaluation",
    { config, schema: { params: user, response: { 200: referrerEvaluationSchema } } },
    async (r) => repository.referrerEvaluation(await actor(r, false, true), r.params.userId),
  );
  // Photo analysis retry and the organisation profile (C8c).
  const retry = z.object({ documentRevision: z.number().int().nonnegative() }).strict();
  app.post(
    "/partner/profiles/:userId/photo/retry",
    { config, schema: { params: user, body: retry, response: { 200: profileDossierSchema } } },
    async (r) =>
      repository.retryProfilePhoto(
        await actor(r),
        r.params.userId,
        r.body.documentRevision,
        key(r),
      ),
  );
  const organization = z.object({ organizationId: z.string().min(1).max(100) }).strict();
  app.get(
    "/partner/organizations/:organizationId/profile",
    {
      config,
      schema: { params: organization, response: { 200: organizationProfileDossierSchema } },
    },
    async (r) => repository.organizationProfile(await actor(r), r.params.organizationId),
  );
  app.post(
    "/partner/organizations/:organizationId/profile",
    {
      config,
      schema: {
        params: organization,
        body: organizationProfileInputSchema,
        response: { 200: organizationProfileDossierSchema },
      },
    },
    async (r) =>
      repository.submitOrganizationProfile(await actor(r), r.params.organizationId, r.body, key(r)),
  );
  app.post(
    "/partner/organizations/:organizationId/profile/withdraw",
    {
      config,
      schema: {
        params: organization,
        body: withdrawal,
        response: { 200: organizationProfileDossierSchema },
      },
    },
    async (r) =>
      repository.withdrawOrganizationProfile(
        await actor(r),
        r.params.organizationId,
        r.body.reason,
        key(r),
      ),
  );
  app.post(
    "/partner/organizations/:organizationId/logo/retry",
    {
      config,
      schema: {
        params: organization,
        body: retry,
        response: { 200: organizationProfileDossierSchema },
      },
    },
    async (r) =>
      repository.retryOrganizationLogo(
        await actor(r),
        r.params.organizationId,
        r.body.documentRevision,
        key(r),
      ),
  );
  app.get(
    "/admin/partner/organization-profiles",
    { config, schema: { response: { 200: organizationProfileQueueSchema } } },
    async (r) => repository.organizationProfileQueue(await actor(r, false, true)),
  );
  app.post(
    "/admin/partner/organizations/:organizationId/profile/review",
    {
      config,
      schema: {
        params: organization,
        body: profileReviewSchema,
        response: { 200: organizationProfileDossierSchema },
      },
    },
    async (r) =>
      repository.reviewOrganizationProfile(
        await actor(r, false, true),
        r.params.organizationId,
        r.body,
        key(r),
      ),
  );
}
