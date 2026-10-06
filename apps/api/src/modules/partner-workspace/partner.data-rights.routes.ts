import { createHash } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  adminDataRequestSchema,
  adminDataRequestsQuerySchema,
  adminDataRequestsSchema,
  dataErasureExecutionSchema,
  dataErasurePlanSchema,
  dataRequestAnswerSchema,
  dataRequestRevisionSchema,
  dataRequestSchema,
  professionalDataExportSchema,
  professionalDataRequestInputSchema,
  professionalDataSchema,
  walletDataExportSchema,
  walletDataRequestInputSchema,
  walletDataSchema,
} from "@coverview/contracts/partner-data";
import type { createDataRightsOperations } from "./partner.data-rights.js";
import type { createDataRequestOperations } from "./partner.data-requests.js";
import type { createDataErasureOperations } from "./partner.data-erasure.js";
import type { PartnerActor } from "./partner.policy.js";

// Rights of the people concerned (C7): each surface reads, exports and files requests only for its
// own person; CoverView answers them, and executes a controlled erasure, from Admin.
export function registerDataRightsRoutes(
  server: FastifyInstance,
  dataRights: ReturnType<typeof createDataRightsOperations>,
  requests: ReturnType<typeof createDataRequestOperations>,
  erasure: ReturnType<typeof createDataErasureOperations>,
  actor: (r: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    config = { rateLimit: { max: 60, timeWindow: "1 minute" } },
    // An export reads every section: a few per hour cover any real need. Counted per session, not
    // per address, so people sharing one network do not share a quota; only a digest is kept.
    exporting = {
      rateLimit: {
        max: 6,
        timeWindow: "1 hour",
        keyGenerator: (r: FastifyRequest) => {
          const session = r.cookies["__Host-cv_session"] ?? r.cookies.cv_session;
          return session ? createHash("sha256").update(session).digest("hex") : r.ip;
        },
      },
    },
    empty = z.object({}).strict(),
    params = z.object({ id: z.string().min(1).max(100) }).strict(),
    key = (r: FastifyRequest) => String(r.headers["idempotency-key"]);
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
  app.post(
    "/wallet/data/requests",
    {
      config,
      schema: { body: walletDataRequestInputSchema, response: { 200: dataRequestSchema } },
    },
    async (r) => requests.fileWalletDataRequest(await actor(r, true), r.body, key(r)),
  );
  app.post(
    "/partner/data/requests",
    {
      config,
      schema: { body: professionalDataRequestInputSchema, response: { 200: dataRequestSchema } },
    },
    async (r) => requests.fileProfessionalDataRequest(await actor(r), r.body, key(r)),
  );
  for (const wallet of [false, true])
    app.post(
      `/${wallet ? "wallet" : "partner"}/data/requests/:id/withdraw`,
      {
        config,
        schema: { params, body: dataRequestRevisionSchema, response: { 200: dataRequestSchema } },
      },
      async (r) =>
        requests.withdrawDataRequest(await actor(r, wallet), r.params.id, r.body, key(r)),
    );
  app.get(
    "/admin/partner/data-requests",
    {
      config,
      schema: {
        querystring: adminDataRequestsQuerySchema,
        response: { 200: adminDataRequestsSchema },
      },
    },
    async (r) => requests.adminDataRequests(await actor(r, false, true), r.query),
  );
  app.get(
    "/admin/partner/data-requests/:id",
    { config, schema: { params, response: { 200: adminDataRequestSchema } } },
    async (r) => requests.adminDataRequest(await actor(r, false, true), r.params.id),
  );
  app.post(
    "/admin/partner/data-requests/:id/take",
    {
      config,
      schema: {
        params,
        body: dataRequestRevisionSchema,
        response: { 200: adminDataRequestSchema },
      },
    },
    async (r) => requests.takeDataRequest(await actor(r, false, true), r.params.id, r.body, key(r)),
  );
  app.post(
    "/admin/partner/data-requests/:id/answer",
    {
      config,
      schema: { params, body: dataRequestAnswerSchema, response: { 200: adminDataRequestSchema } },
    },
    async (r) =>
      requests.answerDataRequest(await actor(r, false, true), r.params.id, r.body, key(r)),
  );
  app.get(
    "/admin/partner/data-requests/:id/erasure",
    { config, schema: { params, response: { 200: dataErasurePlanSchema } } },
    async (r) => erasure.erasurePlan(await actor(r, false, true), r.params.id),
  );
  app.post(
    "/admin/partner/data-requests/:id/erasure",
    {
      config,
      schema: {
        params,
        body: dataErasureExecutionSchema,
        response: { 200: adminDataRequestSchema },
      },
    },
    async (r) => erasure.executeErasure(await actor(r, false, true), r.params.id, r.body, key(r)),
  );
}
