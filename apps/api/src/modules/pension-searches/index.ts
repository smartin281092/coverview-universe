import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  pensionSearchBrowserSchema,
  pensionSearchCodeInputSchema,
  pensionSearchEmailInputSchema,
  pensionSearchEmailResultSchema,
  pensionSearchIdSchema,
  pensionSearchListQuerySchema,
  pensionSearchListSchema,
  pensionSearchSchema,
  pensionSearchSubmitInputSchema,
  pensionSearchTransitionInputSchema,
  pensionSearchVerifyResultSchema,
} from "@coverview/contracts/pension-searches";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { IdentityError, type registerIdentity } from "../identity/index.js";
import { createPensionSearchRepository } from "./pension-searches.repository.js";
export { PensionSearchError } from "./pension-searches.repository.js";
type Identity = Awaited<ReturnType<typeof registerIdentity>>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const csrf = (value: string) => hash(`pension-csrf:${value}`);

/**
 * LPP searches (4 November 2026): ordered on the public site by a verified Wallet account,
 * followed in Wallet, moved step by step by an administrator. The browser cookie anchors CSRF and
 * the email code before a session exists; reading and ordering always take the account session.
 */
export function registerPensionSearches(
  server: FastifyInstance,
  config: Environment,
  identity: Identity,
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const database = createDatabase(config);
  database.pool.on("error", () =>
    app.log.warn(
      { dependency: "pension_searches_database" },
      "Pension search database unavailable",
    ),
  );
  app.addHook("onClose", () => database.pool.end());
  const repository = createPensionSearchRepository(database.db);
  // Expired codes are removed in bounded passes; orders are never removed by this maintenance.
  let maintenance: Promise<void> | null = null;
  const clean = () => {
    if (maintenance) return;
    maintenance = database.pool
      .query(
        "delete from pension_search_challenges where browser_hash in (select browser_hash from pension_search_challenges where expires_at < now()-interval '24 hours' order by expires_at limit 100 for update skip locked)",
      )
      .then(() => undefined)
      .catch(() => {
        app.log.warn({ code: "PENSION_SEARCH_MAINTENANCE" }, "Pension search cleanup will retry");
      })
      .finally(() => {
        maintenance = null;
      });
  };
  const timer = setInterval(clean, 60000);
  timer.unref();
  clean();
  app.addHook("onClose", async () => {
    clearInterval(timer);
    await maintenance;
  });
  const secure = new URL(config.AUTH_API_ORIGIN).protocol === "https:";
  const cookieName = secure ? "__Host-cv_pension" : "cv_pension";
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: 30 * 86400,
  };
  const params = z.object({ id: pensionSearchIdSchema }).strict();
  function browser(request: FastifyRequest) {
    const token = request.cookies[cookieName];
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token))
      throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
    return { token, hash: hash(token) };
  }
  const origins = [config.AUTH_WWW_ORIGIN, config.AUTH_WALLET_ORIGIN, config.AUTH_ADMIN_ORIGIN];
  function mutation(request: FastifyRequest) {
    identity.checkHost(request);
    const { token } = browser(request);
    const supplied = request.headers["x-csrf-token"];
    if (
      !request.headers.origin ||
      !origins.includes(request.headers.origin) ||
      typeof supplied !== "string" ||
      !/^[0-9a-f]{64}$/.test(supplied) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(csrf(token)))
    )
      throw new IdentityError("IDENTITY_CSRF_INVALID", 403);
    if (!z.uuid().safeParse(request.headers["idempotency-key"]).success)
      throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
    return Promise.resolve();
  }
  async function optionalSession(request: FastifyRequest) {
    if (!config.AUTH_ENABLED) return undefined;
    try {
      return await identity.authenticate(request);
    } catch (error) {
      if (error instanceof IdentityError && error.code === "IDENTITY_UNAUTHENTICATED")
        return undefined;
      throw error;
    }
  }
  const limit = { rateLimit: { max: 60, timeWindow: "1 minute" } };
  const sensitive = { rateLimit: { max: 5, timeWindow: "1 minute" } };
  const host = (request: FastifyRequest) => {
    identity.checkHost(request);
    return Promise.resolve();
  };
  app.get(
    "/pension-searches/browser",
    { config: limit, schema: { response: { 200: pensionSearchBrowserSchema } } },
    async (request, reply) => {
      identity.checkHost(request);
      if (request.headers.origin && !origins.includes(request.headers.origin))
        throw new IdentityError("IDENTITY_ACCESS_DENIED", 403);
      const existing = request.cookies[cookieName];
      const token =
        existing && /^[A-Za-z0-9_-]{43}$/.test(existing)
          ? existing
          : randomBytes(32).toString("base64url");
      reply.setCookie(cookieName, token, cookieOptions);
      return {
        csrfToken: csrf(token),
        authEnabled: config.AUTH_ENABLED,
        walletUrl: config.AUTH_WALLET_ORIGIN,
        accountEmail: (await optionalSession(request))?.email ?? null,
      };
    },
  );
  app.post(
    "/pension-searches/email",
    {
      config: sensitive,
      onRequest: mutation,
      schema: {
        body: pensionSearchEmailInputSchema,
        response: { 200: pensionSearchEmailResultSchema },
      },
    },
    async (request) => {
      const browserHash = browser(request).hash;
      const key = String(request.headers["idempotency-key"]);
      const email = request.body.email.toLowerCase();
      const result = await repository.email(
        browserHash,
        email,
        key,
        await optionalSession(request),
      );
      if (result.verified) return { codeStatus: "not_requested" as const, verified: true };
      let sent = result.sent;
      if (result.send) {
        try {
          await identity.startEmail(email);
          sent = true;
        } catch {
          request.log.warn({ code: "PENSION_SEARCH_EMAIL_UNAVAILABLE" }, "Email code unavailable");
        }
        await repository.emailSent(browserHash, key, sent);
      }
      return { codeStatus: sent ? ("sent" as const) : ("unavailable" as const), verified: false };
    },
  );
  app.post(
    "/pension-searches/verify-email",
    {
      config: sensitive,
      onRequest: mutation,
      schema: {
        body: pensionSearchCodeInputSchema,
        response: { 200: pensionSearchVerifyResultSchema },
      },
    },
    async (request, reply) => {
      const browserHash = browser(request).hash;
      const challenge = await repository.beginVerification(browserHash);
      let verified = false;
      try {
        // The code creates the canonical CoverView session cookie, as a sign-in from Wallet would.
        const session = await identity.verifyEmail(
          request,
          reply,
          challenge.email,
          request.body.code,
          challenge.createdAt,
        );
        verified = true;
        return { verified: true as const, email: session.email };
      } finally {
        await repository.finishVerification(browserHash, challenge.key, verified);
      }
    },
  );
  app.post(
    "/pension-searches",
    {
      config: limit,
      onRequest: mutation,
      schema: { body: pensionSearchSubmitInputSchema, response: { 200: pensionSearchSchema } },
    },
    async (request) =>
      repository.submit(
        await identity.authenticate(request),
        request.body.details,
        String(request.headers["idempotency-key"]),
      ),
  );
  app.get(
    "/pension-searches",
    {
      config: limit,
      onRequest: host,
      schema: {
        querystring: pensionSearchListQuerySchema,
        response: { 200: pensionSearchListSchema },
      },
    },
    async (request) =>
      repository.list(request.query, (await identity.authenticate(request)).userId),
  );
  app.get(
    "/pension-searches/:id",
    { config: limit, onRequest: host, schema: { params, response: { 200: pensionSearchSchema } } },
    async (request) =>
      repository.get(request.params.id, (await identity.authenticate(request)).userId),
  );
  app.get(
    "/admin/pension-searches",
    {
      config: limit,
      schema: {
        querystring: pensionSearchListQuerySchema,
        response: { 200: pensionSearchListSchema },
      },
    },
    async (request) => {
      await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(request, null, "pension-searches", "list");
      return repository.list(request.query, undefined, true);
    },
  );
  app.get(
    "/admin/pension-searches/:id",
    { config: limit, schema: { params, response: { 200: pensionSearchSchema } } },
    async (request) => {
      const actor = await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(
        request,
        null,
        `pension-search:${request.params.id}`,
        "read",
      );
      return repository.get(request.params.id, actor.userId, true);
    },
  );
  app.post(
    "/admin/pension-searches/:id/transition",
    {
      config: limit,
      schema: {
        params,
        body: pensionSearchTransitionInputSchema,
        response: { 200: pensionSearchSchema },
      },
    },
    async (request) => {
      await identity.checkMutation(request);
      const actor = await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(
        request,
        null,
        `pension-search:${request.params.id}`,
        "transition",
      );
      return repository.transition(
        request.params.id,
        request.body,
        String(request.headers["idempotency-key"]),
        actor,
      );
    },
  );
}
