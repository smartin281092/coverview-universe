import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  pilotageQuerySchema,
  pilotageSchema,
  pilotageSourceQuerySchema,
  pilotageSourcesSchema,
  pilotageOptionsSchema,
  goalInputSchema,
  goalSchema,
  goalsQuerySchema,
  goalsSchema,
} from "@coverview/contracts/partner-pilotage";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
export function registerPilotageRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (request: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 45, timeWindow: "1 minute" } },
    params = z.object({ id: z.string().min(1).max(100) }).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  app.get(
    "/partner/pilotage",
    { config, schema: { querystring: pilotageQuerySchema, response: { 200: pilotageSchema } } },
    async (r) => repository.pilotage(await actor(r), r.query),
  );
  app.get(
    "/partner/pilotage/sources",
    {
      config,
      schema: { querystring: pilotageSourceQuerySchema, response: { 200: pilotageSourcesSchema } },
    },
    async (r) => repository.pilotageSources(await actor(r), r.query),
  );
  app.get(
    "/partner/pilotage/options",
    { config, schema: { response: { 200: pilotageOptionsSchema } } },
    async (r) => repository.pilotageOptions(await actor(r)),
  );
  app.get(
    "/partner/goals",
    { config, schema: { querystring: goalsQuerySchema, response: { 200: goalsSchema } } },
    async (r) => repository.goals(await actor(r), r.query),
  );
  app.get(
    "/partner/goals/:id",
    {
      config,
      schema: {
        params,
        querystring: z
          .object({ beforeRevision: z.coerce.number().int().positive().optional() })
          .strict(),
        response: { 200: goalSchema },
      },
    },
    async (r) => repository.goal(await actor(r), r.params.id, r.query.beforeRevision),
  );
  app.post(
    "/partner/goals",
    { config, schema: { body: goalInputSchema, response: { 200: goalSchema } } },
    async (r) => repository.saveGoal(await actor(r), null, r.body, key(r)),
  );
  app.post(
    "/partner/goals/:id",
    { config, schema: { params, body: goalInputSchema, response: { 200: goalSchema } } },
    async (r) => repository.saveGoal(await actor(r), r.params.id, r.body, key(r)),
  );
}
