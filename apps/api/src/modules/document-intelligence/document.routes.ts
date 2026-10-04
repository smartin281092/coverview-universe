import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  documentIdSchema,
  documentSchema,
  documentListSchema,
  documentListQuerySchema,
  documentCreateInputSchema,
  documentRetryInputSchema,
  documentCategoryInputSchema,
  documentAssignProfileInputSchema,
  documentReviewInputSchema,
  documentReviewResultSchema,
  documentFieldReviewInputSchema,
  documentChangeRequestsSchema,
  documentChangeRequestSchema,
  documentProfileDifferencesSchema,
  documentCompaniesSchema,
  insuranceCompanyDetailsSchema,
  insuranceCompanyIdSchema,
  documentIdentityAttachmentSchema,
  documentIdentityAttachmentInputSchema,
  documentIdentityAttachmentQuerySchema,
  profileScopeQuerySchema,
} from "@coverview/contracts";
import type { createDocumentRepository } from "./document.repository.js";
import type { createDocumentService } from "./document.service.js";

export function registerDocumentRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createDocumentRepository>,
  service: ReturnType<typeof createDocumentService>,
  identity: {
    authenticate(request: FastifyRequest): Promise<{ id: string; userId: string }>;
    checkHost(request: FastifyRequest): void;
    checkMutation(request: FastifyRequest): Promise<void>;
  },
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const params = z.object({ id: documentIdSchema }).strict();
  const key = (request: FastifyRequest) => String(request.headers["idempotency-key"]);
  const actors = new WeakMap<FastifyRequest, { id: string; userId: string }>();
  const actor = (request: FastifyRequest) => {
    const value = actors.get(request);
    if (!value) throw new Error("Document authentication hook missing");
    return value;
  };
  const read = async (request: FastifyRequest) => {
    identity.checkHost(request);
    actors.set(request, await identity.authenticate(request));
  };
  const write = async (request: FastifyRequest) => {
    await identity.checkMutation(request);
    actors.set(request, await identity.authenticate(request));
  };
  const limited = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  app.get(
    "/documents/identity-attachment",
    {
      onRequest: read,
      config: limited,
      schema: {
        querystring: documentIdentityAttachmentQuerySchema,
        response: { 200: documentIdentityAttachmentSchema },
      },
    },
    async (request) =>
      repository.identityAttachment(actor(request).userId, request.query.profileId),
  );
  app.post(
    "/documents/identity-attachment",
    {
      onRequest: write,
      config: limited,
      schema: {
        body: documentIdentityAttachmentInputSchema,
        response: { 200: documentIdentityAttachmentSchema },
      },
    },
    async (request) =>
      repository.saveIdentityAttachment(actor(request), request.body, key(request)),
  );
  app.get(
    "/documents/companies",
    {
      onRequest: read,
      config: limited,
      schema: { response: { 200: documentCompaniesSchema } },
    },
    async (request) => repository.referencedCompanies(actor(request).userId),
  );
  app.get(
    "/documents/companies/:companyId",
    {
      onRequest: read,
      config: limited,
      schema: {
        params: z.object({ companyId: insuranceCompanyIdSchema }).strict(),
        querystring: profileScopeQuerySchema,
        response: { 200: insuranceCompanyDetailsSchema },
      },
    },
    async (request) =>
      repository.insuranceCompany(
        actor(request).userId,
        request.params.companyId,
        request.query.profileId,
      ),
  );
  app.get(
    "/documents/profile-differences",
    {
      onRequest: read,
      config: limited,
      schema: { response: { 200: documentProfileDifferencesSchema } },
    },
    async (request) => repository.profileDifferences(actor(request).userId),
  );
  app.get(
    "/document-change-requests",
    {
      onRequest: read,
      config: limited,
      schema: {
        querystring: profileScopeQuerySchema
          .extend({ cursor: z.string().max(300).optional() })
          .strict(),
        response: { 200: documentChangeRequestsSchema },
      },
    },
    async (request) =>
      repository.changeRequests(
        actor(request).userId,
        request.query.cursor,
        request.query.profileId,
      ),
  );
  app.post(
    "/documents/:id/change-requests/:requestId/cancel",
    {
      onRequest: write,
      config: limited,
      schema: {
        params: z.object({ id: documentIdSchema, requestId: z.uuid() }).strict(),
        body: z.object({}).strict(),
        response: { 200: documentChangeRequestSchema },
      },
    },
    async (request) =>
      repository.cancelChangeRequest(
        actor(request),
        request.params.id,
        request.params.requestId,
        key(request),
      ),
  );
  app.addContentTypeParser(
    "application/octet-stream",
    { parseAs: "buffer", bodyLimit: 20 * 1024 * 1024 },
    (_, body, done) => done(null, body),
  );
  app.get(
    "/documents",
    {
      onRequest: read,
      config: limited,
      schema: {
        querystring: documentListQuerySchema,
        response: { 200: documentListSchema },
      },
    },
    async (request) => {
      const { cursor, ...filters } = request.query;
      return repository.list(actor(request).userId, cursor, filters);
    },
  );
  app.post(
    "/documents",
    {
      onRequest: write,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { body: documentCreateInputSchema, response: { 200: documentSchema } },
    },
    async (request) => repository.create(actor(request), request.body, key(request)),
  );
  app.get(
    "/documents/:id",
    {
      onRequest: read,
      config: limited,
      schema: { params, querystring: profileScopeQuerySchema, response: { 200: documentSchema } },
    },
    async (request) =>
      repository.get(actor(request).userId, request.params.id, request.query.profileId),
  );
  app.post(
    "/documents/:id/profile",
    {
      onRequest: write,
      config: limited,
      schema: { params, body: documentAssignProfileInputSchema, response: { 200: documentSchema } },
    },
    async (request) =>
      repository.assignProfile(actor(request), request.params.id, request.body, key(request)),
  );
  app.post(
    "/documents/:id/content",
    {
      onRequest: write,
      bodyLimit: 20 * 1024 * 1024,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      schema: { params, response: { 200: documentSchema } },
    },
    async (request) =>
      service.upload(actor(request), request.params.id, z.instanceof(Buffer).parse(request.body)),
  );
  app.get(
    "/documents/:id/download",
    { onRequest: read, config: limited, schema: { params } },
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
  app.post(
    "/documents/:id/retry",
    {
      onRequest: write,
      config: limited,
      schema: { params, body: documentRetryInputSchema, response: { 200: documentSchema } },
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
  app.post(
    "/documents/:id/category",
    {
      onRequest: write,
      config: limited,
      schema: { params, body: documentCategoryInputSchema, response: { 200: documentSchema } },
    },
    async (request) =>
      repository.categorize(actor(request), request.params.id, request.body, key(request)),
  );
  app.post(
    "/documents/:id/fields",
    {
      onRequest: write,
      config: limited,
      schema: { params, body: documentFieldReviewInputSchema, response: { 200: documentSchema } },
    },
    async (request) =>
      repository.fields(actor(request), request.params.id, request.body, key(request)),
  );
  app.post(
    "/documents/:id/review",
    {
      onRequest: write,
      config: limited,
      schema: {
        params,
        body: documentReviewInputSchema,
        response: { 200: documentReviewResultSchema },
      },
    },
    async (request) =>
      repository.review(actor(request), request.params.id, request.body, key(request)),
  );
  app.post(
    "/documents/:id/delete",
    {
      onRequest: write,
      config: limited,
      schema: {
        params,
        body: z.object({}).strict(),
        response: { 200: z.object({ success: z.literal(true) }) },
      },
    },
    async (request) => {
      await repository.remove(actor(request), request.params.id);
      return { success: true as const };
    },
  );
}
