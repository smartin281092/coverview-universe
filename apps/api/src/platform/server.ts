import { randomUUID } from "node:crypto";
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

export async function buildServer(config: Environment, dependencies?: PlatformDependencies) {
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
    methods: ["GET"],
    allowedHeaders: ["Accept", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    credentials: false,
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
    const status = isClientError ? errorStatus : isValidation ? 400 : 500;
    const code = status < 500 ? "PLATFORM_INVALID_REQUEST" : "PLATFORM_INTERNAL_ERROR";
    if (status >= 500) request.log.error({ err: error }, "Request failed");
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

  return app;
}
