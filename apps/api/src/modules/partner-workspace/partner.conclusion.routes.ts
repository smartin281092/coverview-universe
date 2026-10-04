import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  conclusionActionSchema,
  conclusionPrepareSchema,
  conclusionSchema,
  conclusionsSchema,
  conclusionSignSchema,
  conclusionCorrespondenceInputSchema,
  conclusionCorrespondencesSchema,
  conclusionCandidatesSchema,
} from "@coverview/contracts/partner-conclusion";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
import { leadReopeningsSchema } from "@coverview/contracts/partner-lifecycle";
export function registerConclusionRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest, wallet?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const config = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  const params = z.object({ id: z.string().min(1).max(100) }).strict();
  const key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  for (const wallet of [false, true]) {
    const root = wallet ? "/wallet" : "/partner";
    app.get(
      `${root}/leads/:id/reopenings`,
      {
        config,
        schema: {
          params,
          querystring: z.object({ cursor: z.string().max(400).optional() }).strict(),
          response: { 200: leadReopeningsSchema },
        },
      },
      async (r) => repository.leadReopenings(await actor(r, wallet), r.params.id, r.query.cursor),
    );
    app.get(
      `${root}/leads/:id/conclusion-correspondences`,
      {
        config,
        schema: {
          params,
          querystring: z.object({ cursor: z.string().max(400).optional() }).strict(),
          response: { 200: conclusionCorrespondencesSchema },
        },
      },
      async (r) =>
        repository.conclusionCorrespondences(await actor(r, wallet), r.params.id, r.query.cursor),
    );
    app.get(
      `${root}/leads/:id/conclusions`,
      {
        config,
        schema: {
          params,
          querystring: z.object({ cursor: z.string().max(400).optional() }).strict(),
          response: { 200: conclusionsSchema },
        },
      },
      async (r) => repository.conclusions(await actor(r, wallet), r.params.id, r.query.cursor),
    );
    app.get(
      `${root}/conclusions/:id`,
      { config, schema: { params, response: { 200: conclusionSchema } } },
      async (r) => repository.conclusion(await actor(r, wallet), r.params.id),
    );
  }
  app.get(
    "/wallet/leads/:id/conclusion-candidates",
    {
      config,
      schema: {
        params,
        querystring: z.object({ cursor: z.string().max(400).optional() }).strict(),
        response: { 200: conclusionCandidatesSchema },
      },
    },
    async (r) => repository.conclusionCandidates(await actor(r, true), r.params.id, r.query.cursor),
  );
  app.post(
    "/wallet/leads/:id/conclusion-correspondences",
    {
      config,
      schema: {
        params,
        body: conclusionCorrespondenceInputSchema,
        response: { 200: conclusionCorrespondencesSchema },
      },
    },
    async (r) =>
      repository.shareConclusionCorrespondence(await actor(r, true), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/leads/:id/conclusions",
    {
      config,
      schema: { params, body: conclusionPrepareSchema, response: { 200: conclusionSchema } },
    },
    async (r) => repository.prepareConclusion(await actor(r), r.params.id, r.body, key(r)),
  );
  app.post(
    "/wallet/conclusions/:id/signatures",
    { config, schema: { params, body: conclusionSignSchema, response: { 200: conclusionSchema } } },
    async (r) => repository.signConclusion(await actor(r, true), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/conclusions/:id/actions",
    {
      config,
      schema: { params, body: conclusionActionSchema, response: { 200: conclusionSchema } },
    },
    async (r) => repository.actConclusion(await actor(r), r.params.id, r.body, key(r)),
  );
}
