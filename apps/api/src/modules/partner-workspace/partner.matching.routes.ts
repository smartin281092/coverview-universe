import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { leadMatchingSchema } from "@coverview/contracts/partner-matching";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
export function registerMatchingRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    // Each evaluation reads up to 100 professional dossiers: keep the rate deliberately low.
    config = { rateLimit: { max: 20, timeWindow: "1 minute" } },
    params = z.object({ id: z.string().min(1).max(100) }).strict();
  app.get(
    "/partner/leads/:id/matching",
    { config, schema: { params, response: { 200: leadMatchingSchema } } },
    async (r) => repository.leadMatching(await actor(r, false, true), r.params.id),
  );
}
