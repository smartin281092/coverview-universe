import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  profileSchema,
  profileSaveInputSchema,
  profileConfirmInputSchema,
  profileDraftEntrySchema,
  profileAttachInputSchema,
  profileAttachSchema,
  profileChoicesSchema,
} from "@coverview/contracts";
import type { Environment } from "../../platform/config.js";
import type { IdentitySession } from "./identity.repository.js";
import type { createProfileRepository } from "./identity.profile.repository.js";
import { IdentityError, matchesSecret, randomSecret, secretHash } from "./identity.security.js";

export function registerProfileRoutes(
  server: FastifyInstance,
  config: Environment,
  context: {
    repository: () => ReturnType<typeof createProfileRepository>;
    authenticate: (request: FastifyRequest) => Promise<IdentitySession>;
    csrf: (token: string) => string;
    checkHost: (request: FastifyRequest) => void;
    checkMutation: (request: FastifyRequest) => Promise<void>;
  },
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const secure = new URL(config.AUTH_API_ORIGIN).protocol === "https:";
  const name = secure ? "__Host-cv_profile_draft" : "cv_profile_draft";
  const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: 86400 };
  const limited = { rateLimit: { max: 30, timeWindow: "1 minute" } };
  function draftToken(request: FastifyRequest) {
    const token = request.cookies[name];
    return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : undefined;
  }
  function requiredDraftToken(request: FastifyRequest) {
    const token = draftToken(request);
    if (!token) throw new IdentityError("PROFILE_DRAFT_EXPIRED", 410);
    return token;
  }
  function key(request: FastifyRequest) {
    return String(request.headers["idempotency-key"]);
  }
  function checkDraftMutation(request: FastifyRequest) {
    context.checkHost(request);
    const token = requiredDraftToken(request);
    const origin = request.headers.origin;
    const csrf = request.headers["x-csrf-token"];
    if (
      !origin ||
      ![config.AUTH_WALLET_ORIGIN, config.AUTH_WWW_ORIGIN].includes(origin) ||
      typeof csrf !== "string" ||
      !matchesSecret(csrf, context.csrf(`profile:${token}`))
    )
      throw new IdentityError("IDENTITY_CSRF_INVALID", 403);
    if (!z.uuid().safeParse(request.headers["idempotency-key"]).success)
      throw new IdentityError("IDENTITY_ACCESS_DENIED", 400);
    return token;
  }

  app.get(
    "/identity/profile/draft",
    { config: limited, schema: { response: { 200: profileDraftEntrySchema } } },
    async (request, reply) => {
      context.checkHost(request);
      const repository = context.repository();
      let token = draftToken(request);
      if (!token) {
        token = randomSecret();
        // Browser possession only: no anonymous record or personal data before the first save.
        reply.setCookie(name, token, options);
      }
      return {
        ...(await repository.getDraft(secretHash(token))),
        csrfToken: context.csrf(`profile:${token}`),
      };
    },
  );
  app.post(
    "/identity/profile/draft",
    {
      config: limited,
      schema: { body: profileSaveInputSchema, response: { 200: profileDraftEntrySchema } },
    },
    async (request, reply) => {
      const token = checkDraftMutation(request);
      const draft = await context
        .repository()
        .saveDraft(secretHash(token), request.body, key(request));
      reply.setCookie(name, token, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
        expires: new Date(draft.expiresAt),
      });
      return { draft, state: "active" as const, csrfToken: context.csrf(`profile:${token}`) };
    },
  );
  app.post(
    "/identity/profile/draft/new",
    {
      config: limited,
      schema: { body: z.object({}).strict(), response: { 200: profileDraftEntrySchema } },
    },
    async (request, reply) => {
      const current = checkDraftMutation(request);
      let renewal: string | null;
      try {
        renewal = await context.repository().renewDraft(secretHash(current));
      } catch (error) {
        if (error instanceof IdentityError && error.code === "PROFILE_DRAFT_EXPIRED")
          reply.clearCookie(name, { path: "/", httpOnly: true, secure, sameSite: "lax" });
        throw error;
      }
      // Concurrent retries of one transition receive the same possession handle.
      const token = renewal ? context.csrf(`profile:renewal:${current}:${renewal}`) : current;
      reply.setCookie(name, token, options);
      return {
        ...(await context.repository().getDraft(secretHash(token))),
        csrfToken: context.csrf(`profile:${token}`),
      };
    },
  );
  app.get(
    "/identity/profile",
    { config: limited, schema: { response: { 200: profileSchema } } },
    async (request) => {
      context.checkHost(request);
      const session = await context.authenticate(request);
      return context.repository().get(session.userId);
    },
  );
  app.post(
    "/identity/profile",
    {
      config: limited,
      onRequest: context.checkMutation,
      schema: { body: profileSaveInputSchema, response: { 200: profileSchema } },
    },
    async (request) => {
      const session = await context.authenticate(request);
      return context.repository().save(session.userId, session.id, request.body, key(request));
    },
  );
  app.post(
    "/identity/profile/confirm",
    {
      config: limited,
      onRequest: context.checkMutation,
      schema: { body: profileConfirmInputSchema, response: { 200: profileSchema } },
    },
    async (request) => {
      const session = await context.authenticate(request);
      return context.repository().confirm(session.userId, session.id, request.body, key(request));
    },
  );
  app.post(
    "/identity/profile/attach",
    {
      config: limited,
      onRequest: context.checkMutation,
      schema: { body: profileAttachInputSchema, response: { 200: profileAttachSchema } },
    },
    async (request) => {
      const session = await context.authenticate(request);
      return context
        .repository()
        .attach(
          session.userId,
          session.id,
          secretHash(requiredDraftToken(request)),
          request.body,
          key(request),
        );
    },
  );
  app.get(
    "/identity/profile/choices",
    {
      config: limited,
      schema: {
        querystring: z.object({ cursor: z.string().max(200).optional() }).strict(),
        response: { 200: profileChoicesSchema },
      },
    },
    async (request) => {
      context.checkHost(request);
      const session = await context.authenticate(request);
      return context.repository().choices(session.userId, request.query.cursor);
    },
  );
}
