import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  companyActionRequestInputSchema,
  companyActionsQuerySchema,
  companyActionsSchema,
  serviceRequestSchema,
  serviceRequestsQuerySchema,
  serviceRequestsSchema,
  serviceRequestTransitionInputSchema,
} from "@coverview/contracts";
import type { ProfileActor } from "../identity/index.js";
import type { createCompanyActionRepository } from "./document.company-actions.repository.js";
import type { AdminDocumentIdentity } from "./document.admin.routes.js";

export function registerCompanyActionRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createCompanyActionRepository>,
  identity: AdminDocumentIdentity & {
    authenticate(request: FastifyRequest): Promise<{ id: string; userId: string }>;
  },
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const actors = new WeakMap<FastifyRequest, { id: string; userId: string }>();
  const actor = (request: FastifyRequest) => {
    const value = actors.get(request);
    if (!value) throw new Error("Company action authorization missing");
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
  const limited = { rateLimit: { max: 30, timeWindow: "1 minute" } };
  app.get(
    "/actions",
    {
      onRequest: (request) => authorize(request, false, false),
      config: limited,
      schema: { querystring: companyActionsQuerySchema, response: { 200: companyActionsSchema } },
    },
    async (request) => repository.list(actor(request).userId, request.query),
  );
  app.post(
    "/actions/request",
    {
      onRequest: (request) => authorize(request, false, true),
      config: limited,
      schema: { body: companyActionRequestInputSchema, response: { 200: serviceRequestSchema } },
    },
    async (request) => repository.request(actor(request), request.body, key(request)),
  );
  app.get(
    "/admin/service-requests",
    {
      onRequest: (request) => authorize(request, true, false),
      config: limited,
      schema: { querystring: serviceRequestsQuerySchema, response: { 200: serviceRequestsSchema } },
    },
    async (request) => {
      await identity.auditAdministratorAccess(
        request,
        null,
        "company_service_requests",
        "company_service_requests.list",
      );
      return repository.adminList(request.query);
    },
  );
  app.post(
    "/admin/service-requests/transition",
    {
      onRequest: (request) => authorize(request, true, true),
      config: limited,
      schema: {
        body: serviceRequestTransitionInputSchema,
        response: { 200: serviceRequestSchema },
      },
    },
    async (request) => {
      const administrator = actor(request);
      const commandActor: ProfileActor = {
        id: administrator.id,
        userId: request.body.userId,
        administratorUserId: administrator.userId,
      };
      await identity.auditAdministratorAccess(
        request,
        request.body.userId,
        request.body.id,
        "company_service_requests.transition",
      );
      return repository.transition(commandActor, request.body, key(request));
    },
  );
}
