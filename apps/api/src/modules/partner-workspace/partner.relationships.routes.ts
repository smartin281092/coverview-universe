import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  leadRelationshipsSchema,
  leadRelationshipCandidatesSchema,
  leadRelationshipInputSchema,
} from "@coverview/contracts/partner-relationships";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
export function registerRelationshipRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest, wallet?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 60, timeWindow: "1 minute" } },
    params = z.object({ id: z.string().min(1).max(100) }).strict(),
    querystring = z.object({ cursor: z.string().max(400).optional() }).strict();
  for (const wallet of [false, true])
    app.get(
      `/${wallet ? "wallet" : "partner"}/leads/:id/relationships`,
      { config, schema: { params, querystring, response: { 200: leadRelationshipsSchema } } },
      async (r) =>
        repository.leadRelationships(await actor(r, wallet), r.params.id, r.query.cursor),
    );
  app.get(
    "/partner/leads/:id/relationship-candidates",
    {
      config,
      schema: { params, querystring, response: { 200: leadRelationshipCandidatesSchema } },
    },
    async (r) => repository.leadRelationshipCandidates(await actor(r), r.params.id, r.query.cursor),
  );
  app.post(
    "/partner/leads/:id/relationships",
    {
      config,
      schema: {
        params,
        body: leadRelationshipInputSchema,
        response: { 200: leadRelationshipsSchema },
      },
    },
    async (r) =>
      repository.changeLeadRelationship(
        await actor(r),
        r.params.id,
        r.body,
        String(r.headers["idempotency-key"]),
      ),
  );
}
