import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  professionalDataExportSchema,
  professionalDataSchema,
  walletDataExportSchema,
  walletDataSchema,
} from "@coverview/contracts/partner-data";
import type { createDataRightsOperations } from "./partner.data-rights.js";
import type { PartnerActor } from "./partner.policy.js";

// Rights of the people concerned (C7): each surface reads and exports only its own person's data.
export function registerDataRightsRoutes(
  server: FastifyInstance,
  dataRights: ReturnType<typeof createDataRightsOperations>,
  actor: (r: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 60, timeWindow: "1 minute" } },
    // An export reads every section: a few per hour cover any real need.
    exporting = { rateLimit: { max: 6, timeWindow: "1 hour" } },
    empty = z.object({}).strict();
  app.get("/wallet/data", { config, schema: { response: { 200: walletDataSchema } } }, async (r) =>
    dataRights.walletData(await actor(r, true)),
  );
  app.post(
    "/wallet/data/exports",
    { config: exporting, schema: { body: empty, response: { 200: walletDataExportSchema } } },
    async (r, reply) => {
      const result = await dataRights.walletExport(await actor(r, true));
      void reply.header("cache-control", "no-store");
      return result;
    },
  );
  app.get(
    "/partner/data",
    { config, schema: { response: { 200: professionalDataSchema } } },
    async (r) => dataRights.professionalData(await actor(r)),
  );
  app.post(
    "/partner/data/exports",
    {
      config: exporting,
      schema: { body: empty, response: { 200: professionalDataExportSchema } },
    },
    async (r, reply) => {
      const result = await dataRights.professionalExport(await actor(r));
      void reply.header("cache-control", "no-store");
      return result;
    },
  );
}
