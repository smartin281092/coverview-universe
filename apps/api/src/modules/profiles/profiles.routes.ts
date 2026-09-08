import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  managedProfileIdSchema,
  managedProfilesSchema,
  managedProfileSchema,
  managedProfileCreateInputSchema,
  profileSectionNameSchema,
  profileSectionSchema,
  profileSectionSaveInputSchema,
  adminUserIdSchema,
} from "@coverview/contracts";
import type { ProfileActor } from "../identity/index.js";
import type { createManagedProfileRepository } from "./profiles.repository.js";

export function registerManagedProfileRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createManagedProfileRepository>,
  identity: {
    authenticate(request: FastifyRequest): Promise<{ id: string; userId: string }>;
    authenticateAdministrator(request: FastifyRequest): Promise<{ id: string; userId: string }>;
    auditAdministratorAccess(
      request: FastifyRequest,
      targetUserId: string | null,
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
    actors.set(request, await identity.authenticate(request));
  };
  const write = async (request: FastifyRequest) => {
    await identity.checkMutation(request);
    actors.set(request, await identity.authenticate(request));
  };
  const actor = (request: FastifyRequest) => {
    const result = actors.get(request);
    if (!result) throw new Error("Profile authentication hook missing");
    return result;
  };
  const key = (request: FastifyRequest) => String(request.headers["idempotency-key"]);
  const limited = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  const params = z.object({ profileId: managedProfileIdSchema }).strict();
  const sectionParams = params.extend({ section: profileSectionNameSchema }).strict();
  app.get(
    "/profiles",
    { onRequest: read, config: limited, schema: { response: { 200: managedProfilesSchema } } },
    async (request) => repository.list(actor(request).userId),
  );
  app.post(
    "/profiles",
    {
      onRequest: write,
      config: limited,
      schema: { body: managedProfileCreateInputSchema, response: { 200: managedProfileSchema } },
    },
    async (request) => repository.create(actor(request), request.body, key(request)),
  );
  app.get(
    "/profiles/:profileId",
    {
      onRequest: read,
      config: limited,
      schema: { params, response: { 200: managedProfileSchema } },
    },
    async (request) => repository.get(actor(request).userId, request.params.profileId),
  );
  app.get(
    "/profiles/:profileId/sections/:section",
    {
      onRequest: read,
      config: limited,
      schema: { params: sectionParams, response: { 200: profileSectionSchema } },
    },
    async (request) =>
      repository.section(actor(request).userId, request.params.profileId, request.params.section),
  );
  app.post(
    "/profiles/:profileId/sections/:section",
    {
      onRequest: write,
      config: limited,
      schema: {
        params: sectionParams,
        body: profileSectionSaveInputSchema,
        response: { 200: profileSectionSchema },
      },
    },
    async (request) =>
      repository.saveSection(
        actor(request),
        request.params.profileId,
        request.params.section,
        request.body,
        key(request),
      ),
  );
  const administrators = new WeakMap<FastifyRequest, { id: string; userId: string }>();
  const adminRead = async (request: FastifyRequest) => {
    identity.checkHost(request);
    administrators.set(request, await identity.authenticateAdministrator(request));
  };
  const adminWrite = async (request: FastifyRequest) => {
    await identity.checkMutation(request);
    administrators.set(request, await identity.authenticateAdministrator(request));
  };
  const adminActor = (request: FastifyRequest, userId: string): ProfileActor => {
    const session = administrators.get(request);
    if (!session) throw new Error("Administrator authentication hook missing");
    return { userId, id: session.id, administratorUserId: session.userId };
  };
  const adminParams = z.object({ userId: adminUserIdSchema }).strict();
  const adminProfileParams = adminParams.extend({ profileId: managedProfileIdSchema }).strict();
  const adminSectionParams = adminProfileParams
    .extend({ section: profileSectionNameSchema })
    .strict();
  const base = "/admin/users/:userId/profiles";
  app.get(
    base,
    {
      onRequest: adminRead,
      config: limited,
      schema: { params: adminParams, response: { 200: managedProfilesSchema } },
    },
    async (request) => {
      await identity.auditAdministratorAccess(request, request.params.userId, "profiles", "list");
      return repository.list(request.params.userId);
    },
  );
  app.post(
    base,
    {
      onRequest: adminWrite,
      config: limited,
      schema: {
        params: adminParams,
        body: managedProfileCreateInputSchema,
        response: { 200: managedProfileSchema },
      },
    },
    async (request) => {
      await identity.auditAdministratorAccess(request, request.params.userId, "profiles", "create");
      return repository.create(
        adminActor(request, request.params.userId),
        request.body,
        key(request),
      );
    },
  );
  app.get(
    `${base}/:profileId`,
    {
      onRequest: adminRead,
      config: limited,
      schema: { params: adminProfileParams, response: { 200: managedProfileSchema } },
    },
    async (request) => {
      await identity.auditAdministratorAccess(
        request,
        request.params.userId,
        `profile:${request.params.profileId}`,
        "read",
      );
      return repository.get(request.params.userId, request.params.profileId);
    },
  );
  app.get(
    `${base}/:profileId/sections/:section`,
    {
      onRequest: adminRead,
      config: limited,
      schema: { params: adminSectionParams, response: { 200: profileSectionSchema } },
    },
    async (request) => {
      await identity.auditAdministratorAccess(
        request,
        request.params.userId,
        `profile:${request.params.profileId}:${request.params.section}`,
        "read",
      );
      return repository.section(
        request.params.userId,
        request.params.profileId,
        request.params.section,
      );
    },
  );
  app.post(
    `${base}/:profileId/sections/:section`,
    {
      onRequest: adminWrite,
      config: limited,
      schema: {
        params: adminSectionParams,
        body: profileSectionSaveInputSchema,
        response: { 200: profileSectionSchema },
      },
    },
    async (request) => {
      await identity.auditAdministratorAccess(
        request,
        request.params.userId,
        `profile:${request.params.profileId}:${request.params.section}`,
        "save",
      );
      return repository.saveSection(
        adminActor(request, request.params.userId),
        request.params.profileId,
        request.params.section,
        request.body,
        key(request),
      );
    },
  );
}
