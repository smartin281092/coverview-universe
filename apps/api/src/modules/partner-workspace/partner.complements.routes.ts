import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  complementAnswerInputSchema,
  complementCandidatesSchema,
  complementCloseInputSchema,
  complementRequestInputSchema,
  partnerComplementsSchema,
  walletComplementsSchema,
} from "@coverview/contracts/partner-complements";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";

// Complement asked of the client when the comparative analysis cannot conclude (C8e).
export function registerComplementRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (request: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 90, timeWindow: "1 minute" } },
    writes = { rateLimit: { max: 20, timeWindow: "1 minute" } };
  const params = z.object({ id: z.string().min(1).max(100) }).strict(),
    request = z
      .object({ id: z.string().min(1).max(100), requestId: z.string().min(1).max(100) })
      .strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  app.get(
    "/partner/leads/:id/complements",
    { config, schema: { params, response: { 200: partnerComplementsSchema } } },
    async (r) => repository.partnerComplements(await actor(r), r.params.id),
  );
  app.post(
    "/partner/leads/:id/complements",
    {
      config: writes,
      schema: {
        params,
        body: complementRequestInputSchema,
        response: { 200: partnerComplementsSchema },
      },
    },
    async (r) => repository.requestComplement(await actor(r), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/leads/:id/complements/:requestId/close",
    {
      config: writes,
      schema: {
        params: request,
        body: complementCloseInputSchema,
        response: { 200: partnerComplementsSchema },
      },
    },
    async (r) =>
      repository.closeComplement(await actor(r), r.params.id, r.params.requestId, r.body, key(r)),
  );
  app.get(
    "/wallet/leads/:id/complements",
    { config, schema: { params, response: { 200: walletComplementsSchema } } },
    async (r) => repository.walletComplements(await actor(r, true), r.params.id),
  );
  app.get(
    "/wallet/leads/:id/complement-candidates",
    {
      config,
      schema: {
        params,
        querystring: z.object({ cursor: z.string().max(400).optional() }).strict(),
        response: { 200: complementCandidatesSchema },
      },
    },
    async (r) => repository.complementCandidates(await actor(r, true), r.params.id, r.query.cursor),
  );
  app.post(
    "/wallet/leads/:id/complements/:requestId/answer",
    {
      config: writes,
      schema: {
        params: request,
        body: complementAnswerInputSchema,
        response: { 200: walletComplementsSchema },
      },
    },
    async (r) =>
      repository.answerComplement(
        await actor(r, true),
        r.params.id,
        r.params.requestId,
        r.body,
        key(r),
      ),
  );
}
