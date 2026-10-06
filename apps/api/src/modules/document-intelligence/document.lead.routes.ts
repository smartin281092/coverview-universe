import { insuranceCompanyIdSchema } from "@coverview/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Pool } from "pg";
import { z } from "zod";
import {
  offerImportResultSchema,
  competenceDossierSchema,
  conventionDossierSchema,
  leadCategorySchema,
} from "@coverview/contracts/partner";
import {
  organizationProfileDossierSchema,
  profileDossierSchema,
  profileImageMaxBytes,
} from "@coverview/contracts/partner-profiles";
import { DocumentError } from "./document.repository.js";
import type { createDocumentService } from "./document.service.js";
export type LeadSourceAuthorization = {
  conclusionCorrespondenceSource(
    request: FastifyRequest,
    leadId: string,
    sourceId: string,
    wallet: boolean,
    record?: boolean,
  ): Promise<string>;
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
  authorizeConventionSource(
    request: FastifyRequest,
    userId: string,
    category: string,
    companyId: string,
    id: string,
    write: boolean,
    record?: boolean,
  ): Promise<{ userId: string; documentId: string }>;
  completeConventionUpload(
    request: FastifyRequest,
    userId: string,
    category: string,
    companyId: string,
    id: string,
    mime: string,
  ): Promise<z.infer<typeof conventionDossierSchema>>;
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
  // Profile photo and organisation logo (C8c).
  authorizeProfilePhoto(
    request: FastifyRequest,
    userId: string,
    revision: number | null,
    write: boolean,
  ): Promise<{ userId: string; documentId: string }>;
  completeProfilePhotoUpload(
    request: FastifyRequest,
    userId: string,
    mime: string,
  ): Promise<z.infer<typeof profileDossierSchema>>;
  authorizePublishedPhoto(
    request: FastifyRequest,
    userId: string,
    wallet: boolean,
  ): Promise<{ userId: string; documentId: string }>;
  authorizeOrganizationLogo(
    request: FastifyRequest,
    organizationId: string,
    revision: number | null,
    write: boolean,
  ): Promise<{ userId: string; documentId: string }>;
  completeOrganizationLogoUpload(
    request: FastifyRequest,
    organizationId: string,
    mime: string,
  ): Promise<z.infer<typeof organizationProfileDossierSchema>>;
  authorizePublishedLogo(
    request: FastifyRequest,
    userId: string,
    wallet: boolean,
  ): Promise<{ userId: string; documentId: string }>;
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
  const conventionParams = z
    .object({
      userId: z.string().min(1).max(100),
      category: leadCategorySchema,
      companyId: insuranceCompanyIdSchema,
      id: z.string().min(1).max(100),
    })
    .strict();
  const conventionSource = (request: FastifyRequest, write: boolean, record = false) => {
    const p = conventionParams.parse(request.params);
    return access.authorizeConventionSource(
      request,
      p.userId,
      p.category,
      p.companyId,
      p.id,
      write,
      record,
    );
  };
  app.post(
    "/partner/convention/:userId/:category/:companyId/:id/content",
    {
      bodyLimit: 20 * 1024 * 1024,
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
      onRequest: async (request) => {
        await conventionSource(request, true);
      },
      schema: { params: conventionParams, response: { 200: conventionDossierSchema } },
    },
    async (request) => {
      const original = await conventionSource(request, true),
        p = request.params;
      return service.uploadShared(
        original.userId,
        original.documentId,
        z.instanceof(Buffer).parse(request.body),
        async () => {
          const current = await conventionSource(request, true);
          if (current.documentId !== original.documentId || current.userId !== original.userId)
            throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        },
        (mime) =>
          access.completeConventionUpload(request, p.userId, p.category, p.companyId, p.id, mime),
      );
    },
  );
  app.get(
    "/partner/convention/:userId/:category/:companyId/:id/source",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { params: conventionParams },
    },
    async (request, reply) => {
      const original = await conventionSource(request, false);
      const result = await service.downloadShared(
        original.userId,
        original.documentId,
        async () => {
          const current = await conventionSource(request, false);
          if (current.documentId !== original.documentId || current.userId !== original.userId)
            throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        },
      );
      await conventionSource(request, false, true);
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
    for (const kind of ["offer", "contract", "policy", "correspondence"] as const)
      app.get(
        kind === "correspondence"
          ? `/${surface}/leads/:id/conclusion-correspondences/:correspondenceId/source`
          : kind === "policy"
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
                correspondenceId: z.string().max(100).optional(),
              })
              .strict(),
          },
        },
        async (request, reply) => {
          const { id, offerId, policyId, correspondenceId } = request.params;
          const authorize = () =>
            kind === "correspondence"
              ? access.conclusionCorrespondenceSource(
                  request,
                  id,
                  correspondenceId!,
                  surface === "wallet",
                )
              : kind === "policy"
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
          if (kind === "correspondence")
            await access.conclusionCorrespondenceSource(
              request,
              id,
              correspondenceId!,
              surface === "wallet",
              true,
            );
          else if (kind === "policy")
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
  // Profile photo and organisation logo (C8c): bytes checked against the authorised file before
  // and after storage, served only as an attachment that the browser never interprets.
  const sendPicture = (reply: FastifyReply, bytes: Buffer) =>
    reply
      .header("content-type", "application/octet-stream")
      .header("content-disposition", 'attachment; filename="image"')
      .header("x-content-type-options", "nosniff")
      .header("cache-control", "private, no-store")
      .send(bytes);
  type Picture = () => Promise<{ userId: string; documentId: string }>;
  const upload = async <T>(
    request: FastifyRequest,
    authorize: Picture,
    complete: (mime: string) => Promise<T>,
  ) => {
    const original = await authorize();
    return service.uploadShared(
      original.userId,
      original.documentId,
      z.instanceof(Buffer).parse(request.body),
      async () => {
        const current = await authorize();
        if (current.documentId !== original.documentId || current.userId !== original.userId)
          throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
      },
      complete,
    );
  };
  const download = async (authorize: Picture) => {
    const original = await authorize();
    return service.downloadShared(original.userId, original.documentId, async () => {
      const current = await authorize();
      if (current.documentId !== original.documentId || current.userId !== original.userId)
        throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
    });
  };
  const userParams = z.object({ userId: z.string().min(1).max(100) }).strict();
  const organizationParams = z.object({ organizationId: z.string().min(1).max(100) }).strict();
  const userRevisionParams = userParams
    .extend({ revision: z.coerce.number().int().positive() })
    .strict();
  const organizationRevisionParams = organizationParams
    .extend({ revision: z.coerce.number().int().positive() })
    .strict();
  const pictureUpload = {
    bodyLimit: profileImageMaxBytes,
    config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  };
  app.post(
    "/partner/profiles/:userId/photo/content",
    {
      ...pictureUpload,
      onRequest: async (request) => {
        const { userId } = userParams.parse(request.params);
        await access.authorizeProfilePhoto(request, userId, null, true);
      },
      schema: { params: userParams, response: { 200: profileDossierSchema } },
    },
    async (request) =>
      upload(
        request,
        () => access.authorizeProfilePhoto(request, request.params.userId, null, true),
        (mime) => access.completeProfilePhotoUpload(request, request.params.userId, mime),
      ),
  );
  app.get(
    "/partner/profiles/:userId/versions/:revision/photo",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { params: userRevisionParams },
    },
    async (request, reply) => {
      const result = await download(() =>
        access.authorizeProfilePhoto(
          request,
          request.params.userId,
          request.params.revision,
          false,
        ),
      );
      return sendPicture(reply, result.bytes);
    },
  );
  app.post(
    "/partner/organizations/:organizationId/logo/content",
    {
      ...pictureUpload,
      onRequest: async (request) => {
        const { organizationId } = organizationParams.parse(request.params);
        await access.authorizeOrganizationLogo(request, organizationId, null, true);
      },
      schema: { params: organizationParams, response: { 200: organizationProfileDossierSchema } },
    },
    async (request) =>
      upload(
        request,
        () => access.authorizeOrganizationLogo(request, request.params.organizationId, null, true),
        (mime) =>
          access.completeOrganizationLogoUpload(request, request.params.organizationId, mime),
      ),
  );
  app.get(
    "/partner/organizations/:organizationId/versions/:revision/logo",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: { params: organizationRevisionParams },
    },
    async (request, reply) => {
      const result = await download(() =>
        access.authorizeOrganizationLogo(
          request,
          request.params.organizationId,
          request.params.revision,
          false,
        ),
      );
      return sendPicture(reply, result.bytes);
    },
  );
  for (const surface of ["partner", "wallet"] as const) {
    app.get(
      `/${surface}/advisors/:userId/photo`,
      {
        config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
        schema: { params: userParams },
      },
      async (request, reply) => {
        const result = await download(() =>
          access.authorizePublishedPhoto(request, request.params.userId, surface === "wallet"),
        );
        return sendPicture(reply, result.bytes);
      },
    );
    app.get(
      `/${surface}/advisors/:userId/organization-logo`,
      {
        config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
        schema: { params: userParams },
      },
      async (request, reply) => {
        const result = await download(() =>
          access.authorizePublishedLogo(request, request.params.userId, surface === "wallet"),
        );
        return sendPicture(reply, result.bytes);
      },
    );
  }
}
