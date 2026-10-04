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
  offerHistoryQuerySchema,
  offerHistorySchema,
  partnerWorkSchema,
  partnerNotificationsSchema,
  partnerNotificationQuerySchema,
  partnerContinuitySettingsSchema,
  partnerContinuityUpdateSchema,
  collaborationListSchema,
  collaborationResponseSchema,
  collaborationSchema,
  insuranceLeadConsentSchema,
  insuranceLeadLinksSchema,
  insuranceLeadSourceSchema,
  contractCandidatesSchema,
  finalPoliciesSchema,
  offerImportInputSchema,
  offerImportRetrySchema,
  offerImportsSchema,
  offerImportResultSchema,
  leadCategorySchema,
  referentProfileSchema,
  referentQuerySchema,
  referentUpdateSchema,
} from "@coverview/contracts/partner";
import { insuranceRequestIdSchema } from "@coverview/contracts/insurance-requests";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import type { registerIdentity } from "../identity/index.js";
import { createPartnerRepository } from "./partner.repository.js";
import { PartnerError, type PartnerActor } from "./partner.policy.js";
import { startPartnerJobs } from "./partner.jobs.js";
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
  let stopJobs: (() => Promise<void>) | undefined;
  app.addHook("onReady", async () => {
    if (config.AUTH_ENABLED && config.PARTNER_JOBS_ENABLED)
      stopJobs = await startPartnerJobs(config.REDIS_URL, database.pool, app.log);
  });
  app.addHook("onClose", async () => {
    await stopJobs?.();
    await database.pool.end();
  });
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
  const insuranceParams = z.object({ id: insuranceRequestIdSchema }).strict();
  const referentParams = z
    .object({ profileId: z.string().min(1).max(100), category: leadCategorySchema })
    .strict();
  app.get(
    "/wallet/referents/:profileId/:category",
    {
      config: limited,
      schema: {
        params: referentParams,
        querystring: referentQuerySchema,
        response: { 200: referentProfileSchema },
      },
    },
    async (request) =>
      repository.referentProfile(
        await actor(request, true),
        request.params.profileId,
        request.params.category,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/wallet/referents/:profileId/:category",
    {
      config: limited,
      schema: {
        params: referentParams,
        body: referentUpdateSchema,
        response: { 200: referentProfileSchema },
      },
    },
    async (request) =>
      repository.updateReferent(
        await actor(request, true),
        request.params.profileId,
        request.params.category,
        request.body,
        key(request),
      ),
  );
  const importParams = params.extend({ importId: z.string().min(1).max(100) });
  app.get(
    "/partner/leads/:id/offer-imports",
    {
      config: limited,
      schema: {
        params,
        querystring: offerHistoryQuerySchema,
        response: { 200: offerImportsSchema },
      },
    },
    async (request) =>
      repository.offerImports(await actor(request), request.params.id, request.query.cursor),
  );
  app.post(
    "/partner/leads/:id/offer-imports",
    {
      config: limited,
      schema: { params, body: offerImportInputSchema, response: { 200: offerImportResultSchema } },
    },
    async (request) =>
      repository.prepareOfferImport(
        await actor(request),
        request.params.id,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/leads/:id/offer-imports/:importId/retry",
    {
      config: limited,
      schema: {
        params: importParams,
        body: offerImportRetrySchema,
        response: { 200: offerImportResultSchema },
      },
    },
    async (request) =>
      repository.retryOfferImport(
        await actor(request),
        request.params.id,
        request.params.importId,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/leads/:id/insurance-request",
    { config: limited, schema: { params, response: { 200: insuranceLeadSourceSchema } } },
    async (request) => repository.insuranceSource(await actor(request), request.params.id),
  );
  app.get(
    "/wallet/leads/:id/contracts",
    {
      config: limited,
      schema: { params, response: { 200: contractCandidatesSchema } },
    },
    async (request) => repository.contractCandidates(await actor(request, true), request.params.id),
  );
  app.get(
    "/wallet/insurance-request-leads/:id",
    {
      config: limited,
      schema: { params: insuranceParams, response: { 200: insuranceLeadLinksSchema } },
    },
    async (request) => repository.insuranceLinks(await actor(request, true), request.params.id),
  );
  app.post(
    "/wallet/insurance-request-leads/:id",
    {
      config: limited,
      schema: {
        params: insuranceParams,
        body: insuranceLeadConsentSchema,
        response: { 200: leadDetailSchema },
      },
    },
    async (request) =>
      repository.linkInsurance(
        await actor(request, true),
        request.params.id,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/admin/partner/continuity",
    { config: limited, schema: { response: { 200: partnerContinuitySettingsSchema } } },
    async (request) => repository.continuitySettings(await actor(request, false, true)),
  );
  app.post(
    "/admin/partner/continuity",
    {
      config: limited,
      schema: {
        body: partnerContinuityUpdateSchema,
        response: { 200: partnerContinuitySettingsSchema },
      },
    },
    async (request) =>
      repository.updateContinuitySettings(
        await actor(request, false, true),
        request.body,
        key(request),
      ),
  );
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
    "/partner/collaborations",
    {
      config: limited,
      schema: { response: { 200: collaborationListSchema } },
    },
    async (request) => repository.collaborations(await actor(request)),
  );
  app.post(
    "/partner/collaborations/:id/respond",
    {
      config: limited,
      schema: { params, body: collaborationResponseSchema, response: { 200: collaborationSchema } },
    },
    async (request) =>
      repository.respondCollaboration(
        await actor(request),
        request.params.id,
        request.body,
        key(request),
      ),
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
    app.get(
      `/${surface}/notifications`,
      {
        config: limited,
        schema: {
          querystring: partnerNotificationQuerySchema,
          response: { 200: partnerNotificationsSchema },
        },
      },
      async (request) =>
        repository.notifications(await actor(request, surface === "wallet"), request.query),
    );
    app.post(
      `/${surface}/notifications/:id/read`,
      {
        config: limited,
        schema: {
          params,
          body: z.object({}).strict(),
          response: { 200: z.object({ read: z.literal(true) }) },
        },
      },
      async (request) =>
        repository.readNotification(
          await actor(request, surface === "wallet"),
          request.params.id,
          key(request),
        ),
    );
    const base = `/${surface}/leads`;
    app.get(
      `${base}/:id/final-policies`,
      {
        config: limited,
        schema: {
          params,
          querystring: offerHistoryQuerySchema,
          response: { 200: finalPoliciesSchema },
        },
      },
      async (request) =>
        repository.finalPolicies(
          await actor(request, surface === "wallet"),
          request.params.id,
          request.query.cursor,
        ),
    );
    app.get(
      `${base}/:id/offers/history`,
      {
        config: limited,
        schema: {
          params,
          querystring: offerHistoryQuerySchema,
          response: { 200: offerHistorySchema },
        },
      },
      async (request) =>
        repository.offerHistory(
          await actor(request, surface === "wallet"),
          request.params.id,
          request.query.cursor,
        ),
    );
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
    async authorizeFinalPolicySource(
      request: FastifyRequest,
      leadId: string,
      policyId: string,
      wallet: boolean,
    ) {
      return repository.finalPolicySource(await actor(request, wallet), leadId, policyId);
    },
    async recordFinalPolicySource(
      request: FastifyRequest,
      leadId: string,
      policyId: string,
      wallet: boolean,
    ) {
      await repository.finalPolicySource(await actor(request, wallet), leadId, policyId, true);
    },
    async recordContractSource(request: FastifyRequest, leadId: string, wallet: boolean) {
      await repository.sourceConsulted(await actor(request, wallet), leadId, null);
    },
    async authorizeContractSource(request: FastifyRequest, leadId: string, wallet: boolean) {
      const lead = await repository.detail(await actor(request, wallet), leadId);
      if (lead.currentContract?.status !== "available")
        throw new PartnerError("PARTNER_NOT_FOUND", 404);
      return lead.currentContract.documentId;
    },
    async recordSource(request: FastifyRequest, leadId: string, offerId: string, wallet: boolean) {
      await repository.sourceConsulted(await actor(request, wallet), leadId, offerId);
    },
    async authorizeImport(
      request: FastifyRequest,
      leadId: string,
      importId: string,
      write: boolean,
    ) {
      return repository.importSource(await actor(request), leadId, importId, write);
    },
    async completeImportUpload(
      request: FastifyRequest,
      leadId: string,
      importId: string,
      mime: string,
    ) {
      return repository.completeImportUpload(await actor(request), leadId, importId, mime);
    },
    async recordImportSource(request: FastifyRequest, leadId: string, importId: string) {
      await repository.importSourceConsulted(await actor(request), leadId, importId);
    },
    async authorizeSource(
      request: FastifyRequest,
      leadId: string,
      offerId: string,
      wallet: boolean,
    ) {
      return repository.offerSource(await actor(request, wallet), leadId, offerId);
    },
  };
}
