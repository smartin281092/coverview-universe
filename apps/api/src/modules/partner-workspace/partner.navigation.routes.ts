import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  leadViewInputSchema,
  leadViewSchema,
  leadViewsSchema,
} from "@coverview/contracts/partner-navigation";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
export function registerNavigationRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  app.get(
    "/partner/lead-views",
    { config, schema: { response: { 200: leadViewsSchema } } },
    async (r) => repository.leadViews(await actor(r)),
  );
  app.post(
    "/partner/lead-views",
    { config, schema: { body: leadViewInputSchema, response: { 200: leadViewSchema } } },
    async (r) =>
      repository.saveLeadView(await actor(r), r.body, String(r.headers["idempotency-key"])),
  );
}
