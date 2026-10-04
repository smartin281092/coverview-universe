import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Pool } from "pg";
import { z } from "zod";
import { DocumentError } from "./document.repository.js";
import type { createDocumentService } from "./document.service.js";
export type LeadSourceAuthorization = {
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
  for (const surface of ["partner", "wallet"])
    app.get(
      `/${surface}/leads/:id/offers/:offerId/source`,
      {
        config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
        schema: {
          params: z.object({ id: z.string().max(100), offerId: z.string().max(100) }).strict(),
        },
      },
      async (request, reply) => {
        const { id, offerId } = request.params;
        const documentId = await access.authorizeSource(request, id, offerId, surface === "wallet");
        const source = (
          await pool.query<{ user_id: string }>(
            "select user_id from files where id=$1 and deleted_at is null",
            [documentId],
          )
        ).rows[0];
        if (!source) throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        const result = await service.downloadShared(source.user_id, documentId, async () => {
          if (
            (await access.authorizeSource(request, id, offerId, surface === "wallet")) !==
            documentId
          )
            throw new DocumentError("DOCUMENT_NOT_FOUND", 404);
        });
        await access.recordSource(request, id, offerId, surface === "wallet");
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
