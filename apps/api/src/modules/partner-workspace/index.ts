import { insuranceCompanyIdSchema } from "@coverview/contracts";
import {
  commercialInputSchema,
  commercialReviewSchema,
  commercialConditionSchema,
  commercialListSchema,
  marketQuerySchema,
  marketPublicationSchema,
  marketApplicationInputSchema,
  marketReservationInputSchema,
  marketDecisionSchema,
  marketMandateInputSchema,
  marketDetailSchema,
  marketListSchema,
  marketReservationSchema,
  marketMandatesSchema,
  economyCaseInputSchema,
  economyRecordSchema,
  economyCaseSchema,
  economyCasesSchema,
  economyAgreementsSchema,
} from "@coverview/contracts/partner-economy";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  walletAppointmentSchema,
  bookingProposalsSchema,
  bookingProposalInputSchema,
  bookingChoiceSchema,
  bookingWithdrawalSchema,
  coordinatedBookingInputSchema,
  coordinatedBookingReceiptSchema,
  counselRequestInputSchema,
  counselActionInputSchema,
  counselRequestSchema,
  counselPersonalSchema,
  counselQueueSchema,
  counselCandidatesSchema,
  counselQuerySchema,
  walletAppointmentCancellationSchema,
  appointmentLinksManagementSchema,
  appointmentLinksPreviewSchema,
  appointmentLinksSelectionSchema,
  appointmentLinksConfirmSchema,
  appointmentUnlinkSchema,
  sharedAppointmentsSchema,
  needExpertiseInputSchema,
  needExpertiseDossierSchema,
  needConflictInputSchema,
  needConflictDossierSchema,
  needCapacityInputSchema,
  needCapacityDossierSchema,
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
  competenceDossierSchema,
  competenceDeclarationSchema,
  competenceDecisionSchema,
  competenceQuerySchema,
  conventionDossierSchema,
  conventionDeclarationSchema,
  conventionDecisionSchema,
  conventionQuerySchema,
  professionalAvailabilityInputSchema,
  professionalAvailabilityDossierSchema,
  professionalPracticeInputSchema,
  professionalPracticeDossierSchema,
  advicePreferencesSchema,
  advisorAssessmentSchema,
  needExpertiseEvidenceSchema,
  distributionReviewInputSchema,
  distributionReviewDossierSchema,
  solutionClausesInputSchema,
  solutionClausesDossierSchema,
  solutionBindingInputSchema,
  solutionBindingQuerySchema,
  solutionBindingDossierSchema,
  solutionEvidenceVersionQuerySchema,
  solutionEvidenceSchema,
  boundSolutionEvidenceSchema,
  capacityAdvisorAssessmentSchema,
  referentAssessmentSchema,
  sharedReferentAssessmentSchema,
  capacityInputSchema,
  capacityDossierSchema,
  sharedModesInputSchema,
  sharedModesDossierSchema,
  advicePreferencesInputSchema,
  appointmentAssessmentSchema,
  appointmentTimeInputSchema,
  personalAppointmentProposalSchema,
  personalAppointmentPreviewSchema,
  personalAppointmentConfirmSchema,
} from "@coverview/contracts/partner";
import { insuranceRequestIdSchema } from "@coverview/contracts/insurance-requests";
import { isLoopback, type Environment } from "../../platform/config.js";
import { createMailer } from "../../platform/mailer.js";
import { createDatabase } from "../../platform/db/database.js";
import type { registerIdentity } from "../identity/index.js";
import { createPartnerRepository } from "./partner.repository.js";
import { PartnerError, type PartnerActor } from "./partner.policy.js";
import { registerQualityRoutes } from "./partner.quality.routes.js";
import { registerConclusionRoutes } from "./partner.conclusion.routes.js";
import { registerNavigationRoutes } from "./partner.navigation.routes.js";
import { registerRelationshipRoutes } from "./partner.relationships.routes.js";
import { registerMatchingRoutes } from "./partner.matching.routes.js";
import { registerProfileRoutes } from "./partner.profiles.routes.js";
import { registerAccessRoutes } from "./partner.access.routes.js";
import { registerCommunicationRoutes } from "./partner.communications.routes.js";
import { registerPilotageRoutes } from "./partner.pilotage.routes.js";
import { startPartnerJobs } from "./partner.jobs.js";
import { registerInvitationRoutes } from "./partner.invitations.routes.js";
import {
  adminOverviewQuerySchema,
  adminOverviewSchema,
} from "@coverview/contracts/partner-overview";
import { registerRecommendationRoutes } from "./partner.recommendations.routes.js";
import { registerJointAppointmentRoutes } from "./partner.joint-appointments.routes.js";
import { clientInvitationMessage } from "./partner.invitation-template.js";
import { createLiveHub } from "./partner.live.js";
import { createDataRightsOperations } from "./partner.data-rights.js";
import { registerDataRightsRoutes } from "./partner.data-rights.routes.js";
import { createDataRequestOperations } from "./partner.data-requests.js";
import { createDataErasureOperations } from "./partner.data-erasure.js";
export { PartnerError } from "./partner.policy.js";

