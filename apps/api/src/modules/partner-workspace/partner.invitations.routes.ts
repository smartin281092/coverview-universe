import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  clientInvitationCommandSchema,
  clientInvitationLookupSchema,
  clientInvitationPreviewSchema,
  clientInvitationResponseSchema,
  clientInvitationsSchema,
} from "@coverview/contracts/partner-invitations";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
export function registerInvitationRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 30, timeWindow: "1 minute" } },
    // The token is checked in the body only; a low rate keeps guessing pointless anyway.
    tokenConfig = { rateLimit: { max: 10, timeWindow: "1 minute" } },
    params = z.object({ id: z.string().min(1).max(100) }).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  app.get(
    "/partner/leads/:id/client-invitations",
    { config, schema: { params, response: { 200: clientInvitationsSchema } } },
    async (r) => repository.clientInvitations(await actor(r), r.params.id),
  );
  app.post(
    "/partner/leads/:id/client-invitations",
    {
      config,
      schema: {
        params,
        body: clientInvitationCommandSchema,
        response: { 200: clientInvitationsSchema },
      },
    },
    async (r) => repository.commandClientInvitation(await actor(r), r.params.id, r.body, key(r)),
  );
  app.post(
    "/wallet/client-invitations/preview",
    {
      config: tokenConfig,
      schema: {
        body: clientInvitationLookupSchema,
        response: { 200: clientInvitationPreviewSchema },
      },
    },
    async (r) => repository.previewClientInvitation(await actor(r, true), r.body),
  );
  app.post(
    "/wallet/client-invitations/respond",
    {
      config: tokenConfig,
      schema: {
        body: clientInvitationResponseSchema,
        response: { 200: clientInvitationPreviewSchema },
      },
    },
    async (r) => repository.respondClientInvitation(await actor(r, true), r.body, key(r)),
  );
}
