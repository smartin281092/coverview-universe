import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  identityConfigSchema,
  identityMeSchema,
  identityWorkspaceSchema,
  identityAdminSchema,
  identitySessionsSchema,
  identitySuccessSchema,
  identityLogoutSchema,
  identityLogoutInputSchema,
  identityRevokeInputSchema,
  identityMfaChallengeSchema,
  identityMfaVerifyInputSchema,
  identityMfaEnrollmentSchema,
  identityMfaEnrollmentStartSchema,
} from "@coverview/contracts";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { createIdentityRepository } from "./identity.repository.js";
import { IdentityError, matchesSecret } from "./identity.security.js";
import {
  createIdentityService,
  requireAdministration,
  type IdentityService,
} from "./identity.service.js";
import { createWorkosProvider } from "./identity.workos.js";
import { createProfileRepository } from "./identity.profile.repository.js";
import { registerProfileRoutes } from "./identity.profile.routes.js";

export async function registerIdentity(
  server: FastifyInstance,
  config: Environment,
  injectedService?: IdentityService,
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  await app.register(cookie);
  await app.register(rateLimit, { global: false, max: 30, timeWindow: "1 minute" });
  let service = injectedService;
  let profileRepository: ReturnType<typeof createProfileRepository> | undefined;
  if (config.AUTH_ENABLED && !service) {
    const database = createDatabase(config);
    database.pool.on("error", () =>
      app.log.error({ dependency: "identity_database" }, "Identity dependency unavailable"),
    );
    app.addHook("onClose", () => database.pool.end());
    profileRepository = createProfileRepository(database.db);
    service = createIdentityService(
      config,
      createIdentityRepository(database.db),
      createWorkosProvider(config),
      (code) => app.log.warn({ code }, "Remote session revocation remains pending"),
    );
  }
  const isSecure = new URL(config.AUTH_API_ORIGIN).protocol === "https:";
  const sessionName = isSecure ? "__Host-cv_session" : "cv_session";
  const loginName = isSecure ? "__Host-cv_login" : "cv_login";
  const cookieOptions = { httpOnly: true, secure: isSecure, sameSite: "lax" as const, path: "/" };
  function requiredService() {
    if (!config.AUTH_ENABLED || !service) throw new IdentityError("IDENTITY_UNAVAILABLE", 503);
    return service;
  }
  function token(request: FastifyRequest) {
    return request.cookies[sessionName];
  }
  function checkHost(request: FastifyRequest) {
    if (request.headers.host !== new URL(config.AUTH_API_ORIGIN).host)
      throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
  }
  function checkMutation(request: FastifyRequest) {
    checkHost(request);
    const auth = requiredService();
    const origin = request.headers.origin;
    const supplied = request.headers["x-csrf-token"];
    const current = token(request);
    if (
      !origin ||
      ![config.AUTH_WALLET_ORIGIN, config.AUTH_ADMIN_ORIGIN, config.AUTH_WWW_ORIGIN].includes(
        origin,
      ) ||
      !current ||
      typeof supplied !== "string" ||
      !matchesSecret(supplied, auth.csrf(current))
    ) {
      throw new IdentityError("IDENTITY_CSRF_INVALID", 403);
    }
    if (!z.uuid().safeParse(request.headers["idempotency-key"]).success) {
      throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
    }
    return Promise.resolve();
  }
  function setSession(reply: FastifyReply, value: string, expiresAt: Date) {
    reply.setCookie(sessionName, value, { ...cookieOptions, expires: expiresAt });
  }
  const limited = { rateLimit: { max: 30, timeWindow: "1 minute" } };
  const sensitive = { rateLimit: { max: 5, timeWindow: "1 minute" } };
  app.get("/identity/config", { schema: { response: { 200: identityConfigSchema } } }, () =>
    Promise.resolve({ enabled: config.AUTH_ENABLED }),
  );
  app.get(
    "/auth/login",
    {
      config: limited,
      schema: {
        querystring: z
          .object({
            surface: z.enum(["wallet", "admin", "www"]),
            reauthenticate: z.literal("true").optional(),
            continuation: z.literal("profile").optional(),
          })
          .strict(),
      },
    },
    async (request, reply) => {
      checkHost(request);
      const result = await requiredService().login(
        request.query.surface,
        request.query.reauthenticate === "true",
        request.query.continuation,
      );
      reply.header("referrer-policy", "no-referrer");
      reply.setCookie(loginName, result.browserNonce, { ...cookieOptions, maxAge: 600 });
      return reply.redirect(result.url, 303);
    },
  );
  app.get(
    "/auth/callback",
    {
      config: limited,
      schema: {
        querystring: z.union([
          z
            .object({ code: z.string().min(1).max(2048), state: z.string().min(1).max(512) })
            .strict(),
          z
            .object({
              error: z.string().min(1).max(200),
              error_description: z.string().max(2048).optional(),
              state: z.string().min(1).max(512),
            })
            .strict(),
        ]),
      },
    },
    async (request, reply) => {
      checkHost(request);
      reply.header("referrer-policy", "no-referrer");
      const result = await requiredService().callback(
        "code" in request.query ? request.query.code : undefined,
        request.query.state,
        request.cookies[loginName],
        request.headers["user-agent"] ?? "Browser",
        request.id,
      );
      reply.clearCookie(loginName, cookieOptions);
      if (result.success) setSession(reply, result.token, result.session.expiresAt);
      else
        request.log.warn(
          { code: result.code, diagnostic: result.diagnostic },
          "Identity callback failed",
        );
      return reply.redirect(result.destination, 303);
    },
  );
  app.get(
    "/identity/me",
    { config: limited, schema: { response: { 200: identityMeSchema } } },
    async (request) => {
      checkHost(request);
      const auth = requiredService();
      const sessionToken = token(request);
      const session = await auth.authenticate(sessionToken);
      return {
        user: { id: session.userId, email: session.email },
        session: { id: session.id, expiresAt: session.expiresAt.toISOString() },
        csrfToken: auth.csrf(sessionToken ?? ""),
        permissions: session.hasAdminPermission
          ? ["workspace.read", "administration.access"]
          : ["workspace.read"],
      };
    },
  );
  app.get(
    "/identity/workspace/:userId",
    {
      config: limited,
      schema: {
        params: z.object({ userId: z.string().min(1).max(200) }),
        response: { 200: identityWorkspaceSchema },
      },
    },
    async (request) => {
      checkHost(request);
      const session = await requiredService().authenticate(token(request));
      if (session.userId !== request.params.userId)
        throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
      return { ownerId: session.userId, email: session.email };
    },
  );
  app.get(
    "/identity/admin",
    { config: limited, schema: { response: { 200: identityAdminSchema } } },
    async (request) => {
      checkHost(request);
      const session = await requiredService().authenticate(token(request));
      requireAdministration(session);
      request.log.info(
        { userId: session.userId, action: "administration.access" },
        "Privileged access",
      );
      return { userId: session.userId };
    },
  );
  app.get(
    "/identity/sessions",
    {
      config: limited,
      schema: {
        querystring: z.object({ cursor: z.string().min(1).max(200).optional() }).strict(),
        response: { 200: identitySessionsSchema },
      },
    },
    async (request) => {
      checkHost(request);
      const auth = requiredService();
      return auth.listSessions(await auth.authenticate(token(request)), request.query.cursor);
    },
  );
  app.post(
    "/identity/sessions/:sessionId/revoke",
    {
      config: limited,
      onRequest: checkMutation,
      schema: {
        params: z.object({ sessionId: z.string().min(1).max(200) }),
        body: identityRevokeInputSchema,
        response: { 200: identitySuccessSchema },
      },
    },
    async (request) => {
      const auth = requiredService();
      await auth.revoke(
        await auth.authenticate(token(request)),
        request.params.sessionId,
        request.id,
      );
      return { success: true as const };
    },
  );
  app.post(
    "/identity/logout",
    {
      config: limited,
      onRequest: checkMutation,
      schema: { body: identityLogoutInputSchema, response: { 200: identityLogoutSchema } },
    },
    async (request, reply) => {
      const auth = requiredService();
      const result = await auth.logout(
        await auth.logoutSession(token(request)),
        request.body.scope,
        String(request.headers["idempotency-key"]),
      );
      if (result === "complete") reply.clearCookie(sessionName, cookieOptions);
      return { success: true as const, remoteRevocation: result };
    },
  );
  app.get(
    "/identity/mfa/enrollment",
    { config: limited, schema: { response: { 200: identityMfaEnrollmentSchema } } },
    async (request) => {
      checkHost(request);
      const auth = requiredService();
      const current = token(request);
      return auth.enrollment(current ?? "", await auth.authenticate(current));
    },
  );
  app.post(
    "/identity/mfa/enrollment/start",
    {
      config: sensitive,
      onRequest: checkMutation,
      schema: {
        body: identityRevokeInputSchema,
        response: { 200: identityMfaEnrollmentStartSchema },
      },
    },
    async (request) => {
      const auth = requiredService();
      const current = token(request);
      return auth.startEnrollment(
        current ?? "",
        await auth.authenticate(current),
        String(request.headers["idempotency-key"]),
      );
    },
  );
  app.post(
    "/identity/mfa/enrollment/challenge",
    {
      config: sensitive,
      onRequest: checkMutation,
      schema: { body: identityRevokeInputSchema, response: { 200: identityMfaChallengeSchema } },
    },
    async (request) => {
      const auth = requiredService();
      const current = token(request);
      return auth.challengeEnrollment(
        current ?? "",
        await auth.authenticate(current),
        String(request.headers["idempotency-key"]),
      );
    },
  );
  app.post(
    "/identity/mfa/enrollment/confirm",
    {
      config: sensitive,
      onRequest: checkMutation,
      schema: { body: identityMfaVerifyInputSchema, response: { 200: identitySuccessSchema } },
    },
    async (request, reply) => {
      const auth = requiredService();
      const current = token(request);
      const result = await auth.confirmEnrollment(
        current ?? "",
        await auth.authenticate(current),
        request.body.code,
        String(request.headers["idempotency-key"]),
      );
      setSession(reply, result.token, result.session.expiresAt);
      return { success: true as const };
    },
  );
  app.post(
    "/identity/mfa/enrollment/cancel",
    {
      config: sensitive,
      onRequest: checkMutation,
      schema: { body: identityRevokeInputSchema, response: { 200: identitySuccessSchema } },
    },
    async (request) => {
      const auth = requiredService();
      const current = token(request);
      await auth.cancelEnrollment(
        current ?? "",
        await auth.authenticate(current),
        String(request.headers["idempotency-key"]),
      );
      return { success: true as const };
    },
  );
  app.post(
    "/identity/mfa/challenge",
    {
      config: sensitive,
      onRequest: checkMutation,
      schema: { body: identityRevokeInputSchema, response: { 200: identityMfaChallengeSchema } },
    },
    async (request) => {
      const auth = requiredService();
      return auth.challenge(await auth.authenticate(token(request)));
    },
  );
  app.post(
    "/identity/mfa/verify",
    {
      config: sensitive,
      onRequest: checkMutation,
      schema: { body: identityMfaVerifyInputSchema, response: { 200: identitySuccessSchema } },
    },
    async (request, reply) => {
      const auth = requiredService();
      const current = token(request);
      const result = await auth.verify(
        current ?? "",
        await auth.authenticate(current),
        request.body.code,
        String(request.headers["idempotency-key"]),
      );
      setSession(reply, result.token, result.session.expiresAt);
      return { success: true as const };
    },
  );
  registerProfileRoutes(app, config, {
    repository: () => {
      requiredService();
      if (!profileRepository) throw new IdentityError("IDENTITY_UNAVAILABLE", 503);
      return profileRepository;
    },
    authenticate: (request) => requiredService().authenticate(token(request)),
    csrf: (value) => requiredService().csrf(value),
    checkHost,
    checkMutation,
  });
}
