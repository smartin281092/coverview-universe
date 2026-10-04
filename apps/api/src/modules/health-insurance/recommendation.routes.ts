import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  recommendationInputSchema,
  recommendationResultSchema,
  recommendationAdminStateSchema,
  recommendationPublishSchema,
  operatorCaseUpdateSchema,
  operatorCaseSchema,
  evidenceCatalogSchema,
  recommendationRulesSchema,
  recommendationCatalogPublishSchema,
} from "@coverview/contracts/health-recommendation";
import type { createDatabase } from "../../platform/db/database.js";
import type { registerIdentity } from "../identity/index.js";
import { createRecommendationRepository } from "./recommendation.repository.js";
export function registerRecommendations(
  server: FastifyInstance,
  database: ReturnType<typeof createDatabase>,
  identity: Awaited<ReturnType<typeof registerIdentity>>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const repository = createRecommendationRepository(database);
  const limited = { rateLimit: { max: 90, timeWindow: "1 minute" } };
  const yearQuery = z
    .object({ year: z.coerce.number().int().min(2027).max(2100).default(2027) })
    .strict();
  app.post(
    "/health-insurance/recommend",
    {
      bodyLimit: 131072,
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: { body: recommendationInputSchema, response: { 200: recommendationResultSchema } },
    },
    async (request) => repository.run(request.body),
  );
  app.get(
    "/health-insurance/recommendation-catalog",
    {
      config: limited,
      schema: { querystring: yearQuery, response: { 200: evidenceCatalogSchema.nullable() } },
    },
    async (request) => {
      const { catalog } = await repository.state(request.query.year);
      // Operator assignment/history never belong to the public projection.
      return catalog
        ? {
            ...catalog,
            publication: null,
            cases: catalog.cases.map((record) => ({ ...record, owner: null, history: [] })),
          }
        : null;
    },
  );
  app.get(
    "/admin/health-recommendation",
    {
      config: limited,
      schema: { querystring: yearQuery, response: { 200: recommendationAdminStateSchema } },
    },
    async (request) => {
      await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(request, null, "health-recommendation", "read");
      return repository.state(request.query.year);
    },
  );
  app.post(
    "/admin/health-recommendation/simulate",
    {
      bodyLimit: 131072,
      config: limited,
      schema: {
        body: z
          .object({ profile: recommendationInputSchema, config: recommendationRulesSchema })
          .strict(),
        response: { 200: recommendationResultSchema },
      },
    },
    async (request) => {
      await identity.checkMutation(request);
      await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(request, null, "health-recommendation", "simulate");
      return repository.run(request.body.profile, request.body.config);
    },
  );
  app.post(
    "/admin/health-recommendation/publish",
    {
      config: limited,
      schema: {
        body: recommendationPublishSchema,
        response: { 200: z.object({ id: z.string(), revision: z.number().int() }) },
      },
    },
    async (request) => {
      await identity.checkMutation(request);
      const actor = await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(request, null, "health-recommendation", "publish");
      return repository.publish(request.body, actor, String(request.headers["idempotency-key"]));
    },
  );
  app.post(
    "/admin/health-recommendation/catalog",
    {
      bodyLimit: 5_000_000,
      config: limited,
      schema: {
        body: recommendationCatalogPublishSchema,
        response: { 200: z.object({ id: z.string() }) },
      },
    },
    async (request) => {
      await identity.checkMutation(request);
      const actor = await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(
        request,
        null,
        "health-recommendation",
        "catalog-publish",
      );
      return repository.publishCatalog(
        request.body,
        actor,
        String(request.headers["idempotency-key"]),
      );
    },
  );
  app.get(
    "/admin/health-recommendation/catalog/:id",
    {
      config: limited,
      schema: {
        params: z.object({ id: z.string().max(100) }),
        response: { 200: evidenceCatalogSchema },
      },
    },
    async (request) => {
      await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(
        request,
        null,
        "health-recommendation",
        "catalog-history",
      );
      return repository.catalogVersion(request.params.id);
    },
  );
  app.post(
    "/admin/health-recommendation/reviews/:catalogId/:id",
    {
      config: limited,
      schema: {
        params: z.object({ catalogId: z.string().max(100), id: z.string().max(100) }),
        body: operatorCaseUpdateSchema,
        response: { 200: operatorCaseSchema },
      },
    },
    async (request) => {
      await identity.checkMutation(request);
      const actor = await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(
        request,
        null,
        `health-review:${request.params.id}`,
        "update",
      );
      return repository.review(
        request.params.catalogId,
        request.params.id,
        request.body,
        actor,
        String(request.headers["idempotency-key"]),
      );
    },
  );
}
