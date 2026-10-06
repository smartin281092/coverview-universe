import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  caseConfirmationSchema,
  clientConfirmationsSchema,
  qualityContactInputSchema,
  walletConfirmationInputSchema,
  qualityActionInputSchema,
  qualityCaseSchema,
  qualityClientReplySchema,
  qualityCreateSchema,
  qualityPageQuerySchema,
  qualityQueueSchema,
  qualitySettingsInputSchema,
  qualitySettingsSchema,
  surveyResponseInputSchema,
  surveySchema,
  surveysSchema,
} from "@coverview/contracts/partner-quality";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
export function registerQualityRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (request: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 90, timeWindow: "1 minute" } };
  const params = z.object({ id: z.string().min(1).max(100) }).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  app.get(
    "/admin/partner/quality/settings",
    { config, schema: { response: { 200: qualitySettingsSchema } } },
    async (r) => repository.qualitySettings(await actor(r, false, true)),
  );
  app.post(
    "/admin/partner/quality/settings",
    {
      config,
      schema: { body: qualitySettingsInputSchema, response: { 200: qualitySettingsSchema } },
    },
    async (r) => repository.updateQualitySettings(await actor(r, false, true), r.body, key(r)),
  );
  app.get(
    "/admin/partner/quality",
    {
      config,
      schema: { querystring: qualityPageQuerySchema, response: { 200: qualityQueueSchema } },
    },
    async (r) => repository.qualityQueue(await actor(r, false, true), r.query),
  );
  for (const wallet of [false, true]) {
    const root = wallet ? "/wallet" : "/partner";
    app.get(
      `${root}/leads/:id/quality`,
      {
        config,
        schema: {
          params,
          querystring: qualityPageQuerySchema,
          response: { 200: qualityQueueSchema },
        },
      },
      async (r) => repository.qualityQueue(await actor(r, wallet), r.query, r.params.id),
    );
    app.post(
      `${root}/leads/:id/quality`,
      {
        config,
        schema: { params, body: qualityCreateSchema, response: { 200: qualityCaseSchema } },
      },
      async (r) =>
        repository.createQualityCase(await actor(r, wallet), r.params.id, r.body, key(r)),
    );
    app.get(
      `${root}/quality/:id`,
      {
        config,
        schema: {
          params,
          querystring: z
            .object({ beforeRevision: z.coerce.number().int().positive().optional() })
            .strict(),
          response: { 200: qualityCaseSchema },
        },
      },
      async (r) =>
        repository.qualityCase(await actor(r, wallet), r.params.id, r.query.beforeRevision),
    );
    app.post(
      `${root}/quality/:id/replies`,
      {
        config,
        schema: { params, body: qualityClientReplySchema, response: { 200: qualityCaseSchema } },
      },
      async (r) => repository.replyQualityCase(await actor(r, wallet), r.params.id, r.body, key(r)),
    );
  }
  app.post(
    "/partner/quality/:id/actions",
    {
      config,
      schema: { params, body: qualityActionInputSchema, response: { 200: qualityCaseSchema } },
    },
    async (r) =>
      repository.actQualityCase(await actor(r, false, true), r.params.id, r.body, key(r)),
  );
  app.get(
    "/wallet/leads/:id/surveys",
    { config, schema: { params, response: { 200: surveysSchema } } },
    async (r) => repository.surveys(await actor(r, true), r.params.id),
  );
  app.get(
    "/wallet/surveys/:id",
    { config, schema: { params, response: { 200: surveySchema } } },
    async (r) => repository.survey(await actor(r, true), r.params.id),
  );
  app.post(
    "/wallet/surveys/:id/responses",
    {
      config,
      schema: { params, body: surveyResponseInputSchema, response: { 200: surveySchema } },
    },
    async (r) => repository.respondSurvey(await actor(r, true), r.params.id, r.body, key(r)),
  );
  // Client statements about a request (C8d, brief I.17.2).
  app.get(
    "/wallet/leads/:id/confirmations",
    { config, schema: { params, response: { 200: clientConfirmationsSchema } } },
    async (r) => repository.walletConfirmations(await actor(r, true), r.params.id),
  );
  app.post(
    "/wallet/leads/:id/confirmations",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        params,
        body: walletConfirmationInputSchema,
        response: { 200: clientConfirmationsSchema },
      },
    },
    async (r) => repository.confirmFromWallet(await actor(r, true), r.params.id, r.body, key(r)),
  );
  app.get(
    "/partner/leads/:id/confirmations",
    {
      config,
      schema: { params, response: { 200: z.object({ items: z.array(caseConfirmationSchema) }) } },
    },
    async (r) => repository.leadConfirmations(await actor(r, false, true), r.params.id),
  );
  app.post(
    "/partner/leads/:id/quality-contacts",
    {
      config,
      schema: {
        params,
        body: qualityContactInputSchema,
        response: { 200: caseConfirmationSchema },
      },
    },
    async (r) =>
      repository.recordQualityContact(await actor(r, false, true), r.params.id, r.body, key(r)),
  );
}
