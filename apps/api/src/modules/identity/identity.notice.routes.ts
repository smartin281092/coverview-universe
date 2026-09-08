import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  authorizationNoticeSchema,
  authorizationNoticeOpenedInputSchema,
} from "@coverview/contracts";
import type { IdentitySession } from "./identity.repository.js";
import type { createNoticeRepository } from "./identity.notice.repository.js";

export function registerNoticeRoutes(
  server: FastifyInstance,
  context: {
    repository: () => ReturnType<typeof createNoticeRepository>;
    authenticate: (request: FastifyRequest) => Promise<IdentitySession>;
    checkHost: (request: FastifyRequest) => void;
    checkMutation: (request: FastifyRequest) => Promise<void>;
  },
) {
  const app = server.withTypeProvider<ZodTypeProvider>();
  const limited = { rateLimit: { max: 30, timeWindow: "1 minute" } };
  app.get(
    "/identity/notices/lsa45",
    {
      config: limited,
      schema: { response: { 200: authorizationNoticeSchema } },
    },
    async (request) => {
      context.checkHost(request);
      const session = await context.authenticate(request);
      return context.repository().get(session.userId);
    },
  );
  app.post(
    "/identity/notices/lsa45/opened",
    {
      config: limited,
      onRequest: context.checkMutation,
      schema: {
        body: authorizationNoticeOpenedInputSchema,
        response: { 200: authorizationNoticeSchema },
      },
    },
    async (request) => {
      const session = await context.authenticate(request);
      return context.repository().opened(session.userId, session.id);
    },
  );
}
