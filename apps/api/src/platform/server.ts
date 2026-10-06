import { registerPartnerWorkspace, PartnerError } from "../modules/partner-workspace/index.js";
import { randomUUID } from "node:crypto";
import {
  registerInsuranceRequests,
  InsuranceRequestError,
} from "../modules/insurance-requests/index.js";
import { registerHealthInsurance, RecommendationError } from "../modules/health-insurance/index.js";
import {
  apiErrorSchema,
  livenessSchema,
  localPersonasSchema,
  readinessSchema,
} from "@coverview/contracts";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { isLoopback, type Environment } from "./config.js";
import { createPlatformDependencies, type PlatformDependencies } from "./dependencies.js";
import { registerDocuments, DocumentError } from "../modules/document-intelligence/index.js";
import { registerManagedProfiles, ManagedProfileError } from "../modules/profiles/index.js";
import { registerAdminProfileTransfers } from "./admin-profile-transfer.routes.js";
import { ProfileTransferError } from "./admin-profile-transfer.repository.js";
import {
  registerClientActivities,
  ClientActivityError,
} from "../modules/client-activities/index.js";
import { registerAuthorizations } from "../modules/authorizations/index.js";
import {
  IdentityError,
  registerIdentity,
  type IdentityService,
} from "../modules/identity/index.js";

export async function buildServer(
  config: Environment,
  dependencies?: PlatformDependencies,
  identityService?: IdentityService,
) {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      redact: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
      serializers: {
        req(request: { method: string; url: string }) {
          return { method: request.method, path: request.url.split("?")[0] ?? "/" };
        },
        err(error: { name?: string; code?: string }) {
          return {
            type: error.name ?? "Error",
            code: error.code,
            message: "Error details redacted",
            stack: "",
          };
        },
      },
    },
    requestIdHeader: false,
    genReqId: (request) => {
      const supplied = request.headers["x-request-id"];
      return typeof supplied === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(supplied)
        ? supplied
        : randomUUID();
    },
    bodyLimit: 16384,
    requestTimeout: 10000,
    connectionTimeout: 10000,
    keepAliveTimeout: 5000,
    forceCloseConnections: "idle",
    // Only the configured nearest hops (the deployed reverse proxy) may state the client address.
    trustProxy: config.TRUST_PROXY_HOPS
      ? (_address: string, hop: number) => hop < config.TRUST_PROXY_HOPS
      : false,
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const platform =
    dependencies ??
    createPlatformDependencies(config, (dependency) => {
      app.log.warn({ dependency }, "Platform dependency unavailable");
    });
  app.addHook("onClose", async () => {
    await platform.close();
  });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    reply.header("cache-control", "no-store");
  });
  await app.register(helmet);
  await app.register(cors, {
    origin: config.CORS_ORIGINS,
    methods: ["GET", "POST"],
    allowedHeaders: ["Accept", "Content-Type", "X-Request-Id", "X-CSRF-Token", "Idempotency-Key"],
    exposedHeaders: ["X-Request-Id"],
    credentials: true,
    maxAge: 0,
  });

  app.setErrorHandler((error, request, reply) => {
    const isValidation = typeof error === "object" && error !== null && "validation" in error;
    const errorStatus =
      typeof error === "object" && error !== null && "statusCode" in error
        ? error.statusCode
        : undefined;
    const isClientError =
      typeof errorStatus === "number" &&
      Number.isInteger(errorStatus) &&
      errorStatus >= 400 &&
      errorStatus < 500;
    const status =
      error instanceof PartnerError ||
      error instanceof RecommendationError ||
      error instanceof InsuranceRequestError ||
      error instanceof IdentityError ||
      error instanceof DocumentError ||
      error instanceof ManagedProfileError ||
      error instanceof ClientActivityError ||
      error instanceof ProfileTransferError
        ? error.statusCode
        : isClientError
          ? errorStatus
          : isValidation
            ? 400
            : 500;
    const code =
      error instanceof PartnerError ||
      error instanceof RecommendationError ||
      error instanceof InsuranceRequestError ||
      error instanceof IdentityError ||
      error instanceof DocumentError ||
      error instanceof ManagedProfileError ||
      error instanceof ClientActivityError ||
      error instanceof ProfileTransferError
        ? error.code
        : status === 429
          ? "IDENTITY_RATE_LIMITED"
          : status < 500
            ? "PLATFORM_INVALID_REQUEST"
            : "PLATFORM_INTERNAL_ERROR";
    if (error instanceof IdentityError) request.log.warn({ code }, "Identity request refused");
    else if (status >= 500) request.log.error({ err: error }, "Request failed");
    void reply.code(status).send({ error: { code, message: code, requestId: request.id } });
  });
  app.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({
      error: {
        code: "PLATFORM_NOT_FOUND",
        message: "PLATFORM_NOT_FOUND",
        requestId: request.id,
      },
    });
  });

  app.get("/health/live", { schema: { response: { 200: livenessSchema } } }, () =>
    Promise.resolve({ status: "alive" as const }),
  );
  for (const path of ["/health", "/health/ready"]) {
    app.get(
      path,
      { schema: { response: { 200: readinessSchema, 503: readinessSchema } } },
      async (_, reply) => {
        const isReady = await platform.checkReadiness();
        return reply.code(isReady ? 200 : 503).send({ status: isReady ? "ready" : "not_ready" });
      },
    );
  }

  if (config.FIXTURE_MODE) {
    app.get(
      "/local/personas",
      {
        schema: { response: { 200: localPersonasSchema, 403: apiErrorSchema } },
        onRequest: async (request, reply) => {
          // Binding prevents remote access; checking socket+Host also rejects DNS rebinding/proxy exposure.
          const host = request.hostname;
          if (!isLoopback(request.ip) || !isLoopback(host)) {
            return reply.code(403).send({
              error: {
                code: "PLATFORM_NOT_FOUND",
                message: "PLATFORM_NOT_FOUND",
                requestId: request.id,
              },
            });
          }
        },
      },
      async () => ({ mode: "local-fixture" as const, personas: await platform.readPersonas() }),
    );
  }

  const identity = await registerIdentity(app, config, identityService);
  registerHealthInsurance(app, config, identity);
  registerInsuranceRequests(app, config, identity);
  registerManagedProfiles(app, config, identity);
  registerClientActivities(app, config, identity);
  registerAdminProfileTransfers(app, config, identity);
  registerAuthorizations(app, config, identity);
  const partner = registerPartnerWorkspace(app, config, identity);
  await registerDocuments(app, config, identity, partner);
  return app;
}
