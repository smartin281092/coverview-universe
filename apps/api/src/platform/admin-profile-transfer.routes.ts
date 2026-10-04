import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  adminUserIdSchema,
  managedProfileIdSchema,
  adminProfileDirectoryQuerySchema,
  adminProfileDirectorySchema,
  adminProfileTransferInputSchema,
  adminProfileTransferResultSchema,
} from "@coverview/contracts";
import type { registerAdminUserRoutes } from "../modules/identity/identity.admin.routes.js";
import type { Environment } from "./config.js";
import { createDatabase } from "./db/database.js";
import { createAdminProfileTransferRepository } from "./admin-profile-transfer.repository.js";

export function registerAdminProfileTransfers(
  app: FastifyInstance,
  config: Environment,
  identity: Parameters<typeof registerAdminUserRoutes>[2],
) {
  if (!config.AUTH_ENABLED) return;
  const database = createDatabase(config);
  database.pool.on("error", () =>
    app.log.warn(
      { dependency: "profile_transfer_database" },
      "Profile transfer database unavailable",
    ),
  );
  app.addHook("onClose", () => database.pool.end());
  const repository = createAdminProfileTransferRepository(database.db);
  const server = app.withTypeProvider<ZodTypeProvider>();
  const rateLimit = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  server.get(
    "/admin/profiles",
    {
      config: rateLimit,
      onRequest: async (request) => {
        identity.checkHost(request);
        await identity.authenticateAdministrator(request);
      },
      schema: {
        querystring: adminProfileDirectoryQuerySchema,
        response: { 200: adminProfileDirectorySchema },
      },
    },
    async (request) => {
      await identity.auditAdministratorAccess(request, null, "profile_directory", "list");
      return repository.directory(request.query);
    },
  );
  server.post(
    "/admin/users/:userId/profiles/:profileId/transfer",
    {
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      onRequest: async (request) => {
        await identity.checkMutation(request);
        await identity.authenticateAdministrator(request);
      },
      schema: {
        params: z.object({ userId: adminUserIdSchema, profileId: managedProfileIdSchema }).strict(),
        body: adminProfileTransferInputSchema,
        response: { 200: adminProfileTransferResultSchema },
      },
    },
    async (request) => {
      const administrator = await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(
        request,
        request.params.userId,
        `profile:${request.params.profileId}`,
        "transfer",
      );
      return repository.transfer(
        {
          userId: request.params.userId,
          id: administrator.id,
          administratorUserId: administrator.userId,
        },
        request.params.profileId,
        request.body,
        String(request.headers["idempotency-key"]),
      );
    },
  );
}
