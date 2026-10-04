import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  authorizationDocumentSchema,
  authorizationIdSchema,
  authorizationKindSchema,
  authorizationReceiptSchema,
  authorizationSignInputSchema,
  authorizationStatusSchema,
  adminNotificationsQuerySchema,
  adminNotificationsSchema,
  managedProfileIdSchema,
} from "@coverview/contracts";
import type { createAuthorizationRepository } from "./authorizations.repository.js";

export function registerAuthorizationRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createAuthorizationRepository>,
  identity: {
    checkHost(request: FastifyRequest): void;
    checkMutation(request: FastifyRequest): Promise<void>;
    authenticate(request: FastifyRequest): Promise<{ userId: string; id: string }>;
    authenticateAdministrator(request: FastifyRequest): Promise<{ userId: string; id: string }>;
    auditAdministratorAccess(
      request: FastifyRequest,
      targetUserId: string | null,
      resource: string,
      action: string,
    ): Promise<void>;
  },
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const actors = new WeakMap<FastifyRequest, { userId: string; id: string }>();
  const authenticate = async (request: FastifyRequest, mutation = false) => {
    identity.checkHost(request);
    if (mutation) await identity.checkMutation(request);
    actors.set(request, await identity.authenticate(request));
  };
  const actor = (request: FastifyRequest) => {
    const result = actors.get(request);
    if (!result) throw new Error("Authorization identity missing");
    return result;
  };
  const target = z.object({ profileId: managedProfileIdSchema.default("self") }).strict();
  const kind = z.object({ kind: authorizationKindSchema });
  const limited = { rateLimit: { max: 30, timeWindow: "1 minute" } };
  app.get(
    "/admin/notifications",
    {
      onRequest: async (request) => {
        identity.checkHost(request);
        await identity.authenticateAdministrator(request);
        await identity.auditAdministratorAccess(request, null, "signature_notifications", "list");
      },
      config: limited,
      schema: {
        querystring: adminNotificationsQuerySchema,
        response: { 200: adminNotificationsSchema },
      },
    },
    (request) => repository.notifications(request.query.cursor),
  );
  app.get(
    "/authorizations/status",
    {
      onRequest: (request) => authenticate(request),
      config: limited,
      schema: { querystring: target, response: { 200: authorizationStatusSchema } },
    },
    (request) => repository.status(actor(request).userId, request.query.profileId),
  );
  app.get(
    "/authorizations/receipts/:id",
    {
      onRequest: (request) => authenticate(request),
      config: limited,
      schema: {
        params: z.object({ id: authorizationIdSchema }),
        response: { 200: authorizationReceiptSchema },
      },
    },
    (request) => repository.receipt(actor(request).userId, request.params.id),
  );
  app.get(
    "/authorizations/:kind",
    {
      onRequest: (request) => authenticate(request),
      config: limited,
      schema: { params: kind, querystring: target, response: { 200: authorizationDocumentSchema } },
    },
    (request) =>
      repository.draft(actor(request).userId, request.params.kind, request.query.profileId),
  );
  app.post(
    "/authorizations/:kind/sign",
    {
      onRequest: (request) => authenticate(request, true),
      config: limited,
      bodyLimit: 150_000,
      schema: {
        params: kind,
        body: authorizationSignInputSchema,
        response: { 200: authorizationReceiptSchema },
      },
    },
    (request) =>
      repository.sign(
        actor(request),
        request.params.kind,
        request.body,
        String(request.headers["idempotency-key"]),
      ),
  );
}
