import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  actionCenterIdSchema,
  actionCenterQuerySchema,
  actionCenterListSchema,
  actionCenterSummarySchema,
  actionCenterDetailsSchema,
  actionCenterHistorySchema,
  actionCenterResolveInputSchema,
  actionCenterResolveResultSchema,
  actionCenterManualReviewsSchema,
  actionCenterManualTransitionInputSchema,
  actionCenterManualReviewSchema,
  profileScopeQuerySchema,
  adminUserIdSchema,
  managedProfileIdSchema,
} from "@coverview/contracts";
import type { createActionCenterRepository } from "./document.action-center.repository.js";
import type { AdminDocumentIdentity } from "./document.admin.routes.js";

export function registerActionCenterRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createActionCenterRepository>,
  identity: AdminDocumentIdentity & {
    authenticate(request: FastifyRequest): Promise<{ id: string; userId: string }>;
  },
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const actors = new WeakMap<FastifyRequest, { id: string; userId: string }>();
  const actor = (request: FastifyRequest) => {
    const value = actors.get(request);
    if (!value) throw new Error("Action center authorization missing");
    return value;
  };
  const authorize = async (request: FastifyRequest, admin: boolean, mutation: boolean) => {
    identity.checkHost(request);
    if (mutation) await identity.checkMutation(request);
    actors.set(
      request,
      admin
        ? await identity.authenticateAdministrator(request)
        : await identity.authenticate(request),
    );
  };
  const key = (request: FastifyRequest) => String(request.headers["idempotency-key"]);
  const params = z.object({ id: actionCenterIdSchema }).strict();
  const limited = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  app.get(
    "/action-center",
    {
      onRequest: (request) => authorize(request, false, false),
      config: limited,
      schema: { querystring: actionCenterQuerySchema, response: { 200: actionCenterListSchema } },
    },
    async (request) => repository.list(actor(request).userId, request.query),
  );
  app.get(
    "/action-center/summary",
    {
      onRequest: (request) => authorize(request, false, false),
      config: limited,
      schema: {
        querystring: profileScopeQuerySchema,
        response: { 200: actionCenterSummarySchema },
      },
    },
    async (request) => repository.summary(actor(request).userId, request.query.profileId),
  );
  app.get(
    "/action-center/history",
    {
      onRequest: (request) => authorize(request, false, false),
      config: limited,
      schema: {
        querystring: actionCenterQuerySchema,
        response: { 200: actionCenterHistorySchema },
      },
    },
    async (request) => repository.history(actor(request).userId, request.query),
  );
  app.get(
    "/action-center/:id",
    {
      onRequest: (request) => authorize(request, false, false),
      config: limited,
      schema: {
        params,
        querystring: profileScopeQuerySchema,
        response: { 200: actionCenterDetailsSchema },
      },
    },
    async (request) =>
      repository.details(actor(request).userId, request.params.id, request.query.profileId),
  );
  app.post(
    "/action-center/:id/resolve",
    {
      onRequest: (request) => authorize(request, false, true),
      config: limited,
      schema: {
        params,
        body: actionCenterResolveInputSchema,
        response: { 200: actionCenterResolveResultSchema },
      },
    },
    async (request) =>
      repository.resolve(actor(request), request.params.id, request.body, key(request)),
  );
  const clientParams = z
    .object({ userId: adminUserIdSchema, profileId: managedProfileIdSchema })
    .strict();
  const clientBase = "/admin/users/:userId/profiles/:profileId/action-center";
  const readClient = async (request: FastifyRequest) => {
    await authorize(request, true, false);
    const target = clientParams
      .extend({ id: actionCenterIdSchema.optional() })
      .parse(request.params);
    await identity.auditAdministratorAccess(
      request,
      target.userId,
      target.profileId,
      "client_actions.read",
    );
  };
  app.get(
    clientBase,
    {
      onRequest: readClient,
      config: limited,
      schema: {
        params: clientParams,
        querystring: actionCenterQuerySchema.omit({ profileId: true }),
        response: { 200: actionCenterListSchema },
      },
    },
    async (request) =>
      repository.list(request.params.userId, {
        ...request.query,
        profileId: request.params.profileId,
      }),
  );
  app.get(
    `${clientBase}/history`,
    {
      onRequest: readClient,
      config: limited,
      schema: {
        params: clientParams,
        querystring: actionCenterQuerySchema.omit({ profileId: true }),
        response: { 200: actionCenterHistorySchema },
      },
    },
    async (request) =>
      repository.history(request.params.userId, {
        ...request.query,
        profileId: request.params.profileId,
      }),
  );
  app.get(
    `${clientBase}/:id`,
    {
      onRequest: readClient,
      config: limited,
      schema: {
        params: clientParams.extend({ id: actionCenterIdSchema }),
        response: { 200: actionCenterDetailsSchema },
      },
    },
    async (request) =>
      repository.details(request.params.userId, request.params.id, request.params.profileId),
  );
  app.get(
    "/admin/action-reviews",
    {
      onRequest: (request) => authorize(request, true, false),
      config: limited,
      schema: {
        querystring: z.object({ cursor: z.string().max(500).optional() }).strict(),
        response: { 200: actionCenterManualReviewsSchema },
      },
    },
    async (request) => {
      await identity.auditAdministratorAccess(
        request,
        null,
        "action_center_manual_reviews",
        "action_center_manual_reviews.list",
      );
      return repository.manualReviews(request.query.cursor);
    },
  );
  app.post(
    "/admin/action-reviews/transition",
    {
      onRequest: (request) => authorize(request, true, true),
      config: limited,
      schema: {
        body: actionCenterManualTransitionInputSchema,
        response: { 200: actionCenterManualReviewSchema },
      },
    },
    async (request) => {
      const administrator = actor(request);
      await identity.auditAdministratorAccess(
        request,
        request.body.userId,
        request.body.id,
        "action_center_manual_reviews.transition",
      );
      return repository.transitionManual(
        {
          id: administrator.id,
          administratorUserId: administrator.userId,
          userId: request.body.userId,
        },
        request.body,
        key(request),
      );
    },
  );
}
