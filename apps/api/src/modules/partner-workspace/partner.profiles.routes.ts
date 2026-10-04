import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
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
}
