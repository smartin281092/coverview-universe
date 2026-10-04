import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  adminUserIdSchema,
  managedProfileIdSchema,
  clientActivityIdSchema,
  clientActivitiesQuerySchema,
  clientActivitiesSchema,
  clientActivitySchema,
  clientActivityCreateInputSchema,
  clientActivityUpdateInputSchema,
} from "@coverview/contracts";
import type { createClientActivityRepository } from "./client-activities.repository.js";

export function registerClientActivityRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createClientActivityRepository>,
  identity: {
    authenticateAdministrator(request: FastifyRequest): Promise<{ id: string; userId: string }>;
    auditAdministratorAccess(
      request: FastifyRequest,
      userId: string | null,
      resource: string,
      action: string,
    ): Promise<void>;
    checkHost(request: FastifyRequest): void;
    checkMutation(request: FastifyRequest): Promise<void>;
  },
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const actors = new WeakMap<FastifyRequest, { id: string; userId: string }>();
  const read = async (request: FastifyRequest) => {
    identity.checkHost(request);
    actors.set(request, await identity.authenticateAdministrator(request));
  };
  const write = async (request: FastifyRequest) => {
    await identity.checkMutation(request);
    actors.set(request, await identity.authenticateAdministrator(request));
  };
  const actor = (request: FastifyRequest, userId: string) => {
    const session = actors.get(request);
    if (!session) throw new Error("Activity authentication hook missing");
    return { id: session.id, userId, administratorUserId: session.userId };
  };
  const params = z
    .object({ userId: adminUserIdSchema, profileId: managedProfileIdSchema })
    .strict();
  const itemParams = params.extend({ id: clientActivityIdSchema }).strict();
  const config = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  const base = "/admin/users/:userId/profiles/:profileId/activities";
  app.get(
    base,
    {
      onRequest: read,
      config,
      schema: {
        params,
        querystring: clientActivitiesQuerySchema,
        response: { 200: clientActivitiesSchema },
      },
    },
    async (request) => {
      await identity.auditAdministratorAccess(
        request,
        request.params.userId,
        `activities:${request.params.profileId}`,
        "list",
      );
      return repository.list(
        actor(request, request.params.userId),
        request.params.profileId,
        request.query,
      );
    },
  );
  app.get(
    `${base}/:id`,
    {
      onRequest: read,
      config,
      schema: { params: itemParams, response: { 200: clientActivitySchema } },
    },
    async (request) => {
      await identity.auditAdministratorAccess(
        request,
        request.params.userId,
        `activity:${request.params.id}`,
        "read",
      );
      return repository.get(
        actor(request, request.params.userId),
        request.params.profileId,
        request.params.id,
      );
    },
  );
  app.post(
    base,
    {
      onRequest: write,
      config,
      schema: {
        params,
        body: clientActivityCreateInputSchema,
        response: { 200: clientActivitySchema },
      },
    },
    async (request) =>
      repository.create(
        actor(request, request.params.userId),
        request.params.profileId,
        request.body,
        String(request.headers["idempotency-key"]),
      ),
  );
  app.post(
    `${base}/:id`,
    {
      onRequest: write,
      config,
      schema: {
        params: itemParams,
        body: clientActivityUpdateInputSchema,
        response: { 200: clientActivitySchema },
      },
    },
    async (request) =>
      repository.update(
        actor(request, request.params.userId),
        request.params.profileId,
        request.params.id,
        request.body,
        String(request.headers["idempotency-key"]),
      ),
  );
}
