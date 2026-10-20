import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  insuranceBrowserSchema,
  insuranceEmailInputSchema,
  insuranceEmailResultSchema,
  insuranceCodeInputSchema,
  insuranceCartSchema,
  insuranceRequestSchema,
  insuranceRequestIdSchema,
  insuranceRequestListQuerySchema,
  insuranceRequestListSchema,
  insuranceTransitionInputSchema,
  insurancePreviousContractInputSchema,
} from "@coverview/contracts/insurance-requests";
import type { Environment } from "../../platform/config.js";
import { createDatabase } from "../../platform/db/database.js";
import { IdentityError, type registerIdentity } from "../identity/index.js";
import { createHealthRepository } from "../health-insurance/index.js";
import {
  createInsuranceRequestRepository,
  InsuranceRequestError,
} from "./insurance-requests.repository.js";
export { InsuranceRequestError } from "./insurance-requests.repository.js";
export { insuranceLeadCandidates } from "./insurance-requests.partner.js";
export { insuranceRequests } from "./insurance-requests.schema.js";
type Identity = Awaited<ReturnType<typeof registerIdentity>>;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const csrf = (value: string) => hash(`insurance-csrf:${value}`);

export function registerInsuranceRequests(
  server: FastifyInstance,
  config: Environment,
  identity: Identity,
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const database = createDatabase(config);
  database.pool.on("error", () =>
    app.log.warn(
      { dependency: "insurance_requests_database" },
      "Insurance request database unavailable",
    ),
  );
  app.addHook("onClose", () => database.pool.end());
  const health = createHealthRepository(database.pool);
  const repository = createInsuranceRequestRepository(database.db, (person) =>
    health.quote(person),
  );
  let maintenance: Promise<void> | null = null;
  const clean = () => {
    if (maintenance) return;
    maintenance = (async () => {
      await database.pool.query(
        "delete from insurance_requests where id in (select id from insurance_requests where state='draft' and created_at < now()-interval '24 hours' order by created_at limit 100 for update skip locked)",
      );
      await database.pool.query(
        "delete from insurance_email_reservations where email_hash in (select email_hash from insurance_email_reservations where reserved_at < now()-interval '24 hours' order by reserved_at limit 100 for update skip locked)",
      );
      await database.pool.query(
        "delete from insurance_email_challenges where browser_hash in (select browser_hash from insurance_email_challenges where expires_at < now()-interval '24 hours' order by expires_at limit 100 for update skip locked)",
      );
    })()
      .catch(() => {
        app.log.warn(
          { code: "INSURANCE_REQUEST_MAINTENANCE" },
          "Insurance request cleanup will retry",
        );
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
  const cookieName = secure ? "__Host-cv_insurance" : "cv_insurance";
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: 30 * 86400,
  };
  const params = z.object({ id: insuranceRequestIdSchema }).strict();
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
  app.get(
    "/insurance-requests/draft",
    {
      config: limit,
      onRequest: (request) => {
        identity.checkHost(request);
        return Promise.resolve();
      },
      schema: { response: { 200: insuranceRequestSchema.nullable() } },
    },
    async (request) =>
      repository.draft(browser(request).hash, (await optionalSession(request))?.userId),
  );
  app.get(
    "/insurance-requests/browser",
    { config: limit, schema: { response: { 200: insuranceBrowserSchema } } },
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
    "/insurance-requests/email",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      onRequest: (request) => {
        mutation(request);
        return Promise.resolve();
      },
      schema: { body: insuranceEmailInputSchema, response: { 200: insuranceEmailResultSchema } },
    },
    async (request) => {
      const browserHash = browser(request).hash;
      const key = String(request.headers["idempotency-key"]);
      const result = await repository.email(
        browserHash,
        request.body.email.toLowerCase(),
        key,
        await optionalSession(request),
        request.body.access,
      );
      let sent = result.sent;
      if (result.send) {
        try {
          await identity.startEmail(request.body.email.toLowerCase());
          sent = true;
        } catch {
          request.log.warn(
            { code: "INSURANCE_EMAIL_UNAVAILABLE" },
            "Email authentication unavailable",
          );
        }
        await repository.emailSent(browserHash, key, sent);
      }
      return {
        id: result.id,
        codeStatus:
          request.body.access === "guest" || result.verified
            ? ("not_requested" as const)
            : sent
              ? ("sent" as const)
              : ("unavailable" as const),
        verified: result.verified,
      };
    },
  );
  app.post(
    "/insurance-requests/:id/verify-email",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      onRequest: (request) => {
        mutation(request);
        return Promise.resolve();
      },
      schema: { params, body: insuranceCodeInputSchema, response: { 200: insuranceRequestSchema } },
    },
    async (request, reply) => {
      const browserHash = browser(request).hash;
      const current = await optionalSession(request);
      if (current) {
        try {
          return await repository.verifyOwner(browserHash, request.params.id, current);
        } catch (cause) {
          if (!(cause instanceof InsuranceRequestError && cause.statusCode === 404)) throw cause;
        }
      }
      const challenge = await repository.beginVerification(browserHash, request.params.id);
      let verified = false;
      try {
        const session = await identity.verifyEmail(
          request,
          reply,
          challenge.email,
          request.body.code,
          challenge.createdAt,
        );
        verified = true;
        return await repository.verifyOwner(browserHash, request.params.id, session);
      } finally {
        await repository.finishVerification(browserHash, challenge.key, verified);
      }
    },
  );
  app.post(
    "/insurance-requests/:id/claim",
    {
      config: limit,
      onRequest: (request) => {
        mutation(request);
        return Promise.resolve();
      },
      schema: { params, body: z.object({}).strict(), response: { 200: insuranceRequestSchema } },
    },
    async (request) =>
      repository.verifyOwner(
        browser(request).hash,
        request.params.id,
        await identity.authenticate(request),
      ),
  );
  for (const action of ["cart", "submit"] as const)
    app.post(
      `/insurance-requests/:id/${action}`,
      {
        config: limit,
        onRequest: (request) => {
          mutation(request);
          return Promise.resolve();
        },
        schema: { params, body: insuranceCartSchema, response: { 200: insuranceRequestSchema } },
      },
      async (request) => {
        const session = await optionalSession(request);
        const browserHash = browser(request).hash;
        const key = String(request.headers["idempotency-key"]);
        if (action === "submit") {
          const receipt = await repository.receipt(
            browserHash,
            request.params.id,
            request.body,
            key,
            session,
          );
          if (receipt) return receipt;
        }
        const items = await repository.price(request.body);
        return action === "cart"
          ? repository.save(browserHash, request.params.id, request.body, items, key, session)
          : repository.submit(
              browserHash,
              request.params.id,
              request.body,
              items,
              String(request.headers["idempotency-key"]),
              session,
            );
      },
    );
  app.post(
    "/insurance-requests/:id/previous-contract",
    {
      config: limit,
      onRequest: (request) => {
        mutation(request);
        return Promise.resolve();
      },
      schema: {
        params,
        body: insurancePreviousContractInputSchema,
        response: { 200: insuranceRequestSchema },
      },
    },
    async (request) =>
      repository.previousContract(
        request.params.id,
        request.body,
        await identity.authenticate(request),
      ),
  );
  app.get(
    "/insurance-requests/:id",
    {
      config: limit,
      onRequest: (request) => {
        identity.checkHost(request);
        return Promise.resolve();
      },
      schema: { params, response: { 200: insuranceRequestSchema } },
    },
    async (request) =>
      repository.get(
        request.params.id,
        browser(request).hash,
        (await optionalSession(request))?.userId,
      ),
  );
  app.get(
    "/insurance-requests",
    {
      config: limit,
      onRequest: (request) => {
        identity.checkHost(request);
        return Promise.resolve();
      },
      schema: {
        querystring: insuranceRequestListQuerySchema,
        response: { 200: insuranceRequestListSchema },
      },
    },
    async (request) =>
      repository.list(request.query, (await identity.authenticate(request)).userId),
  );
  app.get(
    "/admin/insurance-requests",
    {
      config: limit,
      schema: {
        querystring: insuranceRequestListQuerySchema,
        response: { 200: insuranceRequestListSchema },
      },
    },
    async (request) => {
      await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(request, null, "insurance-requests", "list");
      return repository.list(request.query, undefined, true);
    },
  );
  app.get(
    "/admin/insurance-requests/:id",
    { config: limit, schema: { params, response: { 200: insuranceRequestSchema } } },
    async (request) => {
      await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(
        request,
        null,
        `insurance-request:${request.params.id}`,
        "read",
      );
      return repository.get(request.params.id, "", undefined, true);
    },
  );
  app.post(
    "/admin/insurance-requests/:id/transition",
    {
      config: limit,
      schema: {
        params,
        body: insuranceTransitionInputSchema,
        response: { 200: insuranceRequestSchema },
      },
    },
    async (request) => {
      await identity.checkMutation(request);
      const actor = await identity.authenticateAdministrator(request);
      await identity.auditAdministratorAccess(
        request,
        null,
        `insurance-request:${request.params.id}`,
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
