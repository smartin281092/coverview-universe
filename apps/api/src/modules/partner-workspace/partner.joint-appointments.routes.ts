import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  jointInvitationInputSchema,
  jointParticipationActionSchema,
  jointParticipationsSchema,
  walletJointAppointmentSchema,
} from "@coverview/contracts/partner-joint";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";

// Joint appointment (C6b): the Wallet owner invites, the invited professional decides.
export function registerJointAppointmentRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (r: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 60, timeWindow: "1 minute" } },
    id = z.string().min(1).max(100),
    appointment = z.object({ id, appointmentId: id }).strict(),
    participation = z.object({ id, participationId: id }).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
  app.get(
    "/wallet/leads/:id/appointments/:appointmentId/joint",
    { config, schema: { params: appointment, response: { 200: walletJointAppointmentSchema } } },
    async (r) =>
      repository.walletJointAppointment(await actor(r, true), r.params.id, r.params.appointmentId),
  );
  app.post(
    "/wallet/leads/:id/appointments/:appointmentId/joint/invitations",
    {
      config,
      schema: {
        params: appointment,
        body: jointInvitationInputSchema,
        response: { 200: walletJointAppointmentSchema },
      },
    },
    async (r) =>
      repository.inviteJointParticipant(
        await actor(r, true),
        r.params.id,
        r.params.appointmentId,
        r.body,
        key(r),
      ),
  );
  for (const wallet of [false, true])
    app.get(
      `/${wallet ? "wallet" : "partner"}/leads/:id/participations`,
      {
        config,
        schema: { params: z.object({ id }).strict(), response: { 200: jointParticipationsSchema } },
      },
      async (r) => repository.jointParticipations(await actor(r, wallet), r.params.id),
    );
  app.post(
    "/partner/leads/:id/participations/:participationId",
    {
      config,
      schema: {
        params: participation,
        body: jointParticipationActionSchema,
        response: { 200: jointParticipationsSchema },
      },
    },
    async (r) =>
      repository.decideJointParticipation(
        await actor(r),
        r.params.id,
        r.params.participationId,
        r.body,
        key(r),
      ),
  );
}
