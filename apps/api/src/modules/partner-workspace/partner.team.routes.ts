import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  receivedInvitationsSchema,
  teamInvitationInputSchema,
  teamRemovalInputSchema,
  teamSchema,
} from "@coverview/contracts/partner-team";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";
// Team of an organisation's manager (C8b): Partner surface only, never Wallet.
export function registerTeamRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 60, timeWindow: "1 minute" } },
    params = z.object({ id: z.string().min(1).max(100) }).strict(),
    empty = z.object({}).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  app.get("/partner/team", { config, schema: { response: { 200: teamSchema } } }, async (r) =>
    repository.team(await actor(r)),
  );
  app.post(
    "/partner/team/invitations",
    { config, schema: { body: teamInvitationInputSchema, response: { 200: teamSchema } } },
    async (r) => repository.inviteTeamMember(await actor(r), r.body, key(r)),
  );
  app.post(
    "/partner/team/invitations/:id/cancel",
    { config, schema: { params, body: empty, response: { 200: teamSchema } } },
    async (r) => repository.cancelTeamInvitation(await actor(r), r.params.id, key(r)),
  );
  app.post(
    "/partner/team/members/:id/removal",
    {
      config,
      schema: { params, body: teamRemovalInputSchema, response: { 200: teamSchema } },
    },
    async (r) => repository.removeTeamMember(await actor(r), r.params.id, r.body, key(r)),
  );
  // What the signed-in person was invited to, by their verified address.
  app.get(
    "/partner/team/invitations/received",
    { config, schema: { response: { 200: receivedInvitationsSchema } } },
    async (r) => repository.receivedTeamInvitations(await actor(r)),
  );
  app.post(
    "/partner/team/invitations/:id/decline",
    { config, schema: { params, body: empty, response: { 200: receivedInvitationsSchema } } },
    async (r) => repository.declineTeamInvitation(await actor(r), r.params.id, key(r)),
  );
}
