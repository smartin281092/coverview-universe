import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  leadCreateInputSchema,
  leadCommandSchema,
  leadDetailSchema,
  leadListQuerySchema,
  leadListSchema,
  partnerApplicationInputSchema,
  partnerReviewInputSchema,
  partnerApplicationSchema,
  partnerContextSchema,
  partnerApplicationsSchema,
  partnerDirectorySchema,
  partnerDashboardSchema,
  offerExtractionSchema,
  partnerWorkSchema,
} from "@coverview/contracts/partner";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import type { registerIdentity } from "../identity/index.js";
import { createPartnerRepository } from "./partner.repository.js";
import { PartnerError, type PartnerActor } from "./partner.policy.js";
export { PartnerError } from "./partner.policy.js";

export function registerPartnerWorkspace(
  server: FastifyInstance,
  config: Environment,
  identity: Awaited<ReturnType<typeof registerIdentity>>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    database = createDatabase(config),
    repository = createPartnerRepository(database.pool);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "partner_database" }, "Partner database unavailable"),
  );
  app.addHook("onClose", () => database.pool.end());
  const params = z.object({ id: z.string().min(1).max(100) }).strict();
  const limited = { rateLimit: { max: 120, timeWindow: "1 minute" } };
  const key = (request: FastifyRequest) => String(request.headers["idempotency-key"]);
  async function actor(
    request: FastifyRequest,
    wallet = false,
    adminOnly = false,
  ): Promise<PartnerActor> {
    identity.checkHost(request);
    if (request.method !== "GET") await identity.checkMutation(request);
    const session = await identity.authenticate(request);
    if (adminOnly || (!wallet && session.hasAdminPermission)) {
      await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(
        request,
        null,
        "partner-workspace",
        `${request.method} ${request.routeOptions.url ?? ""}`,
      );
      return { userId: session.userId, id: session.id, administrator: true };
    }
    return { userId: session.userId, id: session.id, administrator: false, wallet };
  }
  app.get(
    "/partner/dashboard",
    {
      config: limited,
      schema: {
        response: { 200: partnerDashboardSchema },
      },
    },
    async (request) => repository.dashboard(await actor(request)),
  );
  app.get(
    "/partner/work",
    { config: limited, schema: { response: { 200: partnerWorkSchema } } },
    async (request) => repository.work(await actor(request)),
  );
  app.get(
    "/partner/context",
    { config: limited, schema: { response: { 200: partnerContextSchema } } },
    async (request) => repository.context(await actor(request)),
  );
  app.post(
    "/partner/application",
    {
      config: limited,
      schema: { body: partnerApplicationInputSchema, response: { 200: partnerContextSchema } },
    },
    async (request) => repository.apply(await actor(request), request.body, key(request)),
  );
  app.get(
    "/partner/directory",
    {
      config: limited,
      schema: {
        response: {
          200: partnerDirectorySchema,
        },
      },
    },
    async (request) => repository.directory(await actor(request)),
  );
  app.get(
    "/admin/partner/applications",
    { config: limited, schema: { response: { 200: partnerApplicationsSchema } } },
    async (request) => repository.applications(await actor(request, false, true)),
  );
  app.post(
    "/admin/partner/applications/:id/review",
    {
      config: limited,
      schema: {
        params,
        body: partnerReviewInputSchema,
        response: { 200: partnerApplicationSchema },
      },
    },
    async (request) =>
      repository.review(
        await actor(request, false, true),
        request.params.id,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/leads/:id/extraction/:documentId",
    {
      config: limited,
      schema: {
        params: params.extend({ documentId: z.string().max(100) }),
        response: { 200: offerExtractionSchema },
      },
    },
    async (request) =>
      repository.extraction(await actor(request), request.params.id, request.params.documentId),
  );
  for (const surface of ["partner", "wallet"] as const) {
    const base = `/${surface}/leads`;
    app.get(
      base,
      {
        config: limited,
        schema: { querystring: leadListQuerySchema, response: { 200: leadListSchema } },
      },
      async (request) => repository.list(await actor(request, surface === "wallet"), request.query),
    );
    app.post(
      base,
      {
        config: limited,
        schema: { body: leadCreateInputSchema, response: { 200: leadDetailSchema } },
      },
      async (request) =>
        repository.create(await actor(request, surface === "wallet"), request.body, key(request)),
    );
    app.get(
      `${base}/:id`,
      { config: limited, schema: { params, response: { 200: leadDetailSchema } } },
      async (request) =>
        repository.detail(await actor(request, surface === "wallet"), request.params.id),
    );
    app.post(
      `${base}/:id/commands`,
      {
        config: limited,
        schema: { params, body: leadCommandSchema, response: { 200: leadDetailSchema } },
      },
      async (request) =>
        repository.command(
          await actor(request, surface === "wallet"),
          request.params.id,
          request.body,
          key(request),
        ),
    );
  }
  return {
    async recordSource(request: FastifyRequest, leadId: string, offerId: string, wallet: boolean) {
      await repository.sourceConsulted(await actor(request, wallet), leadId, offerId);
    },
    async authorizeSource(
      request: FastifyRequest,
      leadId: string,
      offerId: string,
      wallet: boolean,
    ) {
      const current = await actor(request, wallet),
        lead = await repository.detail(current, leadId);
      const offer = lead.offers.find((value) => value.id === offerId);
      if (!offer) throw new PartnerError("PARTNER_NOT_FOUND", 404);
      return offer.documentId;
    },
  };
}
