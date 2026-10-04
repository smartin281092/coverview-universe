import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  recommendationInputSchema,
  recommendationsSchema,
} from "@coverview/contracts/partner-recommendations";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
export function registerRecommendationRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 60, timeWindow: "1 minute" } },
    params = z.object({ id: z.string().min(1).max(100) }).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  app.get(
    "/partner/leads/:id/recommendations",
    { config, schema: { params, response: { 200: recommendationsSchema } } },
    async (r) => repository.recommendations(await actor(r), r.params.id),
  );
  app.post(
    "/partner/leads/:id/recommendations",
    {
      config,
      schema: { params, body: recommendationInputSchema, response: { 200: recommendationsSchema } },
    },
    async (r) => repository.recommend(await actor(r), r.params.id, r.body, key(r)),
  );
}
