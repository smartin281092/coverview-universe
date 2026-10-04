import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Pool } from "pg";
import { z } from "zod";
import {
  offerImportResultSchema,
  competenceDossierSchema,
  leadCategorySchema,
} from "@coverview/contracts/partner";
import { DocumentError } from "./document.repository.js";
import type { createDocumentService } from "./document.service.js";
export type LeadSourceAuthorization = {
  authorizeCompetenceSource(
    request: FastifyRequest,
    userId: string,
    category: string,
    id: string,
    write: boolean,
    record?: boolean,
  ): Promise<{ userId: string; documentId: string }>;
  completeCompetenceUpload(
    request: FastifyRequest,
    userId: string,
    category: string,
    id: string,
    mime: string,
  ): Promise<z.infer<typeof competenceDossierSchema>>;
  authorizeFinalPolicySource(
    request: FastifyRequest,
    leadId: string,
    policyId: string,
    wallet: boolean,
  ): Promise<string>;
  recordFinalPolicySource(
    request: FastifyRequest,
    leadId: string,
    policyId: string,
    wallet: boolean,
  ): Promise<void>;
  authorizeImport(
    request: FastifyRequest,
    leadId: string,
    importId: string,
    write: boolean,
  ): Promise<{ documentId: string; userId: string }>;
  completeImportUpload(
    request: FastifyRequest,
    leadId: string,
    importId: string,
    mime: string,
  ): Promise<z.infer<typeof offerImportResultSchema>>;
  recordImportSource(request: FastifyRequest, leadId: string, importId: string): Promise<void>;
  authorizeContractSource(
    request: FastifyRequest,
    leadId: string,
    wallet: boolean,
  ): Promise<string>;
  recordContractSource(request: FastifyRequest, leadId: string, wallet: boolean): Promise<void>;
  recordSource(
    request: FastifyRequest,
    leadId: string,
    offerId: string,
    wallet: boolean,
  ): Promise<void>;
  authorizeSource(
    request: FastifyRequest,
    leadId: string,
    offerId: string,
    wallet: boolean,
  ): Promise<string>;
};
export function registerLeadDocumentRoutes(
  server: FastifyInstance,
  pool: Pool,
  service: ReturnType<typeof createDocumentService>,
  access: LeadSourceAuthorization,
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const competenceParams = z
    .object({
      userId: z.string().min(1).max(100),
      category: leadCategorySchema,
      id: z.string().min(1).max(100),
    })
    .strict();
  const competenceSource = (request: FastifyRequest, write: boolean, record = false) => {
    const p = competenceParams.parse(request.params);
    return access.authorizeCompetenceSource(request, p.userId, p.category, p.id, write, record);
  };
  app.post(
    "/partner/competence/:userId/:category/:id/content",
    {
      bodyLimit: 20 * 1024 * 1024,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      onRequest: async (request) => {
        await competenceSource(request, true);
      },
      schema: { params: competenceParams, response: { 200: competenceDossierSchema } },
    },
    async (request) => {
      const original = await competenceSource(request, true),
        p = request.params;
      return service.uploadShared(
        original.userId,
        original.documentId,
        z.instanceof(Buffer).parse(request.body),
        async () => {
          const current = await competenceSource(request, true);
          if (current.documentId !== original.documentId || current.userId !== original.userId)
            throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        },
        (mime) => access.completeCompetenceUpload(request, p.userId, p.category, p.id, mime),
      );
    },
  );
  app.get(
    "/partner/competence/:userId/:category/:id/source",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { params: competenceParams },
    },
    async (request, reply) => {
      const original = await competenceSource(request, false);
      const result = await service.downloadShared(
        original.userId,
        original.documentId,
        async () => {
          const current = await competenceSource(request, false);
          if (current.documentId !== original.documentId || current.userId !== original.userId)
            throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        },
      );
      await competenceSource(request, false, true);
      return reply
        .header("content-type", "application/octet-stream")
        .header(
          "content-disposition",
          `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(result.name).replace(/'/gu, "%27")}`,
        )
        .header("x-content-type-options", "nosniff")
        .send(result.bytes);
    },
  );
  const importParams = z
    .object({ id: z.string().min(1).max(100), importId: z.string().min(1).max(100) })
    .strict();
  const importAccess = (
    request: FastifyRequest,
    leadId: string,
    importId: string,
    write: boolean,
  ) => access.authorizeImport(request, leadId, importId, write);
  app.post(
    "/partner/leads/:id/offer-imports/:importId/content",
    {
      bodyLimit: 20 * 1024 * 1024,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      // Authenticate/authorize before receiving a potentially large request body.
      onRequest: async (request) => {
        const p = importParams.parse(request.params);
        await importAccess(request, p.id, p.importId, true);
      },
      schema: { params: importParams, response: { 200: offerImportResultSchema } },
    },
    async (request) => {
      const { id, importId } = request.params;
      const original = await importAccess(request, id, importId, true);
      return service.uploadShared(
        original.userId,
        original.documentId,
        z.instanceof(Buffer).parse(request.body),
        async () => {
          const current = await importAccess(request, id, importId, true);
          if (current.documentId !== original.documentId || current.userId !== original.userId)
            throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        },
        (mime) => access.completeImportUpload(request, id, importId, mime),
      );
    },
  );
  app.get(
    "/partner/leads/:id/offer-imports/:importId/source",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { params: importParams },
    },
    async (request, reply) => {
      const { id, importId } = request.params;
      const original = await importAccess(request, id, importId, false);
      const result = await service.downloadShared(
        original.userId,
        original.documentId,
        async () => {
          const current = await importAccess(request, id, importId, false);
          if (current.documentId !== original.documentId || current.userId !== original.userId)
            throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        },
      );
      await access.recordImportSource(request, id, importId);
      return reply
        .header("content-type", "application/octet-stream")
        .header(
          "content-disposition",
          `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(result.name).replace(/'/gu, "%27")}`,
        )
        .header("x-content-type-options", "nosniff")
        .send(result.bytes);
    },
  );
  for (const surface of ["partner", "wallet"])
    for (const kind of ["offer", "contract", "policy"] as const)
      app.get(
        kind === "policy"
          ? `/${surface}/leads/:id/final-policies/:policyId/source`
          : kind === "contract"
            ? `/${surface}/leads/:id/current-contract/source`
            : `/${surface}/leads/:id/offers/:offerId/source`,
        {
          config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
          schema: {
            params: z
              .object({
                id: z.string().max(100),
                offerId: z.string().max(100).optional(),
                policyId: z.string().max(100).optional(),
              })
              .strict(),
          },
        },
        async (request, reply) => {
          const { id, offerId, policyId } = request.params;
          const authorize = () =>
            kind === "policy"
              ? access.authorizeFinalPolicySource(request, id, policyId!, surface === "wallet")
              : kind === "contract"
                ? access.authorizeContractSource(request, id, surface === "wallet")
                : access.authorizeSource(request, id, offerId!, surface === "wallet");
          const documentId = await authorize();
          const source = (
            await pool.query<{ user_id: string }>(
              "select user_id from files where id=$1 and deleted_at is null",
              [documentId],
            )
          ).rows[0];
          if (!source) throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
          const result = await service.downloadShared(source.user_id, documentId, async () => {
            if ((await authorize()) !== documentId)
              throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
          });
          if (kind === "policy")
            await access.recordFinalPolicySource(request, id, policyId!, surface === "wallet");
          else if (kind === "contract")
            await access.recordContractSource(request, id, surface === "wallet");
          else await access.recordSource(request, id, offerId!, surface === "wallet");
          return reply
            .header("content-type", "application/octet-stream")
            .header(
              "content-disposition",
              `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(result.name).replace(/'/gu, "%27")}`,
            )
            .header("x-content-type-options", "nosniff")
            .send(result.bytes);
        },
      );
}
