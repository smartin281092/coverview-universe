import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  accessDecisionsSchema,
  accessItemSchema,
  accessQuerySchema,
  accessQueueSchema,
  organizationAccessSchema,
  organizationReviewInputSchema,
  restrictionInputSchema,
} from "@coverview/contracts/partner-access";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
// Access decisions (C8a): Admin queue, restrictions, organisation reviews and decision journal.
export function registerAccessRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 60, timeWindow: "1 minute" } },
    params = z.object({ id: z.string().min(1).max(100) }).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  app.get(
    "/admin/partner/access",
    { config, schema: { querystring: accessQuerySchema, response: { 200: accessQueueSchema } } },
    async (r) => repository.accessQueue(await actor(r, false, true), r.query.filter),
  );
  app.get(
    "/admin/partner/applications/:id/decisions",
    { config, schema: { params, response: { 200: accessDecisionsSchema } } },
    async (r) => repository.accessDecisions(await actor(r, false, true), r.params.id),
  );
  app.post(
    "/admin/partner/applications/:id/restrictions",
    {
      config,
      schema: { params, body: restrictionInputSchema, response: { 200: accessItemSchema } },
    },
    async (r) =>
      repository.restrictMember(await actor(r, false, true), r.params.id, r.body, key(r)),
  );
  app.get(
    "/admin/partner/organizations/:id",
    { config, schema: { params, response: { 200: organizationAccessSchema } } },
    async (r) => repository.organizationAccess(await actor(r, false, true), r.params.id),
  );
  app.post(
    "/admin/partner/organizations/:id/review",
    {
      config,
      schema: {
        params,
        body: organizationReviewInputSchema,
        response: { 200: organizationAccessSchema },
      },
    },
    async (r) =>
      repository.reviewOrganization(await actor(r, false, true), r.params.id, r.body, key(r)),
  );
  // The person's own decisions and those of their organisation, whatever their current state.
  app.get(
    "/partner/access/decisions",
    { config, schema: { response: { 200: accessDecisionsSchema } } },
    async (r) => {
      const current = await actor(r);
      return repository.accessDecisions({ ...current, administrator: false }, current.userId);
    },
  );
}
