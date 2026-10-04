import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  communicationPreferencesInputSchema,
  communicationRecordInputSchema,
  communicationsQuerySchema,
  communicationsSchema,
  recordingRequestInputSchema,
  recordingDecisionInputSchema,
  recordingSchema,
  transcriptInputSchema,
  transcriptActionInputSchema,
} from "@coverview/contracts/partner-communications";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
export function registerCommunicationRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (request: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 90, timeWindow: "1 minute" } },
    params = z.object({ id: z.string().min(1).max(100) }).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  for (const wallet of [false, true]) {
    const root = wallet ? "/wallet" : "/partner";
    app.get(
      `${root}/leads/:id/communications`,
      {
        config,
        schema: {
          params,
          querystring: communicationsQuerySchema,
          response: { 200: communicationsSchema },
        },
      },
      async (r) => repository.communications(await actor(r, wallet), r.params.id, r.query),
    );
    app.get(
      `${root}/recordings/:id`,
      {
        config,
        schema: {
          params,
          querystring: z
            .object({ beforeRevision: z.coerce.number().int().positive().optional() })
            .strict(),
          response: { 200: recordingSchema },
        },
      },
      async (r) =>
        repository.recording(await actor(r, wallet), r.params.id, r.query.beforeRevision),
    );
  }
  app.post(
    "/wallet/leads/:id/communications/preferences",
    {
      config,
      schema: {
        params,
        body: communicationPreferencesInputSchema,
        response: { 200: communicationsSchema },
      },
    },
    async (r) =>
      repository.updateCommunicationPreferences(await actor(r, true), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/leads/:id/communications",
    {
      config,
      schema: {
        params,
        body: communicationRecordInputSchema,
        response: { 200: communicationsSchema },
      },
    },
    async (r) => repository.recordCommunication(await actor(r), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/leads/:id/recordings",
    {
      config,
      schema: { params, body: recordingRequestInputSchema, response: { 200: recordingSchema } },
    },
    async (r) => repository.requestRecording(await actor(r), r.params.id, r.body, key(r)),
  );
  app.post(
    "/wallet/recordings/:id/decisions",
    {
      config,
      schema: { params, body: recordingDecisionInputSchema, response: { 200: recordingSchema } },
    },
    async (r) => repository.decideRecording(await actor(r, true), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/recordings/:id/transcripts",
    { config, schema: { params, body: transcriptInputSchema, response: { 200: recordingSchema } } },
    async (r) => repository.saveTranscript(await actor(r), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/recordings/:id/tasks",
    {
      config,
      schema: { params, body: transcriptActionInputSchema, response: { 200: recordingSchema } },
    },
    async (r) => repository.createTranscriptTask(await actor(r), r.params.id, r.body, key(r)),
  );
}
