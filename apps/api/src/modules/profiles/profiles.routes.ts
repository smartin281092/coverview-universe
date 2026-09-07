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
} from "@coverview/contracts";
import type { createManagedProfileRepository } from "./profiles.repository.js";

export function registerManagedProfileRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createManagedProfileRepository>,
  identity: {
    authenticate(request: FastifyRequest): Promise<{ id: string; userId: string }>;
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
}