export function registerPartnerWorkspace(
  server: FastifyInstance,
  config: Environment,
  identity: Awaited<ReturnType<typeof registerIdentity>>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>(),
    database = createDatabase(config),
    mailer = createMailer(config),
    repository = createPartnerRepository(
      database.pool,
      config.DOCUMENTS_ENABLED,
      mailer ? "configured" : "unconfigured",
    );
  database.pool.on("error", () =>
    app.log.warn({ dependency: "partner_database" }, "Partner database unavailable"),
  );
  let stopJobs: (() => Promise<void>) | undefined;
  const live = createLiveHub(database.pool, app.log);
  app.addHook("onReady", async () => {
    if (config.AUTH_ENABLED) await live.start();
    if (config.AUTH_ENABLED && config.PARTNER_JOBS_ENABLED)
      stopJobs = await startPartnerJobs(config.REDIS_URL, database.pool, app.log, {
        mailer,
        walletOrigin: config.AUTH_WALLET_ORIGIN,
      });
  });
  // Streams never finish on their own: they close before the server waits for open requests.
  app.addHook("preClose", async () => {
    await live.stop();
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
  // Live invalidation streams (C6a). Only the surface's own app may open one; the session is
  // re-checked every minute without a new administration audit entry.
  for (const surface of ["partner", "wallet"] as const)
    app.get(
      `/${surface}/live`,
      { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
      async (request, reply) => {
        const wallet = surface === "wallet",
          origin = wallet ? config.AUTH_WALLET_ORIGIN : config.AUTH_PARTNER_ORIGIN;
        if (!origin || request.headers.origin !== origin)
          throw new PartnerError("PARTNER_ACCESS_DENIED", 403);
        const current = await actor(request, wallet);
        return live.open(reply, current, async () => {
          const session = current.administrator
            ? await identity.authenticateAdministrator(request)
            : await identity.authenticate(request);
          return session.id === current.id && session.userId === current.userId;
        });
      },
    );
  const economyPage = z.object({ cursor: z.string().max(400).optional() }).strict();
  registerQualityRoutes(server, repository, actor);
  registerConclusionRoutes(server, repository, actor);
  registerNavigationRoutes(server, repository, actor);
  registerRelationshipRoutes(server, repository, actor);
  registerMatchingRoutes(server, repository, actor);
  registerProfileRoutes(server, repository, actor);
  registerAccessRoutes(server, repository, actor);
  registerInvitationRoutes(server, repository, actor);
  registerRecommendationRoutes(server, repository, actor);
  registerJointAppointmentRoutes(server, repository, actor);
  registerDataRightsRoutes(
    server,
    createDataRightsOperations(database.pool, repository),
    createDataRequestOperations(database.pool),
    createDataErasureOperations(database.pool),
    actor,
  );
  if (mailer) {
    // MAIL-03 preview, local adapters only, with fictitious variables. Same loopback guard as the
    // local personas route: binding alone does not stop DNS rebinding or a proxy.
    app.get(
      "/local/emails/client-invitation",
      {
        schema: { querystring: z.object({ format: z.enum(["html", "text"]).default("html") }) },
        onRequest: async (request, reply) => {
          if (!isLoopback(request.ip) || !isLoopback(request.hostname))
            return reply.code(404).send();
        },
      },
      async (request, reply) => {
        const message = clientInvitationMessage({
          locale: "fr",
          requester: "Camille Exemple (Cabinet Exemple SA)",
          category: "health",
          link: `${config.AUTH_WALLET_ORIGIN}/activation#token=exemple`,
          expiresAt: new Date(Date.now() + 14 * 86_400_000),
        });
        return request.query.format === "text"
          ? reply.type("text/plain; charset=utf-8").send(message.text)
          : reply.type("text/html; charset=utf-8").send(message.html);
      },
    );
  }
  registerCommunicationRoutes(server, repository, actor);
  registerPilotageRoutes(server, repository, actor);
  app.get(
    "/partner/economy/agreements",
    {
      config: limited,
      schema: { querystring: economyPage, response: { 200: economyAgreementsSchema } },
    },
    async (r) => repository.economyAgreements(await actor(r), r.query.cursor),
  );
  app.get(
    "/partner/economy/cases",
    {
      config: limited,
      schema: { querystring: economyPage, response: { 200: economyCasesSchema } },
    },
    async (r) => repository.economyCases(await actor(r), r.query.cursor),
  );
  app.get(
    "/partner/economy/cases/:id",
    {
      config: limited,
      schema: { params, querystring: economyPage, response: { 200: economyCaseSchema } },
    },
    async (r) => repository.economyCase(await actor(r), r.params.id, r.query.cursor),
  );
  app.post(
    "/partner/economy/cases",
    {
      config: limited,
      schema: { body: economyCaseInputSchema, response: { 200: economyCaseSchema } },
    },
    async (r) => repository.createEconomyCase(await actor(r), r.body, key(r)),
  );
  app.post(
    "/partner/economy/cases/:id/entries",
    {
      config: limited,
      schema: { params, body: economyRecordSchema, response: { 200: economyCaseSchema } },
    },
    async (r) => repository.recordEconomy(await actor(r), r.params.id, r.body, key(r)),
  );
  app.get(
    "/partner/commercial-conditions",
    {
      config: limited,
      schema: { querystring: economyPage, response: { 200: commercialListSchema } },
    },
    async (r) => repository.commercialConditions(await actor(r), r.query.cursor),
  );
  app.post(
    "/partner/commercial-conditions",
    {
      config: limited,
      schema: { body: commercialInputSchema, response: { 200: commercialConditionSchema } },
    },
    async (r) => repository.createCommercialCondition(await actor(r), r.body, key(r)),
  );
  app.post(
    "/partner/commercial-conditions/:id/reviews",
    {
      config: limited,
      schema: {
        params,
        body: commercialReviewSchema,
        response: { 200: commercialConditionSchema },
      },
    },
    async (r) => repository.reviewCommercialCondition(await actor(r), r.params.id, r.body, key(r)),
  );
  app.get(
    "/partner/marketplace",
    {
      config: limited,
      schema: { querystring: marketQuerySchema, response: { 200: marketListSchema } },
    },
    async (r) => repository.marketplace(await actor(r), r.query),
  );
  app.get(
    "/partner/marketplace/:id",
    {
      config: limited,
      schema: { params, querystring: economyPage, response: { 200: marketDetailSchema } },
    },
    async (r) => repository.marketDetail(await actor(r), r.params.id, r.query.cursor),
  );
  app.post(
    "/partner/leads/:id/marketplace",
    {
      config: limited,
      schema: { params, body: marketPublicationSchema, response: { 200: marketDetailSchema } },
    },
    async (r) => repository.publishMarket(await actor(r), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/marketplace/:id/applications",
    {
      config: limited,
      schema: { params, body: marketApplicationInputSchema, response: { 200: marketDetailSchema } },
    },
    async (r) => repository.applyMarket(await actor(r), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/marketplace/:id/applications/withdraw",
    {
      config: limited,
      schema: { params, body: z.object({}).strict(), response: { 200: marketDetailSchema } },
    },
    async (r) => repository.withdrawMarketApplication(await actor(r), r.params.id, key(r)),
  );
  app.post(
    "/partner/marketplace/:id/reservations",
    {
      config: limited,
      schema: { params, body: marketReservationInputSchema, response: { 200: marketDetailSchema } },
    },
    async (r) => repository.reserveMarket(await actor(r), r.params.id, r.body, key(r)),
  );
  app.post(
    "/partner/marketplace/:id/withdraw",
    {
      config: limited,
      schema: {
        params,
        body: z.object({ reason: z.string().trim().min(10).max(2000) }).strict(),
        response: { 200: marketDetailSchema },
      },
    },
    async (r) => repository.withdrawMarket(await actor(r), r.params.id, r.body.reason, key(r)),
  );
  app.post(
    "/partner/market-reservations/:id/decision",
    {
      config: limited,
      schema: { params, body: marketDecisionSchema, response: { 200: marketReservationSchema } },
    },
    async (r) => repository.decideMarket(await actor(r), r.params.id, r.body, key(r)),
  );
  app.get(
    "/wallet/leads/:id/market-mandates",
    {
      config: limited,
      schema: { params, querystring: economyPage, response: { 200: marketMandatesSchema } },
    },
    async (r) => repository.marketMandates(await actor(r, true), r.params.id, r.query.cursor),
  );
  app.post(
    "/wallet/market-reservations/:id/mandate",
    {
      config: limited,
      schema: {
        params,
        body: marketMandateInputSchema,
        response: { 200: marketReservationSchema },
      },
    },
    async (r) => repository.decideMarketMandate(await actor(r, true), r.params.id, r.body, key(r)),
  );
  app.get(
    "/partner/leads/:id/counsel",
    {
      config: limited,
      schema: { params, querystring: counselQuerySchema, response: { 200: counselPersonalSchema } },
    },
    async (r) => repository.counselPersonal(await actor(r), r.params.id, r.query.cursor),
  );
  app.post(
    "/partner/leads/:id/counsel",
    {
      config: limited,
      schema: { params, body: counselRequestInputSchema, response: { 200: counselRequestSchema } },
    },
    async (r) => repository.requestCounsel(await actor(r), r.params.id, r.body, key(r)),
  );
  app.get(
    "/partner/counsel/:id",
    { config: limited, schema: { params, response: { 200: counselRequestSchema } } },
    async (r) => repository.counselRequest(await actor(r), r.params.id),
  );
  app.post(
    "/partner/counsel/:id/actions",
    {
      config: limited,
      schema: { params, body: counselActionInputSchema, response: { 200: counselRequestSchema } },
    },
    async (r) => repository.actCounsel(await actor(r), r.params.id, r.body, key(r)),
  );
  app.get(
    "/admin/partner/counsel",
    {
      config: limited,
      schema: { querystring: counselQuerySchema, response: { 200: counselQueueSchema } },
    },
    async (r) => repository.counselQueue(await actor(r, false, true), r.query.cursor),
  );
  app.get(
    "/admin/partner/counsel/:id/candidates",
    {
      config: limited,
      schema: {
        params,
        querystring: counselQuerySchema,
        response: { 200: counselCandidatesSchema },
      },
    },
    async (r) =>
      repository.counselCandidates(await actor(r, false, true), r.params.id, r.query.cursor),
  );
  app.get(
    "/partner/leads/:id/capacity-decision",
    {
      config: limited,
      schema: {
        params,
        querystring: referentQuerySchema,
        response: { 200: needCapacityDossierSchema },
      },
    },
    async (request) =>
      repository.needCapacity(
        await actor(request),
        request.params.id,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/leads/:id/capacity-decision",
    {
      config: limited,
      schema: {
        params,
        body: needCapacityInputSchema,
        response: { 200: needCapacityDossierSchema },
      },
    },
    async (request) =>
      repository.decideNeedCapacity(
        await actor(request),
        request.params.id,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/leads/:id/expertise-review",
    {
      config: limited,
      schema: {
        params,
        querystring: referentQuerySchema,
        response: { 200: needExpertiseDossierSchema },
      },
    },
    async (request) =>
      repository.needExpertise(
        await actor(request),
        request.params.id,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/leads/:id/expertise-review",
    {
      config: limited,
      schema: {
        params,
        body: needExpertiseInputSchema,
        response: { 200: needExpertiseDossierSchema },
      },
    },
    async (request) =>
      repository.decideNeedExpertise(
        await actor(request),
        request.params.id,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/leads/:id/conflict-review",
    {
      config: limited,
      schema: {
        params,
        querystring: referentQuerySchema,
        response: { 200: needConflictDossierSchema },
      },
    },
    async (request) =>
      repository.needConflict(
        await actor(request),
        request.params.id,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/leads/:id/conflict-review",
    {
      config: limited,
      schema: {
        params,
        body: needConflictInputSchema,
        response: { 200: needConflictDossierSchema },
      },
    },
    async (request) =>
      repository.decideNeedConflict(
        await actor(request),
        request.params.id,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/leads/:id/offers/:offerId/distribution-review/:companyId",
    {
      config: limited,
      schema: {
        params: params
          .extend({ offerId: z.string().min(1).max(100), companyId: insuranceCompanyIdSchema })
          .strict(),
        querystring: conventionQuerySchema,
        response: { 200: distributionReviewDossierSchema },
      },
    },
    async (request) =>
      repository.distributionReview(
        await actor(request),
        request.params.id,
        request.params.offerId,
        request.params.companyId,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/leads/:id/offers/:offerId/distribution-review/:companyId",
    {
      config: limited,
      schema: {
        params: params
          .extend({ offerId: z.string().min(1).max(100), companyId: insuranceCompanyIdSchema })
          .strict(),
        body: distributionReviewInputSchema,
        response: { 200: distributionReviewDossierSchema },
      },
    },
    async (request) =>
      repository.recordDistributionReview(
        await actor(request),
        request.params.id,
        request.params.offerId,
        request.params.companyId,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/leads/:id/offers/:offerId/solution-clauses/:companyId",
    {
      config: limited,
      schema: {
        params: params
          .extend({ offerId: z.string().min(1).max(100), companyId: insuranceCompanyIdSchema })
          .strict(),
        querystring: conventionQuerySchema,
        response: { 200: solutionClausesDossierSchema },
      },
    },
    async (request) =>
      repository.solutionClauses(
        await actor(request),
        request.params.id,
        request.params.offerId,
        request.params.companyId,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/leads/:id/offers/:offerId/solution-clauses/:companyId",
    {
      config: limited,
      schema: {
        params: params
          .extend({ offerId: z.string().min(1).max(100), companyId: insuranceCompanyIdSchema })
          .strict(),
        body: solutionClausesInputSchema,
        response: { 200: solutionClausesDossierSchema },
      },
    },
    async (request) =>
      repository.recordSolutionClauses(
        await actor(request),
        request.params.id,
        request.params.offerId,
        request.params.companyId,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/leads/:id/offers/:offerId/solution-binding",
    {
      config: limited,
      schema: {
        params: params.extend({ offerId: z.string().min(1).max(100) }).strict(),
        querystring: solutionBindingQuerySchema,
        response: { 200: solutionBindingDossierSchema },
      },
    },
    async (request) =>
      repository.solutionBinding(
        await actor(request),
        request.params.id,
        request.params.offerId,
        request.query.beforeRevision,
        request.query.sourcePage,
      ),
  );
  app.post(
    "/partner/leads/:id/offers/:offerId/solution-binding",
    {
      config: limited,
      schema: {
        params: params.extend({ offerId: z.string().min(1).max(100) }).strict(),
        body: solutionBindingInputSchema,
        response: { 200: solutionBindingDossierSchema },
      },
    },
    async (request) =>
      repository.recordSolutionBinding(
        await actor(request),
        request.params.id,
        request.params.offerId,
        request.body,
        key(request),
      ),
  );
  const insuranceParams = z.object({ id: insuranceRequestIdSchema }).strict();
  app.get(
    "/partner/leads/:id/offers/:offerId/solution-evidence",
    {
      config: limited,
      schema: {
        params: params.extend({ offerId: z.string().min(1).max(100) }).strict(),
        querystring: solutionEvidenceVersionQuerySchema,
        response: { 200: z.union([boundSolutionEvidenceSchema, solutionEvidenceSchema]) },
      },
    },
    async (request) =>
      repository[request.query.version === "2" ? "boundSolutionEvidence" : "solutionEvidence"](
        await actor(request),
        request.params.id,
        request.params.offerId,
        request.query.companyId ? { companyId: request.query.companyId } : {},
      ),
  );
  app.get(
    "/partner/leads/:id/expertise-evidence",
    {
      config: limited,
      schema: {
        params,
        querystring: z.object({}).strict(),
        response: { 200: needExpertiseEvidenceSchema },
      },
    },
    async (request) => repository.needExpertiseEvidence(await actor(request), request.params.id),
  );
  app.get(
    "/partner/leads/:id/advisor-assessment",
    {
      config: limited,
      schema: {
        params,
        querystring: z.object({ version: z.enum(["1", "2"]).optional() }).strict(),
        response: { 200: z.union([capacityAdvisorAssessmentSchema, advisorAssessmentSchema]) },
      },
    },
    async (request) =>
      repository.advisorAssessment(
        await actor(request),
        request.params.id,
        request.query.version === "2",
      ),
  );
  for (const wallet of [false, true]) {
    app.get(
      `/${wallet ? "wallet" : "partner"}/leads/:id/shared-appointments`,
      {
        config: limited,
        schema: { params, response: { 200: sharedAppointmentsSchema } },
      },
      async (request) =>
        repository.sharedAppointments(await actor(request, wallet), request.params.id),
    );
  }
  const linkParams = params.extend({ appointmentId: z.string().min(1).max(100) });
  const bookingParams = params.extend({ proposalId: z.string().min(1).max(100) });
  app.post(
    "/wallet/coordinated-bookings",
    {
      config: limited,
      schema: {
        body: coordinatedBookingInputSchema,
        response: { 200: coordinatedBookingReceiptSchema },
      },
    },
    async (request) =>
      repository.reserveCoordinatedBookings(await actor(request, true), request.body, key(request)),
  );
  for (const wallet of [false, true])
    app.get(
      `/${wallet ? "wallet" : "partner"}/leads/:id/booking-proposals`,
      {
        config: limited,
        schema: { params, response: { 200: bookingProposalsSchema } },
      },
      async (request) =>
        repository.bookingProposals(await actor(request, wallet), request.params.id),
    );
  app.post(
    "/partner/leads/:id/booking-proposals",
    {
      config: limited,
      schema: {
        params,
        body: bookingProposalInputSchema,
        response: { 200: bookingProposalsSchema },
      },
    },
    async (request) =>
      repository.proposeBooking(
        await actor(request),
        request.params.id,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/leads/:id/booking-proposals/:proposalId/withdraw",
    {
      config: limited,
      schema: {
        params: bookingParams,
        body: bookingWithdrawalSchema,
        response: { 200: bookingProposalsSchema },
      },
    },
    async (request) =>
      repository.withdrawBooking(
        await actor(request),
        request.params.id,
        request.params.proposalId,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/wallet/leads/:id/booking-proposals/:proposalId/reserve",
    {
      config: limited,
      schema: {
        params: bookingParams,
        body: bookingChoiceSchema,
        response: { 200: bookingProposalsSchema },
      },
    },
    async (request) =>
      repository.reserveBooking(
        await actor(request, true),
        request.params.id,
        request.params.proposalId,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/wallet/leads/:id/appointments/:appointmentId/cancellation",
    {
      config: limited,
      schema: { params: linkParams, response: { 200: walletAppointmentSchema } },
    },
    async (request) =>
      repository.walletAppointment(
        await actor(request, true),
        request.params.id,
        request.params.appointmentId,
      ),
  );
  app.post(
    "/wallet/leads/:id/appointments/:appointmentId/cancellation",
    {
      config: limited,
      schema: {
        params: linkParams,
        body: walletAppointmentCancellationSchema,
        response: { 200: walletAppointmentSchema },
      },
    },
    async (request) =>
      repository.cancelWalletAppointment(
        await actor(request, true),
        request.params.id,
        request.params.appointmentId,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/leads/:id/appointments/:appointmentId/links",
    {
      config: limited,
      schema: { params: linkParams, response: { 200: appointmentLinksManagementSchema } },
    },
    async (request) =>
      repository.appointmentLinks(
        await actor(request),
        request.params.id,
        request.params.appointmentId,
      ),
  );
  app.post(
    "/partner/leads/:id/appointments/:appointmentId/links/preview",
    {
      config: limited,
      schema: {
        params: linkParams,
        body: appointmentLinksSelectionSchema,
        response: { 200: appointmentLinksPreviewSchema },
      },
    },
    async (request) =>
      repository.previewAppointmentLinks(
        await actor(request),
        request.params.id,
        request.params.appointmentId,
        request.body,
      ),
  );
  app.post(
    "/partner/leads/:id/appointments/:appointmentId/links/confirm",
    {
      config: limited,
      schema: {
        params: linkParams,
        body: appointmentLinksConfirmSchema,
        response: { 200: appointmentLinksManagementSchema },
      },
    },
    async (request) =>
      repository.confirmAppointmentLinks(
        await actor(request),
        request.params.id,
        request.params.appointmentId,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/leads/:id/appointments/:appointmentId/links/unlink",
    {
      config: limited,
      schema: {
        params: linkParams,
        body: appointmentUnlinkSchema,
        response: { 200: appointmentLinksManagementSchema },
      },
    },
    async (request) =>
      repository.unlinkAppointment(
        await actor(request),
        request.params.id,
        request.params.appointmentId,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/leads/:id/appointments/:appointmentId/rescheduling/preview",
    {
      config: limited,
      schema: {
        params: params.extend({ appointmentId: z.string().min(1).max(100) }),
        body: personalAppointmentProposalSchema,
        response: { 200: personalAppointmentPreviewSchema },
      },
    },
    async (request) =>
      repository.previewPersonalRescheduling(
        await actor(request),
        request.params.id,
        request.params.appointmentId,
        request.body,
      ),
  );
  app.post(
    "/partner/leads/:id/appointments/:appointmentId/rescheduling/confirm",
    {
      config: limited,
      schema: {
        params: params.extend({ appointmentId: z.string().min(1).max(100) }),
        body: personalAppointmentConfirmSchema,
        response: { 200: leadDetailSchema },
      },
    },
    async (request) =>
      repository.confirmPersonalRescheduling(
        await actor(request),
        request.params.id,
        request.params.appointmentId,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/leads/:id/personal-appointments/preview",
    {
      config: limited,
      schema: {
        params,
        body: personalAppointmentProposalSchema,
        response: { 200: personalAppointmentPreviewSchema },
      },
    },
    async (request) =>
      repository.previewPersonalAppointment(await actor(request), request.params.id, request.body),
  );
  app.post(
    "/partner/leads/:id/personal-appointments/confirm",
    {
      config: limited,
      schema: {
        params,
        body: personalAppointmentConfirmSchema,
        response: { 200: leadDetailSchema },
      },
    },
    async (request) =>
      repository.confirmPersonalAppointment(
        await actor(request),
        request.params.id,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/leads/:id/appointments/:appointmentId/time-protection",
    {
      config: limited,
      schema: {
        params: params.extend({ appointmentId: z.string().min(1).max(100) }),
        body: appointmentTimeInputSchema,
        response: { 200: appointmentAssessmentSchema },
      },
    },
    async (request) =>
      repository.protectAppointmentTime(
        await actor(request),
        request.params.id,
        request.params.appointmentId,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/leads/:id/appointments/:appointmentId/assessment",
    {
      config: limited,
      schema: {
        params: params.extend({ appointmentId: z.string().min(1).max(100) }),
        response: { 200: appointmentAssessmentSchema },
      },
    },
    async (request) =>
      repository.appointmentAssessment(
        await actor(request),
        request.params.id,
        request.params.appointmentId,
      ),
  );
  for (const wallet of [false, true]) {
    app.get(
      `/${wallet ? "wallet" : "partner"}/leads/:id/referent-assessment`,
      {
        config: limited,
        schema: {
          params,
          querystring: z.object({ version: z.enum(["1", "2"]).optional() }).strict(),
          response: { 200: z.union([sharedReferentAssessmentSchema, referentAssessmentSchema]) },
        },
      },
      async (request) =>
        repository.referentAssessment(
          await actor(request, wallet),
          request.params.id,
          request.query.version === "2",
        ),
    );
    app.get(
      `/${wallet ? "wallet" : "partner"}/leads/:id/advice-preferences`,
      {
        config: limited,
        schema: {
          params,
          querystring: referentQuerySchema,
          response: { 200: advicePreferencesSchema },
        },
      },
      async (request) =>
        repository.advicePreferences(
          await actor(request, wallet),
          request.params.id,
          request.query.beforeRevision,
        ),
    );
  }
  app.post(
    "/wallet/leads/:id/advice-preferences",
    {
      config: limited,
      schema: {
        params,
        body: advicePreferencesInputSchema,
        response: { 200: advicePreferencesSchema },
      },
    },
    async (request) =>
      repository.confirmAdvicePreferences(
        await actor(request, true),
        request.params.id,
        request.body,
        key(request),
      ),
  );
  const practiceParams = z.object({ userId: z.string().min(1).max(100) }).strict();
  app.get(
    "/partner/capacity/:userId",
    {
      config: limited,
      schema: {
        params: practiceParams,
        querystring: referentQuerySchema,
        response: { 200: capacityDossierSchema },
      },
    },
    async (request) =>
      repository.capacity(
        await actor(request),
        request.params.userId,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/capacity/:userId",
    {
      config: limited,
      schema: {
        params: practiceParams,
        body: capacityInputSchema,
        response: { 200: capacityDossierSchema },
      },
    },
    async (request) =>
      repository.declareCapacity(
        await actor(request),
        request.params.userId,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/shared-modes/:userId",
    {
      config: limited,
      schema: {
        params: practiceParams,
        querystring: referentQuerySchema,
        response: { 200: sharedModesDossierSchema },
      },
    },
    async (request) =>
      repository.sharedModes(
        await actor(request),
        request.params.userId,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/shared-modes/:userId",
    {
      config: limited,
      schema: {
        params: practiceParams,
        body: sharedModesInputSchema,
        response: { 200: sharedModesDossierSchema },
      },
    },
    async (request) =>
      repository.declareSharedModes(
        await actor(request),
        request.params.userId,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/practice/:userId",
    {
      config: limited,
      schema: {
        params: practiceParams,
        querystring: referentQuerySchema,
        response: { 200: professionalPracticeDossierSchema },
      },
    },
    async (request) =>
      repository.practice(
        await actor(request),
        request.params.userId,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/practice/:userId",
    {
      config: limited,
      schema: {
        params: practiceParams,
        body: professionalPracticeInputSchema,
        response: { 200: professionalPracticeDossierSchema },
      },
    },
    async (request) =>
      repository.declarePractice(
        await actor(request),
        request.params.userId,
        request.body,
        key(request),
      ),
  );
  app.get(
    "/partner/availability/:userId",
    {
      config: limited,
      schema: {
        params: practiceParams,
        querystring: referentQuerySchema,
        response: { 200: professionalAvailabilityDossierSchema },
      },
    },
    async (request) =>
      repository.availability(
        await actor(request),
        request.params.userId,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/availability/:userId",
    {
      config: limited,
      schema: {
        params: practiceParams,
        body: professionalAvailabilityInputSchema,
        response: { 200: professionalAvailabilityDossierSchema },
      },
    },
    async (request) =>
      repository.declareAvailability(
        await actor(request),
        request.params.userId,
        request.body,
        key(request),
      ),
  );
  const competenceParams = z
    .object({ userId: z.string().min(1).max(100), category: leadCategorySchema })
    .strict();
  app.get(
    "/partner/competence/:userId/:category",
    {
      config: limited,
      schema: {
        params: competenceParams,
        querystring: competenceQuerySchema,
        response: { 200: competenceDossierSchema },
      },
    },
    async (request) =>
      repository.competence(
        await actor(request),
        request.params.userId,
        request.params.category,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/competence/:userId/:category",
    {
      config: limited,
      schema: {
        params: competenceParams,
        body: competenceDeclarationSchema,
        response: { 200: competenceDossierSchema },
      },
    },
    async (request) =>
      repository.declareCompetence(
        await actor(request),
        request.params.userId,
        request.params.category,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/competence/:userId/:category/decisions",
    {
      config: limited,
      schema: {
        params: competenceParams,
        body: competenceDecisionSchema,
        response: { 200: competenceDossierSchema },
      },
    },
    async (request) =>
      repository.decideCompetence(
        await actor(request),
        request.params.userId,
        request.params.category,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/competence/:userId/:category/:id/retry",
    {
      config: limited,
      schema: {
        params: competenceParams.extend({ id: z.string().min(1).max(100) }),
        body: z.object({ revision: z.number().int().nonnegative() }).strict(),
        response: { 200: competenceDossierSchema },
      },
    },
    async (request) =>
      repository.retryCompetenceUpload(
        await actor(request),
        request.params.userId,
        request.params.category,
        request.params.id,
        request.body.revision,
        key(request),
      ),
  );
  const conventionParams = z
    .object({
      userId: z.string().min(1).max(100),
      category: leadCategorySchema,
      companyId: insuranceCompanyIdSchema,
    })
    .strict();
  app.get(
    "/partner/convention/:userId/:category/:companyId",
    {
      config: limited,
      schema: {
        params: conventionParams,
        querystring: conventionQuerySchema,
        response: { 200: conventionDossierSchema },
      },
    },
    async (request) =>
      repository.convention(
        await actor(request),
        request.params.userId,
        request.params.category,
        request.params.companyId,
        request.query.beforeRevision,
      ),
  );
  app.post(
    "/partner/convention/:userId/:category/:companyId",
    {
      config: limited,
      schema: {
        params: conventionParams,
        body: conventionDeclarationSchema,
        response: { 200: conventionDossierSchema },
      },
    },
    async (request) =>
      repository.declareConvention(
        await actor(request),
        request.params.userId,
        request.params.category,
        request.params.companyId,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/convention/:userId/:category/:companyId/decisions",
    {
      config: limited,
      schema: {
        params: conventionParams,
        body: conventionDecisionSchema,
        response: { 200: conventionDossierSchema },
      },
    },
    async (request) =>
      repository.decideConvention(
        await actor(request),
        request.params.userId,
        request.params.category,
        request.params.companyId,
        request.body,
        key(request),
      ),
  );
  app.post(
    "/partner/convention/:userId/:category/:companyId/:id/retry",
    {
      config: limited,
      schema: {
        params: conventionParams.extend({ id: z.string().min(1).max(100) }),
        body: z.object({ revision: z.number().int().nonnegative() }).strict(),
        response: { 200: conventionDossierSchema },
      },
    },
    async (request) =>
      repository.retryConventionUpload(
        await actor(request),
        request.params.userId,
        request.params.category,
        request.params.companyId,
        request.params.id,
        request.body.revision,
        key(request),
      ),
  );
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
    "/admin/partner/overview",
    {
      config: limited,
      schema: { querystring: adminOverviewQuerySchema, response: { 200: adminOverviewSchema } },
    },
    async (request) => repository.adminOverview(await actor(request, false, true), request.query),
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
    async authorizeCompetenceSource(
      request: FastifyRequest,
      userId: string,
      category: string,
      id: string,
      write: boolean,
      record = false,
    ) {
      return repository.competenceSource(await actor(request), userId, category, id, write, record);
    },
    async completeCompetenceUpload(
      request: FastifyRequest,
      userId: string,
      category: string,
      id: string,
      mime: string,
    ) {
      return repository.completeCompetenceUpload(await actor(request), userId, category, id, mime);
    },
    async authorizeConventionSource(
      request: FastifyRequest,
      userId: string,
      category: string,
      companyId: string,
      id: string,
      write: boolean,
      record = false,
    ) {
      return repository.conventionSource(
        await actor(request),
        userId,
        category,
        companyId,
        id,
        write,
        record,
      );
    },
    async completeConventionUpload(
      request: FastifyRequest,
      userId: string,
      category: string,
      companyId: string,
      id: string,
      mime: string,
    ) {
      return repository.completeConventionUpload(
        await actor(request),
        userId,
        category,
        companyId,
        id,
        mime,
      );
    },
    async authorizeFinalPolicySource(
      request: FastifyRequest,
      leadId: string,
      policyId: string,
      wallet: boolean,
    ) {
      return repository.finalPolicySource(await actor(request, wallet), leadId, policyId);
    },
    async conclusionCorrespondenceSource(
      request: FastifyRequest,
      leadId: string,
      sourceId: string,
      wallet: boolean,
      record = false,
    ) {
      return repository.conclusionCorrespondenceSource(
        await actor(request, wallet),
        leadId,
        sourceId,
        record,
      );
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
