import type { FastifyInstance, FastifyRequest } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  walletOffersQuerySchema,
  walletOffersSchema,
} from "@coverview/contracts/partner-wallet-offers";
import type { createPartnerRepository } from "./partner.repository.js";
import type { PartnerActor } from "./partner.policy.js";

// The offers page of Wallet: published offers, request by request (8 October 2026).
export function registerWalletOfferRoutes(
  server: FastifyInstance,
  repository: ReturnType<typeof createPartnerRepository>,
  actor: (request: FastifyRequest, wallet?: boolean, adminOnly?: boolean) => Promise<PartnerActor>,
) {
  server.withTypeProvider<ZodTypeProvider>().get(
    "/wallet/offers",
    {
      config: { rateLimit: { max: 90, timeWindow: "1 minute" } },
      schema: { querystring: walletOffersQuerySchema, response: { 200: walletOffersSchema } },
    },
    async (r) => repository.walletOffers(await actor(r, true), r.query),
  );
}
