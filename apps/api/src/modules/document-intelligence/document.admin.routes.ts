import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  adminUserIdSchema,
  documentCreateInputSchema,
  documentIdSchema,
  documentListQuerySchema,
  documentListSchema,
  documentRetryInputSchema,
  documentSchema,
  managedProfileIdSchema,
  adminProfileContractsSchema,
} from "@coverview/contracts";
import { IdentityError, type ProfileActor } from "../identity/index.js";
import type { createDocumentRepository } from "./document.repository.js";
import type { createDocumentService } from "./document.service.js";

export type AdminDocumentIdentity = {
  authenticateAdministrator(request: FastifyRequest): Promise<{ id: string; userId: string }>;
  auditAdministratorAccess(
    request: FastifyRequest,
    targetUserId: string | null,
    resource: string,
    action: string,
  ): Promise<void>;
  checkHost(request: FastifyRequest): void;
  checkMutation(request: FastifyRequest): Promise<void>;
};

export function registerAdminDocumentRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createDocumentRepository>,
  service: ReturnType<typeof createDocumentService>,
  identity: AdminDocumentIdentity,
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const targetParams = z
    .object({
      userId: adminUserIdSchema,
      profileId: managedProfileIdSchema,
    })
    .strict();
  const fileParams = targetParams.extend({ id: documentIdSchema }).strict();
  const actors = new WeakMap<FastifyRequest, ProfileActor>();
  const authorize = async (request: FastifyRequest, mutation: boolean) => {
    identity.checkHost(request);
    if (mutation) await identity.checkMutation(request);
    const administrator = await identity.authenticateAdministrator(request);
    // onRequest precedes schema validation; parse before using any target identifiers.
    const parsed = fileParams.partial({ id: true }).safeParse(request.params);
    if (!parsed.success) throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
    const target = parsed.data;
    actors.set(request, {
      userId: target.userId,
      id: administrator.id,
      administratorUserId: administrator.userId,
    });
    await identity.auditAdministratorAccess(
      request,
      target.userId,
      target.id ?? target.profileId,
      `${request.method} ${request.routeOptions.url ?? "documents"}`,
    );
    await repository.assertTarget(target.userId, target.profileId, target.id);
  };
  const read = (request: FastifyRequest) => authorize(request, false);
  const write = (request: FastifyRequest) => authorize(request, true);
  const actor = (request: FastifyRequest) => {
    const value = actors.get(request);
    if (!value) throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
    return value;
  };
  const key = (request: FastifyRequest) => String(request.headers["idempotency-key"]);
  const limited = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  const uploadLimited = { rateLimit: { max: 10, timeWindow: "1 minute" } };
  const base = "/admin/users/:userId/profiles/:profileId/documents";
  app.get(
    "/admin/users/:userId/profiles/:profileId/contracts",
    {
      onRequest: read,
      config: limited,
      schema: { params: targetParams, response: { 200: adminProfileContractsSchema } },
    },
    async (request) => repository.profileContracts(request.params.userId, request.params.profileId),
  );

  app.get(
    base,
    {
      onRequest: read,
      config: limited,
      schema: {
        params: targetParams,
        querystring: documentListQuerySchema,
        response: { 200: documentListSchema },
      },
    },
    async (request) => {
      const { cursor, ...filters } = request.query;
      return repository.list(actor(request).userId, cursor, {
        ...filters,
        profileId: request.params.profileId,
        // Preserve access to the account's unresolved originals in its self dossier.
        // The selected target still overrides any caller-supplied account scope.
        scope: undefined,
      });
    },
  );
  app.post(
    base,
    {
      onRequest: write,
      config: uploadLimited,
      schema: {
        params: targetParams,
        body: documentCreateInputSchema,
        response: { 200: documentSchema },
      },
    },
    async (request) => {
      if (request.body.profileId && request.body.profileId !== request.params.profileId)
        throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
      return repository.create(
        actor(request),
        { ...request.body, profileId: request.params.profileId },
        key(request),
      );
    },
  );
  app.get(
    `${base}/:id`,
    {
      onRequest: read,
      config: limited,
      schema: { params: fileParams, response: { 200: documentSchema } },
    },
    async (request) => repository.get(actor(request).userId, request.params.id),
  );
  app.post(
    `${base}/:id/content`,
    {
      onRequest: write,
      config: uploadLimited,
      bodyLimit: 20 * 1024 * 1024,
      schema: { params: fileParams, response: { 200: documentSchema } },
    },
    async (request) =>
      service.upload(actor(request), request.params.id, z.instanceof(Buffer).parse(request.body)),
  );
  app.post(
    `${base}/:id/retry`,
    {
      onRequest: write,
      config: limited,
      schema: {
        params: fileParams,
        body: documentRetryInputSchema,
        response: { 200: documentSchema },
      },
    },
    async (request) =>
      repository.retry(
        actor(request),
        request.params.id,
        request.body.revision,
        request.body.analysisRequested,
        key(request),
      ),
  );
  app.get(
    `${base}/:id/download`,
    {
      onRequest: read,
      config: limited,
      schema: { params: fileParams },
    },
    async (request, reply) => {
      const result = await service.download(actor(request), request.params.id);
      return reply
        .header("content-type", "application/octet-stream")
        .header(
          "content-disposition",
          `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(result.name).replace(/'/gu, "%27")}`,
        )
        .header("x-content-type-options", "nosniff")
        .header("content-length", result.bytes.length)
        .send(result.bytes);
    },
  );
}
