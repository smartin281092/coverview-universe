import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  healthCompareInputSchema,
  healthComparisonSchema,
  healthStatusSchema,
  healthLocalitiesSchema,
  healthModelDetailsSchema,
  healthGuideInputSchema,
  healthGuideResultSchema,
  healthLocateInputSchema,
  healthLocationSuggestionSchema,
  healthCurrentOptionsInputSchema,
  healthCurrentOptionsSchema,
  healthCurrentComparisonInputSchema,
  healthCurrentComparisonSchema,
} from "@coverview/contracts/health-insurance";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { createHealthRepository } from "./health.repository.js";
import type { registerIdentity } from "../identity/index.js";
import { registerRecommendations } from "./recommendation.routes.js";
import { createHealthCurrentRepository } from "./health.current.js";

export function registerHealthInsurance(
  server: FastifyInstance,
  config: Environment,
  identity: Awaited<ReturnType<typeof registerIdentity>>,
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const database = createDatabase(config);
  database.pool.on("error", () =>
    app.log.warn({ dependency: "health_database" }, "Health catalogue unavailable"),
  );
  app.addHook("onClose", () => database.pool.end());
  const repository = createHealthRepository(database.pool);
  const current = createHealthCurrentRepository(database.pool);
  registerRecommendations(server, database, identity);
  const limited = { rateLimit: { max: 90, timeWindow: "1 minute" } };
  app.post(
    "/health-insurance/current/options",
    {
      config: limited,
      schema: {
        body: healthCurrentOptionsInputSchema,
        response: { 200: healthCurrentOptionsSchema },
      },
    },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      return current.options(request.body);
    },
  );
  app.post(
    "/health-insurance/current/compare",
    {
      config: limited,
      schema: {
        body: healthCurrentComparisonInputSchema,
        response: { 200: healthCurrentComparisonSchema },
      },
    },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      return current.compare(request.body);
    },
  );
  app.get(
    "/health-insurance/current/localities",
    {
      config: limited,
      schema: {
        querystring: z.object({ q: z.string().trim().min(2).max(80) }).strict(),
        response: { 200: healthLocalitiesSchema },
      },
    },
    async (request) => current.localities(request.query.q),
  );
  app.get(
    "/health-insurance/status",
    { config: limited, schema: { response: { 200: healthStatusSchema } } },
    async (_, reply) => {
      reply.header("cache-control", "public, max-age=300");
      return repository.status();
    },
  );
  app.get(
    "/health-insurance/localities",
    {
      config: limited,
      schema: {
        querystring: z.object({ q: z.string().trim().min(2).max(80) }).strict(),
        response: { 200: healthLocalitiesSchema },
      },
    },
    async (request) => repository.localities(request.query.q),
  );
  app.post(
    "/health-insurance/compare",
    {
      config: limited,
      schema: { body: healthCompareInputSchema, response: { 200: healthComparisonSchema } },
    },
    async (request) => repository.compare(request.body),
  );
  app.get(
    "/health-insurance/models/:id",
    {
      config: limited,
      schema: {
        params: z.object({ id: z.string().regex(/^hm_[a-f0-9]{28}$/) }),
        response: { 200: healthModelDetailsSchema },
      },
    },
    async (request) => repository.details(request.params.id),
  );
  app.post(
    "/health-insurance/locate",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: { body: healthLocateInputSchema, response: { 200: healthLocationSuggestionSchema } },
    },
    async (request, reply) => {
      reply.header("cache-control", "no-store");
      return repository.locate(request.body);
    },
  );
  // Read-only, anonymous calculation. No cookies, personal persistence, body logging or third-party transmission.
  app.post(
    "/health-insurance/guide",
    {
      config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: { body: healthGuideInputSchema, response: { 200: healthGuideResultSchema } },
    },
    async (request) => repository.guide(request.body),
  );
}
export { createHealthRepository } from "./health.repository.js";
export { RecommendationError, isCatalogModel } from "./recommendation.repository.js";
