import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  adminUserIdSchema,
  adminUserSchema,
  adminUsersQuerySchema,
  adminUsersSchema,
  profileSchema,
  profileSaveInputSchema,
} from "@coverview/contracts";
import type { createAdminUserRepository } from "./identity.admin.repository.js";
import type { createProfileRepository, ProfileActor } from "./identity.profile.repository.js";

export function registerAdminUserRoutes(
  server: FastifyInstance,
  repositories: {
    users(): ReturnType<typeof createAdminUserRepository>;
    profiles(): ReturnType<typeof createProfileRepository>;
  },
  identity: {
    authenticateAdministrator(request: FastifyRequest): Promise<{ id: string; userId: string }>;
    checkHost(request: FastifyRequest): void;
    checkMutation(request: FastifyRequest): Promise<void>;
    auditAdministratorAccess(
      request: FastifyRequest,
      targetUserId: string | null,
      resource: string,
      action: string,
    ): Promise<void>;
  },
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const sessions = new WeakMap<FastifyRequest, { id: string; userId: string }>();
  const read = async (request: FastifyRequest) => {
    identity.checkHost(request);
    sessions.set(request, await identity.authenticateAdministrator(request));
  };
  const write = async (request: FastifyRequest) => {
    await identity.checkMutation(request);
    sessions.set(request, await identity.authenticateAdministrator(request));
  };
  const actor = (request: FastifyRequest, userId: string): ProfileActor => {
    const session = sessions.get(request);
    if (!session) throw new Error("Administrator authentication hook missing");
    return { userId, id: session.id, administratorUserId: session.userId };
  };
  const params = z.object({ userId: adminUserIdSchema }).strict();
  const limited = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  app.get(
    "/admin/users",
    {
      onRequest: read,
      config: limited,
      schema: { querystring: adminUsersQuerySchema, response: { 200: adminUsersSchema } },
    },
    async (request) => {
      await identity.auditAdministratorAccess(request, null, "users", "list");
      return repositories.users().list(request.query);
    },
  );
  app.get(
    "/admin/users/:userId",
    {
      onRequest: read,
      config: limited,
      schema: { params, response: { 200: adminUserSchema } },
    },
    async (request) => {
      await identity.auditAdministratorAccess(request, request.params.userId, "user", "read");
      return repositories.users().get(request.params.userId);
    },
  );
  app.get(
    "/admin/users/:userId/profile",
    {
      onRequest: read,
      config: limited,
      schema: { params, response: { 200: profileSchema } },
    },
    async (request) => {
      await identity.auditAdministratorAccess(
        request,
        request.params.userId,
        "profile:self",
        "read",
      );
      return repositories.profiles().get(request.params.userId);
    },
  );
  app.post(
    "/admin/users/:userId/profile",
    {
      onRequest: write,
      config: limited,
      schema: { params, body: profileSaveInputSchema, response: { 200: profileSchema } },
    },
    async (request) => {
      const current = actor(request, request.params.userId);
      await identity.auditAdministratorAccess(request, current.userId, "profile:self", "save");
      return repositories
        .profiles()
        .save(
          current.userId,
          current.id,
          request.body,
          String(request.headers["idempotency-key"]),
          current.administratorUserId,
        );
    },
  );
}
